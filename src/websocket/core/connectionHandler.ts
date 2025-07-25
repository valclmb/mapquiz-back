import { WebSocket } from "@fastify/websocket";
import { APP_CONFIG } from "../../lib/config.js";
import * as LobbyModel from "../../models/lobbyModel.js";
import * as UserModel from "../../models/userModel.js";
import { FriendService } from "../../services/friendService.js";
import { BroadcastManager } from "../lobby/broadcastManager.js";
import * as LobbyManager from "../lobby/lobbyManager.js";
import { sendSuccessResponse } from "./authentication.js";
import { addConnection, removeConnection } from "./connectionManager.js";

/**
 * Gestionnaire de connexions WebSocket
 */
export class WebSocketConnectionHandler {
  private static restoredUsers = new Set<string>(); // Cache pour éviter les restaurations multiples
  private static recentlyDisconnectedUsers = new Set<string>(); // Cache pour éviter les déconnexions multiples

  /**
   * Gère l'établissement d'une nouvelle connexion
   */
  static handleNewConnection(socket: WebSocket): void {
    // Confirmer la connexion
    sendSuccessResponse(
      socket,
      {
        message: "Connexion WebSocket établie",
      },
      "connected"
    );
  }

  /**
   * Gère l'authentification d'un utilisateur
   */
  static async handleAuthentication(
    socket: WebSocket,
    userId: string,
    request: any
  ): Promise<void> {
    // Ajouter la connexion au gestionnaire
    addConnection(userId, socket);

    // Notifier les amis que l'utilisateur est en ligne
    await FriendService.notifyFriendsOfStatusChange(userId, true);

    // Restaurer l'utilisateur dans les lobbies où il était
    await this.restoreUserInLobbies(userId);

    // Configurer les gestionnaires d'événements de fermeture
    this.setupConnectionEventHandlers(socket, userId);

    // Envoyer la confirmation d'authentification
    sendSuccessResponse(
      socket,
      {
        userId: userId,
      },
      "authenticated"
    );
  }

  /**
   * Restaure un utilisateur dans ses lobbies
   */
  private static async restoreUserInLobbies(userId: string): Promise<void> {
    if (this.restoredUsers.has(userId)) {
      return;
    }

    try {
      // Récupérer les lobbies où l'utilisateur était
      const userLobbies = await LobbyModel.findUserLobbies(userId);

      for (const lobby of userLobbies) {
        if (lobby.status === "waiting") {
          // Restaurer l'utilisateur dans le lobby
          LobbyManager.addPlayerToLobby(lobby.id, userId, "User");
          
          // Diffuser la mise à jour
          const lobbyInMemory = LobbyManager.getLobbyInMemory(lobby.id);
          if (lobbyInMemory) {
            await BroadcastManager.broadcastLobbyUpdate(lobby.id, lobbyInMemory);
          }
        }
      }

      this.restoredUsers.add(userId);
    } catch (error) {
      console.error("Erreur lors de la restauration des lobbies:", error);
    }
  }

  /**
   * Configure les gestionnaires d'événements de fermeture
   */
  private static setupConnectionEventHandlers(socket: WebSocket, userId: string): void {
    socket.on("close", async () => {
      if (this.recentlyDisconnectedUsers.has(userId)) {
        return;
      }

      this.recentlyDisconnectedUsers.add(userId);

      try {
        // Retirer la connexion
        removeConnection(userId);

        // Notifier les amis que l'utilisateur est hors ligne
        await FriendService.notifyFriendsOfStatusChange(userId, false);

        // Marquer l'utilisateur comme déconnecté dans ses lobbies
        await this.handlePlayerDisconnect(userId);

        // Nettoyer le cache après un délai
        setTimeout(() => {
          this.recentlyDisconnectedUsers.delete(userId);
          this.restoredUsers.delete(userId);
        }, 5000);
      } catch (error) {
        console.error("Erreur lors de la déconnexion:", error);
      }
    });
  }

  /**
   * Gère la déconnexion d'un joueur
   */
  private static async handlePlayerDisconnect(userId: string): Promise<void> {
    try {
      const userLobbies = await LobbyModel.findUserLobbies(userId);

      for (const lobby of userLobbies) {
        if (lobby.status === "waiting") {
          // Marquer le joueur comme déconnecté
          await LobbyModel.updatePlayerStatus(lobby.id, userId, "disconnected");
          
          // Diffuser la mise à jour
          const lobbyInMemory = LobbyManager.getLobbyInMemory(lobby.id);
          if (lobbyInMemory) {
            await BroadcastManager.broadcastLobbyUpdate(lobby.id, lobbyInMemory);
          }
        }
      }
    } catch (error) {
      console.error("Erreur lors de la gestion de la déconnexion:", error);
    }
  }
}

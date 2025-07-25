import { WebSocket } from "@fastify/websocket";
import { APP_CONSTANTS } from "../../lib/config.js";
import * as LobbyModel from "../../models/lobbyModel.js";
import * as FriendService from "../../services/friendService.js";
import { LobbyCleanupService } from "../../services/lobby/lobbyCleanupService.js";
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
    // console.log("Nouvelle connexion WebSocket établie");

    // Confirmer la connexion
    sendSuccessResponse(
      socket,
      {
        message: "Connexion WebSocket établie",
      },
      APP_CONSTANTS.WEBSOCKET_MESSAGES.CONNECTED
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
      APP_CONSTANTS.WEBSOCKET_MESSAGES.AUTHENTICATED
    );
  }

  /**
   * Configure les gestionnaires d'événements pour une connexion
   */
  private static setupConnectionEventHandlers(
    socket: WebSocket,
    userId: string
  ): void {
    // Gestionnaire de fermeture de connexion
    socket.on("close", (code: number, reason: Buffer) => {
      this.handleConnectionClose(userId, code, reason);
    });

    // Gestionnaire d'erreur de connexion
    socket.on("error", (error: Error) => {
      this.handleConnectionError(userId, error);
    });
  }

  /**
   * Gère la fermeture d'une connexion
   */
  private static async handleConnectionClose(
    userId: string,
    code: number,
    reason: Buffer
  ): Promise<void> {
    removeConnection(userId);

    // Notifier les amis que l'utilisateur est hors ligne
    await FriendService.notifyFriendsOfStatusChange(userId, false);

    // Faire quitter le joueur des lobbies où il était
    await this.handlePlayerDisconnect(userId);

    // console.log(
    //   `WebSocket fermé - Code: ${code}, Raison: ${reason.toString()}`
    // );
  }

  /**
   * Gère une erreur de connexion
   */
  private static async handleConnectionError(
    userId: string,
    error: Error
  ): Promise<void> {
    removeConnection(userId);

    // Notifier les amis que l'utilisateur est hors ligne
    await FriendService.notifyFriendsOfStatusChange(userId, false);

    // Faire quitter le joueur des lobbies où il était
    await this.handlePlayerDisconnect(userId);

    // console.error("Erreur WebSocket:", error);
  }

  /**
   * Restaure l'utilisateur dans les lobbies où il était
   */
  private static async restoreUserInLobbies(userId: string): Promise<void> {
    // Éviter les restaurations multiples du même utilisateur
    if (this.restoredUsers.has(userId)) {
      console.log(
        `Utilisateur ${userId} déjà restauré, évitement de restauration multiple`
      );
      return;
    }

    try {
      // Marquer l'utilisateur comme en cours de restauration
      this.restoredUsers.add(userId);

      // Nettoyer le cache après 5 secondes pour permettre de nouvelles restaurations
      setTimeout(() => {
        this.restoredUsers.delete(userId);
      }, 5000);

      // Trouver tous les lobbies où l'utilisateur était présent
      const userLobbies = await LobbyModel.getLobbiesByPlayer(userId);

      for (const lobby of userLobbies) {
        try {
          // Vérifier si le lobby existe encore et est actif
          const lobbyInMemory = LobbyManager.getLobbyInMemory(lobby.id);
          if (!lobbyInMemory) {
            console.log(
              `Lobby ${lobby.id} non trouvé en mémoire, impossible de restaurer l'utilisateur`
            );
            continue; // Passer au lobby suivant au lieu de continuer
          }

          // Vérifier que le lobby n'est pas terminé ou supprimé
          if (lobby.status === "finished" || lobby.status === "deleted") {
            console.log(
              `Lobby ${lobby.id} est terminé ou supprimé (statut: ${lobby.status}), impossible de restaurer l'utilisateur`
            );
            continue;
          }

          console.log(
            `Restauration de l'utilisateur ${userId} dans le lobby ${lobby.id}`
          );

          // Récupérer les informations de l'utilisateur
          const { findUserById } = await import("../../models/userModel.js");
          const user = await findUserById(userId);

          if (!user) {
            console.log(
              `Utilisateur ${userId} non trouvé, impossible de le restaurer`
            );
            continue;
          }

          // Restaurer le joueur déconnecté en base de données
          await LobbyCleanupService.restoreDisconnectedPlayer(userId, lobby.id);

          // Mettre à jour l'activité du lobby
          await LobbyCleanupService.updateLobbyActivity(lobby.id);

          // Marquer le joueur comme présent
          const player = await LobbyModel.getPlayerInLobby(lobby.id, userId);
          if (player) {
            // Restaurer l'utilisateur dans le lobby en mémoire avec ses données complètes
            if (!lobbyInMemory.players.has(userId)) {
              console.log(
                `Ajout de l'utilisateur ${userId} au lobby ${lobby.id} en mémoire avec restauration des données`
              );

              // Récupérer les données complètes du joueur depuis la base de données
              const playerData = await LobbyModel.getPlayerInLobby(
                lobby.id,
                userId
              );
              console.log(`🔍 Restauration - Données récupérées de la DB:`, {
                userId,
                status: playerData?.status,
                score: playerData?.score,
                progress: playerData?.progress,
              });

              if (playerData) {
                // Restaurer le joueur avec ses données complètes
                lobbyInMemory.players.set(userId, {
                  name: user.name,
                  status: playerData.status || "joined",
                  score: playerData.score || 0,
                  progress: playerData.progress || 0,
                  validatedCountries: playerData.validatedCountries || [],
                  incorrectCountries: playerData.incorrectCountries || [],
                });

                console.log(
                  `✅ Joueur ${userId} restauré avec statut: ${playerData.status}, score: ${playerData.score}, progress: ${playerData.progress}`
                );
              } else {
                // Si pas de données en DB, créer un joueur par défaut sans diffuser
                console.log(
                  `Aucune donnée trouvée en DB pour ${userId}, création d'un joueur par défaut`
                );
                lobbyInMemory.players.set(userId, {
                  name: user.name,
                  status: "joined",
                  score: 0,
                  progress: 0,
                  validatedCountries: [],
                  incorrectCountries: [],
                });
              }
            } else {
              console.log(
                `Utilisateur ${userId} déjà présent dans le lobby ${lobby.id} en mémoire`
              );
            }
          }

          // Diffuser la mise à jour du lobby après restauration
          const { BroadcastManager } = await import(
            "../lobby/broadcastManager.js"
          );
          await BroadcastManager.broadcastLobbyUpdate(lobby.id, lobbyInMemory);
        } catch (error) {
          console.error(
            `Erreur lors de la restauration de l'utilisateur ${userId} dans le lobby ${lobby.id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(
        `Erreur lors de la restauration de l'utilisateur ${userId}:`,
        error
      );
    }
  }

  /**
   * Gère la déconnexion d'un joueur des lobbies
   */
  private static async handlePlayerDisconnect(userId: string): Promise<void> {
    // Éviter les déconnexions multiples rapides
    if (this.recentlyDisconnectedUsers.has(userId)) {
      console.log(
        `Joueur ${userId} déjà marqué comme déconnecté récemment, ignoré`
      );
      return;
    }

    // Ajouter à la liste des déconnexions récentes
    this.recentlyDisconnectedUsers.add(userId);
    setTimeout(() => {
      this.recentlyDisconnectedUsers.delete(userId);
    }, 5000); // 5 secondes

    try {
      // Trouver tous les lobbies où le joueur était présent
      const playerLobbies = await LobbyModel.getLobbiesByPlayer(userId);

      for (const lobby of playerLobbies) {
        try {
          // console.log(`Joueur ${userId} déconnecté du lobby ${lobby.id}`);

          // Marquer le joueur comme déconnecté en base de données
          await LobbyCleanupService.markPlayerAsDisconnected(userId, lobby.id);

          // Marquer le joueur comme déconnecté dans la mémoire
          const lobbyInMemory = LobbyManager.getLobbyInMemory(lobby.id);
          if (lobbyInMemory && lobbyInMemory.players.has(userId)) {
            console.log(
              `Marquage du joueur ${userId} comme déconnecté dans le lobby ${lobby.id} en mémoire`
            );
            // Le joueur reste en mémoire mais est marqué comme déconnecté
            // Il sera restauré lors de la reconnexion
          }

          // console.log(
          //   `Joueur ${userId} marqué comme déconnecté du lobby ${lobby.id} (déconnexion temporaire)`
          // );
        } catch (error) {
          console.error(
            `Erreur lors de la gestion de la déconnexion du joueur ${userId} du lobby ${lobby.id}:`,
            error
          );
        }
      }
    } catch (error) {
      console.error(
        `Erreur lors de la gestion de la déconnexion du joueur ${userId}:`,
        error
      );
    }
  }
}

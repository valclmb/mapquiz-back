import { WebSocket } from "@fastify/websocket";
import { APP_CONSTANTS } from "../../lib/config.js";
import * as FriendService from "../../services/friendService.js";
import { sendSuccessResponse } from "./authentication.js";
import { addConnection, removeConnection } from "./connectionManager.js";

/**
 * Gestionnaire de connexions WebSocket
 */
export class WebSocketConnectionHandler {
  /**
   * Gère l'établissement d'une nouvelle connexion
   */
  static handleNewConnection(socket: WebSocket): void {
    console.log("Nouvelle connexion WebSocket établie");

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

    console.log(
      `WebSocket fermé - Code: ${code}, Raison: ${reason.toString()}`
    );
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

    console.error("Erreur WebSocket:", error);
  }
}

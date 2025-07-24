import { WebSocket } from "@fastify/websocket";
import { APP_CONSTANTS } from "../../lib/config.js";
import { loggers } from "../../config/logger.js";
import { lobbyRepository } from "../../repositories/lobbyRepository.js";
import * as FriendService from "../../services/friendService.js";
import { LobbyCleanupService } from "../../services/lobby/lobbyCleanupService.js";
import * as LobbyManager from "../lobby/lobbyManager.js";
import { sendSuccessResponse } from "./authentication.js";
import { addConnection, removeConnection } from "./connectionManager.js";

/**
 * Gestionnaire optimisé des connexions WebSocket
 */
export class OptimizedConnectionHandler {
  private static userRestorationQueue = new Set<string>();
  private static disconnectionQueue = new Set<string>();

  /**
   * Gère l'établissement d'une nouvelle connexion
   */
  static handleNewConnection(socket: WebSocket): void {
    loggers.websocket.debug('Nouvelle connexion WebSocket établie');

    sendSuccessResponse(
      socket,
      { message: "Connexion WebSocket établie" },
      APP_CONSTANTS.WEBSOCKET_MESSAGES.CONNECTED
    );
  }

  /**
   * Gère l'authentification d'un utilisateur avec optimisations
   */
  static async handleAuthentication(
    socket: WebSocket,
    userId: string,
    request: any
  ): Promise<void> {
    try {
      // Ajouter la connexion
      addConnection(userId, socket);

      // Traitement asynchrone des opérations lourdes
      const [friendsNotified, userRestored] = await Promise.allSettled([
        this._notifyFriendsOfConnection(userId),
        this._restoreUserInLobbies(userId)
      ]);

      // Configurer les gestionnaires d'événements
      this._setupConnectionEventHandlers(socket, userId);

      // Logger les résultats
      loggers.websocket.info('Authentification réussie', {
        userId,
        friendsNotified: friendsNotified.status === 'fulfilled',
        userRestored: userRestored.status === 'fulfilled'
      });

      // Confirmer l'authentification
      sendSuccessResponse(
        socket,
        { 
          message: "Authentification réussie",
          userId,
          timestamp: new Date().toISOString()
        },
        APP_CONSTANTS.WEBSOCKET_MESSAGES.AUTHENTICATED
      );

    } catch (error) {
      loggers.websocket.error('Erreur lors de l\'authentification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      sendSuccessResponse(
        socket,
        { 
          message: "Erreur d'authentification",
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        APP_CONSTANTS.WEBSOCKET_MESSAGES.AUTHENTICATION_ERROR
      );
    }
  }

  /**
   * Gère la déconnexion d'un utilisateur
   */
  static async handleDisconnection(userId: string): Promise<void> {
    // Éviter les traitements multiples
    if (this.disconnectionQueue.has(userId)) {
      return;
    }

    this.disconnectionQueue.add(userId);

    try {
      loggers.websocket.info('Début de la déconnexion', { userId });

      // Supprimer la connexion
      removeConnection(userId);

      // Notifier les amis (asynchrone)
      this._notifyFriendsOfDisconnection(userId).catch(error => {
        loggers.websocket.error('Erreur notification amis déconnexion', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });

      // Planifier le nettoyage des lobbies avec délai
      setTimeout(() => {
        this._scheduleUserCleanup(userId);
      }, APP_CONSTANTS.TIMEOUTS.PLAYER_DISCONNECT_TIMEOUT);

    } finally {
      this.disconnectionQueue.delete(userId);
    }
  }

  /**
   * Notifie les amis de la connexion (optimisé)
   */
  private static async _notifyFriendsOfConnection(userId: string): Promise<void> {
    try {
      await FriendService.notifyFriendsOfStatusChange(userId, true);
      loggers.websocket.debug('Amis notifiés de la connexion', { userId });
    } catch (error) {
      loggers.websocket.error('Erreur notification amis connexion', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Notifie les amis de la déconnexion (optimisé)
   */
  private static async _notifyFriendsOfDisconnection(userId: string): Promise<void> {
    try {
      await FriendService.notifyFriendsOfStatusChange(userId, false);
      loggers.websocket.debug('Amis notifiés de la déconnexion', { userId });
    } catch (error) {
      loggers.websocket.error('Erreur notification amis déconnexion', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Restaure l'utilisateur dans les lobbies avec protection contre les doublons
   */
  private static async _restoreUserInLobbies(userId: string): Promise<void> {
    // Éviter les restaurations multiples
    if (this.userRestorationQueue.has(userId)) {
      return;
    }

    this.userRestorationQueue.add(userId);

    try {
      await LobbyCleanupService.restoreUserInLobbies(userId);
      loggers.websocket.debug('Utilisateur restauré dans les lobbies', { userId });
    } catch (error) {
      loggers.websocket.error('Erreur restauration lobbies', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      this.userRestorationQueue.delete(userId);
    }
  }

  /**
   * Configure les gestionnaires d'événements de la connexion
   */
  private static _setupConnectionEventHandlers(socket: WebSocket, userId: string): void {
    const handlers = {
      close: () => this._handleSocketClose(userId),
      error: (error: Error) => this._handleSocketError(userId, error),
      ping: () => this._handlePing(socket),
      pong: () => this._handlePong(userId)
    };

    // Attacher les gestionnaires
    Object.entries(handlers).forEach(([event, handler]) => {
      socket.on(event, handler);
    });

    // Configurer le heartbeat
    this._setupHeartbeat(socket, userId);
  }

  /**
   * Gère la fermeture de socket
   */
  private static _handleSocketClose(userId: string): void {
    loggers.websocket.debug('Socket fermé', { userId });
    this.handleDisconnection(userId);
  }

  /**
   * Gère les erreurs de socket
   */
  private static _handleSocketError(userId: string, error: Error): void {
    loggers.websocket.error('Erreur socket', {
      userId,
      error: error.message
    });
  }

  /**
   * Gère les ping WebSocket
   */
  private static _handlePing(socket: WebSocket): void {
    socket.pong();
  }

  /**
   * Gère les pong WebSocket
   */
  private static _handlePong(userId: string): void {
    loggers.websocket.debug('Pong reçu', { userId });
  }

  /**
   * Configure le système de heartbeat
   */
  private static _setupHeartbeat(socket: WebSocket, userId: string): void {
    const pingInterval = setInterval(() => {
      if (socket.readyState === socket.OPEN) {
        socket.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, APP_CONSTANTS.TIMEOUTS.WEBSOCKET_PING_INTERVAL);

    // Nettoyer l'intervalle à la fermeture
    socket.on('close', () => {
      clearInterval(pingInterval);
    });
  }

  /**
   * Planifie le nettoyage de l'utilisateur
   */
  private static _scheduleUserCleanup(userId: string): void {
    LobbyCleanupService.schedulePlayerCleanup(userId)
      .catch(error => {
        loggers.websocket.error('Erreur nettoyage utilisateur', {
          userId,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
  }

  /**
   * Obtient les statistiques de connexion
   */
  static getConnectionStats(): {
    restorationQueueSize: number;
    disconnectionQueueSize: number;
  } {
    return {
      restorationQueueSize: this.userRestorationQueue.size,
      disconnectionQueueSize: this.disconnectionQueue.size
    };
  }

  /**
   * Nettoie les files d'attente (utile pour les tests)
   */
  static clearQueues(): void {
    this.userRestorationQueue.clear();
    this.disconnectionQueue.clear();
  }
}
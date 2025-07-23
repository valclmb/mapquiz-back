import { WebSocket } from "@fastify/websocket";
import * as WebSocketController from "../../controllers/websocketController.js";
import { APP_CONSTANTS } from "../../lib/config.js";
import {
  WebSocketMessage,
  WebSocketResponse,
  WS_MESSAGE_TYPES,
} from "../../types/websocket.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../core/authentication.js";

/**
 * Gestionnaire de messages WebSocket
 */
export class WebSocketMessageHandler {
  /**
   * Vérifie si l'utilisateur est authentifié
   */
  private static requireAuth(
    userId: string | null,
    socket: WebSocket
  ): boolean {
    if (!userId) {
      sendErrorResponse(socket, "Authentification requise");
      return false;
    }
    return true;
  }

  /**
   * Traite un message WebSocket
   */
  static async handleMessage(
    message: WebSocketMessage,
    socket: WebSocket,
    userId: string | null
  ): Promise<void> {
    const { type, payload } = message;

    try {
      let result: any;

      switch (type) {
        case WS_MESSAGE_TYPES.PING:
          this.handlePing(socket);
          return;

        case WS_MESSAGE_TYPES.AUTHENTICATE:
          // L'authentification est gérée séparément
          return;

        case WS_MESSAGE_TYPES.SEND_FRIEND_REQUEST:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleSendFriendRequest(
            payload,
            userId!
          );
          break;

        case WS_MESSAGE_TYPES.RESPOND_FRIEND_REQUEST:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleRespondFriendRequest(
            payload,
            userId!
          );
          break;

        case WS_MESSAGE_TYPES.CREATE_LOBBY:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleCreateLobby(
            payload,
            userId!
          );
          break;

        case WS_MESSAGE_TYPES.INVITE_TO_LOBBY:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleInviteToLobby(
            payload,
            userId!
          );
          break;

        case WS_MESSAGE_TYPES.JOIN_LOBBY:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleJoinLobby(payload, userId!);
          break;

        case WS_MESSAGE_TYPES.LEAVE_LOBBY:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleLeaveLobby(payload, userId!);
          break;

        case WS_MESSAGE_TYPES.UPDATE_LOBBY_SETTINGS:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleUpdateLobbySettings(
            payload,
            userId!
          );
          break;

        case WS_MESSAGE_TYPES.SET_PLAYER_READY:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleSetPlayerReady(
            payload,
            userId!
          );
          break;

        case WS_MESSAGE_TYPES.START_GAME:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleStartGame(payload, userId!);
          break;

        case WS_MESSAGE_TYPES.UPDATE_GAME_PROGRESS:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleUpdateGameProgress(
            payload,
            userId!
          );
          break;

        case WS_MESSAGE_TYPES.UPDATE_PLAYER_PROGRESS:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleUpdatePlayerProgress(
            payload,
            userId!
          );
          break;

        case WS_MESSAGE_TYPES.LEAVE_GAME:
          if (!this.requireAuth(userId, socket)) return;
          result = await WebSocketController.handleLeaveGame(payload, userId!);
          break;

        case WS_MESSAGE_TYPES.GET_GAME_STATE:
          if (!this.requireAuth(userId, socket)) return;
          result = await this.handleGetGameState(payload, userId!);
          break;

        case WS_MESSAGE_TYPES.GET_LOBBY_STATE:
          if (!this.requireAuth(userId, socket)) return;
          result = await this.handleGetLobbyState(payload, userId!);
          break;

        case WS_MESSAGE_TYPES.GET_GAME_RESULTS:
          if (!this.requireAuth(userId, socket)) return;
          result = await this.handleGetGameResults(payload, userId!);
          break;

        case WS_MESSAGE_TYPES.RESTART_GAME:
          if (!this.requireAuth(userId, socket)) return;
          result = await this.handleRestartGame(payload, userId!);
          break;

        default:
          sendErrorResponse(socket, `Type de message non supporté: ${type}`);
          return;
      }

      // Envoyer la réponse de succès
      if (result) {
        const lobbyId = payload?.lobbyId;
        sendSuccessResponse(socket, result, `${type}_success`, lobbyId);
      }
    } catch (error) {
      console.error("Erreur lors du traitement du message:", error);
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";

      // Extraire le lobbyId du payload si disponible
      const lobbyId = payload?.lobbyId;
      sendErrorResponse(socket, errorMessage, "error", lobbyId);
    }
  }

  /**
   * Gère les messages ping
   */
  private static handlePing(socket: WebSocket): void {
    const response: WebSocketResponse = {
      type: APP_CONSTANTS.WEBSOCKET_MESSAGES.PONG,
      data: { timestamp: Date.now() },
    };
    socket.send(JSON.stringify(response));
  }

  /**
   * Gère la récupération de l'état du jeu
   */
  private static async handleGetGameState(
    payload: any,
    userId: string
  ): Promise<any> {
    const { lobbyId } = payload;
    if (!lobbyId) {
      throw new Error("lobbyId requis");
    }

    // console.log(
    //   `Demande d'état du jeu pour le lobby ${lobbyId} par l'utilisateur ${userId}`
    // );

    try {
      // Utiliser directement le service de lobby pour récupérer l'état du jeu
      const { LobbyService } = await import("../../services/lobbyService.js");
      const gameState = await LobbyService.getGameState(lobbyId, userId);

      if (!gameState) {
        // console.log(`Aucun état de jeu trouvé pour le lobby ${lobbyId}`);
        return {
          lobbyId,
          gameState: null,
          message: "Aucun état de jeu disponible",
        };
      }

      // console.log(`État du jeu récupéré avec succès pour le lobby ${lobbyId}`);
      // console.log(
      //   "Structure du gameState envoyé:",
      //   JSON.stringify(gameState, null, 2)
      // );

      return {
        lobbyId,
        gameState,
      };
    } catch (error) {
      console.error(
        `Erreur lors de la récupération de l'état du jeu pour le lobby ${lobbyId}:`,
        error
      );
      throw new Error(
        `Impossible de récupérer l'état du jeu: ${error instanceof Error ? error.message : "Erreur inconnue"}`
      );
    }
  }

  /**
   * Gère la récupération de l'état du lobby (sans l'état du jeu complet)
   */
  private static async handleGetLobbyState(
    payload: any,
    userId: string
  ): Promise<any> {
    const { lobbyId } = payload;
    if (!lobbyId) {
      throw new Error("lobbyId requis");
    }

    try {
      const { LobbyService } = await import("../../services/lobbyService.js");
      const lobbyState = await LobbyService.getLobbyState(lobbyId, userId);

      return {
        lobbyId,
        lobbyState,
      };
    } catch (error) {
      console.error(
        `Erreur lors de la récupération de l'état du lobby ${lobbyId}:`,
        error
      );
      throw new Error(
        `Impossible de récupérer l'état du lobby: ${error instanceof Error ? error.message : "Erreur inconnue"}`
      );
    }
  }

  /**
   * Gère la récupération des résultats de jeu
   */
  private static async handleGetGameResults(
    payload: any,
    userId: string
  ): Promise<any> {
    const { lobbyId } = payload;
    if (!lobbyId) {
      throw new Error("lobbyId requis");
    }

    try {
      const { LobbyService } = await import("../../services/lobbyService.js");
      const results = await LobbyService.getGameResults(lobbyId, userId);

      return {
        lobbyId,
        rankings: results.rankings,
        hostId: results.hostId,
      };
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des résultats pour le lobby ${lobbyId}:`,
        error
      );
      throw new Error(
        `Impossible de récupérer les résultats: ${error instanceof Error ? error.message : "Erreur inconnue"}`
      );
    }
  }

  /**
   * Gère le redémarrage d'une partie
   */
  private static async handleRestartGame(
    payload: any,
    userId: string
  ): Promise<any> {
    const { lobbyId } = payload;
    if (!lobbyId) {
      throw new Error("lobbyId requis");
    }

    try {
      const { LobbyService } = await import("../../services/lobbyService.js");
      await LobbyService.restartGame(userId, lobbyId);

      // Diffuser un message de confirmation à tous les joueurs
      const { BroadcastManager } = await import("../lobby/broadcastManager.js");
      const { getLobbyInMemory } = await import("../lobby/lobbyManager.js");

      const lobby = getLobbyInMemory(lobbyId);
      if (lobby) {
        // Diffuser un message de restart à tous les joueurs
        const restartMessage = {
          type: "game_restarted",
          payload: {
            lobbyId,
            message: "Partie redémarrée par l'hôte",
          },
        };

        for (const [playerId] of lobby.players) {
          const { sendToUser } = await import("../core/connectionManager.js");
          sendToUser(playerId, restartMessage);
        }
      }

      return {
        lobbyId,
        message: "Partie redémarrée avec succès",
      };
    } catch (error) {
      console.error(
        `Erreur lors du redémarrage de la partie pour le lobby ${lobbyId}:`,
        error
      );
      throw new Error(
        `Impossible de redémarrer la partie: ${error instanceof Error ? error.message : "Erreur inconnue"}`
      );
    }
  }
}

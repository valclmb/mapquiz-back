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

        default:
          sendErrorResponse(socket, `Type de message non supporté: ${type}`);
          return;
      }

      // Envoyer la réponse de succès
      if (result) {
        sendSuccessResponse(socket, result, `${type}_success`);
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

    console.log(
      `Demande d'état du jeu pour le lobby ${lobbyId} par l'utilisateur ${userId}`
    );

    try {
      // Utiliser directement le service de lobby pour récupérer l'état du jeu
      const { LobbyService } = await import("../../services/lobbyService.js");
      const gameState = await LobbyService.getGameState(lobbyId, userId);

      if (!gameState) {
        console.log(`Aucun état de jeu trouvé pour le lobby ${lobbyId}`);
        return {
          lobbyId,
          gameState: null,
          message: "Aucun état de jeu disponible",
        };
      }

      console.log(`État du jeu récupéré avec succès pour le lobby ${lobbyId}`);
      console.log(
        "Structure du gameState envoyé:",
        JSON.stringify(gameState, null, 2)
      );

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
}

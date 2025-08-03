import { WebSocket } from "@fastify/websocket";
import {
  handleRespondFriendRequest,
  handleSendFriendRequest,
} from "../../controllers/websocketController.js";
import { getLobby } from "../../models/lobbyModel.js";
import { WS_MESSAGE_TYPES } from "../../types/websocket.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../core/authentication.js";
import {
  addPlayerToLobby,
  getGameState,
  LobbyManager,
  removePlayerFromLobby,
  restartLobby,
  startGame,
  updatePlayerProgress,
  updatePlayerScore,
  updatePlayerStatus as updatePlayerStatusInLobby,
} from "../lobby/lobbyManager.js";

// Types pour les handlers
type MessageHandler = (
  payload: any,
  userId: string,
  socket: WebSocket
) => Promise<any>;

// Map des handlers par type de message
const messageHandlers = new Map<string, MessageHandler>([
  // Handlers pour les amis
  [
    WS_MESSAGE_TYPES.SEND_FRIEND_REQUEST,
    async (payload, userId) => {
      return await handleSendFriendRequest(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.RESPOND_FRIEND_REQUEST,
    async (payload, userId) => {
      return await handleRespondFriendRequest(payload, userId);
    },
  ],

  // Handlers pour les lobbies
  [
    WS_MESSAGE_TYPES.CREATE_LOBBY,
    async (payload, userId) => {
      const { name, settings } = payload;
      return await LobbyManager.createLobby(userId, name, settings);
    },
  ],

  [
    WS_MESSAGE_TYPES.JOIN_LOBBY,
    async (payload, userId) => {
      const { lobbyId } = payload;
      const success = await addPlayerToLobby(lobbyId, userId, "User");
      return { success };
    },
  ],

  [
    WS_MESSAGE_TYPES.LEAVE_LOBBY,
    async (payload, userId) => {
      const { lobbyId } = payload;
      const success = await removePlayerFromLobby(lobbyId, userId);
      return { success };
    },
  ],

  [
    WS_MESSAGE_TYPES.UPDATE_LOBBY_SETTINGS,
    async (payload, userId) => {
      const { lobbyId, settings } = payload;
      // Logique de mise à jour des paramètres du lobby
      return { success: true };
    },
  ],

  [
    WS_MESSAGE_TYPES.SET_PLAYER_READY,
    async (payload, userId) => {
      const { lobbyId, ready } = payload;
      const status = ready ? "ready" : "joined";
      const success = await updatePlayerStatusInLobby(lobbyId, userId, status);
      return { success };
    },
  ],

  [
    WS_MESSAGE_TYPES.START_GAME,
    async (payload, userId) => {
      const { lobbyId } = payload;
      const success = await startGame(lobbyId);
      return { success };
    },
  ],

  // Handlers pour le jeu
  [
    WS_MESSAGE_TYPES.UPDATE_GAME_PROGRESS,
    async (payload, userId) => {
      const { lobbyId, score, progress, answerTime, isConsecutiveCorrect } =
        payload;
      const success = await updatePlayerScore(
        lobbyId,
        userId,
        score,
        progress,
        answerTime,
        isConsecutiveCorrect
      );
      return { success };
    },
  ],

  [
    WS_MESSAGE_TYPES.UPDATE_PLAYER_PROGRESS,
    async (payload, userId) => {
      const {
        lobbyId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions,
      } = payload;
      const success = await updatePlayerProgress(
        lobbyId,
        userId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions
      );
      return { success };
    },
  ],

  [
    WS_MESSAGE_TYPES.GET_GAME_STATE,
    async (payload, userId) => {
      const { lobbyId } = payload;
      const gameState = getGameState(lobbyId, userId);
      return { success: true, gameState };
    },
  ],

  [
    WS_MESSAGE_TYPES.GET_LOBBY_STATE,
    async (payload, userId) => {
      const { lobbyId } = payload;
      const lobby = await getLobby(lobbyId);
      return { success: true, lobby };
    },
  ],

  [
    WS_MESSAGE_TYPES.RESTART_GAME,
    async (payload, userId) => {
      const { lobbyId } = payload;
      const success = await restartLobby(lobbyId);
      return { success };
    },
  ],

  [
    WS_MESSAGE_TYPES.LEAVE_GAME,
    async (payload, userId) => {
      const { lobbyId } = payload;
      const success = await removePlayerFromLobby(lobbyId, userId);
      return { success };
    },
  ],

  [
    WS_MESSAGE_TYPES.REMOVE_PLAYER,
    async (payload, userId) => {
      const { lobbyId, playerId } = payload;
      const success = await removePlayerFromLobby(lobbyId, playerId);
      return { success };
    },
  ],

  [
    "update_player_status",
    async (payload, userId) => {
      const { lobbyId, status } = payload;
      const success = await updatePlayerStatusInLobby(lobbyId, userId, status);
      return { success };
    },
  ],
]);

/**
 * Gestionnaire de messages WebSocket
 */
export class WebSocketMessageHandler {
  /**
   * Vérifie si l'authentification est requise
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
    message: any,
    socket: WebSocket,
    userId: string | null
  ): Promise<void> {
    const { type, payload } = message;

    // Gestion spéciale pour le ping
    if (type === WS_MESSAGE_TYPES.PING) {
      this.handlePing(socket);
      return;
    }

    // Vérifier l'authentification pour tous les autres messages
    if (!this.requireAuth(userId, socket)) {
      return;
    }

    // Trouver le handler approprié
    const handler = messageHandlers.get(type);
    if (!handler) {
      sendErrorResponse(socket, `Type de message non supporté: ${type}`);
      return;
    }

    try {
      // Exécuter le handler
      const result = await handler(payload, userId!, socket);

      // Envoyer la réponse de succès
      sendSuccessResponse(socket, result, type);
    } catch (error) {
      console.error(`Erreur lors du traitement du message ${type}:`, error);
      const errorMessage =
        error instanceof Error ? error.message : "Erreur inconnue";
      sendErrorResponse(socket, errorMessage);
    }
  }

  /**
   * Gère les messages ping
   */
  private static handlePing(socket: WebSocket): void {
    socket.send(JSON.stringify({ type: "pong" }));
  }
}

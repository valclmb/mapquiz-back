import { WebSocket } from "@fastify/websocket";
import {
  handleCreateLobby,
  handleGetGameResults,
  handleGetGameState,
  handleGetLobbyState,
  handleInviteToLobby,
  handleJoinLobby,
  handleLeaveGame,
  handleLeaveLobby,
  handleRemovePlayer,
  handleRespondFriendRequest,
  handleRestartGame,
  handleSendFriendRequest,
  handleSetPlayerReady,
  handleStartGame,
  handleUpdateGameProgress,
  handleUpdateLobbySettings,
  handleUpdatePlayerProgress,
  handleUpdatePlayerStatus,
} from "../../controllers/websocketController.js";
import { WS_MESSAGE_TYPES } from "../../types/websocket.js";
import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../core/authentication.js";
import { BroadcastManager } from "../lobby/broadcastManager.js";
import { LobbyLifecycleManager } from "../lobby/lobbyLifecycle.js";

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
      return await handleCreateLobby(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.INVITE_TO_LOBBY,
    async (payload, userId) => {
      return await handleInviteToLobby(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.JOIN_LOBBY,
    async (payload, userId) => {
      return await handleJoinLobby(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.LEAVE_LOBBY,
    async (payload, userId) => {
      return await handleLeaveLobby(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.UPDATE_LOBBY_SETTINGS,
    async (payload, userId) => {
      return await handleUpdateLobbySettings(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.SET_PLAYER_READY,
    async (payload, userId) => {
      return await handleSetPlayerReady(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.START_GAME,
    async (payload, userId) => {
      return await handleStartGame(payload, userId);
    },
  ],

  // Handlers pour le jeu
  [
    WS_MESSAGE_TYPES.UPDATE_GAME_PROGRESS,
    async (payload, userId) => {
      return await handleUpdateGameProgress(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.UPDATE_PLAYER_PROGRESS,
    async (payload, userId) => {
      return await handleUpdatePlayerProgress(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.GET_GAME_STATE,
    async (payload, userId) => {
      return await handleGetGameState(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.GET_LOBBY_STATE,
    async (payload, userId) => {
      return await handleGetLobbyState(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.GET_GAME_RESULTS,
    async (payload, userId) => {
      return await handleGetGameResults(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.RESTART_GAME,
    async (payload, userId) => {
      return await handleRestartGame(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.LEAVE_GAME,
    async (payload, userId) => {
      return await handleLeaveGame(payload, userId);
    },
  ],

  [
    WS_MESSAGE_TYPES.REMOVE_PLAYER,
    async (payload, userId) => {
      return await handleRemovePlayer(payload, userId);
    },
  ],

  [
    "update_player_status",
    async (payload, userId) => {
      return await handleUpdatePlayerStatus(payload, userId);
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
      sendSuccessResponse(socket, result, `${type}_success`);

      // Ajout du broadcast après la réponse de succès pour update_player_status
      if (type === "update_player_status" && payload?.lobbyId) {
        const lobby = LobbyLifecycleManager.getLobbyInMemory(payload.lobbyId);
        if (lobby) {
          await BroadcastManager.broadcastLobbyUpdate(payload.lobbyId, lobby);
        }
      }
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

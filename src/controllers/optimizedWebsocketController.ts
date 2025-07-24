import { loggers } from "../config/logger.js";
import { ValidationError } from "../lib/errors.js";
import { 
  validateLobbyId, 
  validateUserId, 
  validateCreateLobbyRequest,
  validateUpdateLobbySettingsRequest,
  validateGameProgressRequest,
  validatePlayerProgressRequest,
  validateAddFriendRequest,
  validateFriendRequestActionRequest
} from "../lib/validation.js";
import * as FriendService from "../services/friendService.js";
import { LobbyService } from "../services/lobby/lobbyService.js";

/**
 * Type pour les gestionnaires d'événements WebSocket
 */
type WebSocketHandler = (payload: any, userId: string) => Promise<any>;

/**
 * Décorateur pour la validation et gestion d'erreurs
 */
function withValidation(
  validator: (payload: any) => any,
  handler: WebSocketHandler
): WebSocketHandler {
  return async (payload: any, userId: string) => {
    try {
      const validatedPayload = validator(payload);
      return await handler(validatedPayload, userId);
    } catch (error) {
      loggers.websocket.error('Erreur de validation WebSocket', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error',
        payload
      });
      throw error;
    }
  };
}

/**
 * Contrôleur optimisé pour les événements WebSocket
 */
export class OptimizedWebSocketController {

  // ========== GESTION DES AMIS ==========

  /**
   * Envoie une demande d'ami
   */
  static handleSendFriendRequest = withValidation(
    (payload) => {
      if (!payload?.receiverTag) {
        throw new ValidationError("receiverTag requis");
      }
      return validateAddFriendRequest({ tag: payload.receiverTag });
    },
    async (validatedPayload, userId) => {
      return await FriendService.sendFriendRequest(userId, validatedPayload.tag);
    }
  );

  /**
   * Répond à une demande d'ami
   */
  static handleRespondFriendRequest = withValidation(
    (payload) => {
      if (!payload?.requestId || !payload?.action) {
        throw new ValidationError("requestId et action requis");
      }
      return {
        requestId: payload.requestId,
        ...validateFriendRequestActionRequest({ action: payload.action })
      };
    },
    async (validatedPayload, userId) => {
      return await FriendService.respondToFriendRequest(
        validatedPayload.requestId,
        validatedPayload.action,
        userId
      );
    }
  );

  // ========== GESTION DES LOBBIES ==========

  /**
   * Crée un nouveau lobby
   */
  static handleCreateLobby = withValidation(
    (payload) => validateCreateLobbyRequest(payload),
    async (validatedPayload, userId) => {
      return await LobbyService.createLobby(
        userId,
        validatedPayload.name,
        validatedPayload.settings
      );
    }
  );

  /**
   * Invite un ami dans un lobby
   */
  static handleInviteToLobby = withValidation(
    (payload) => {
      if (!payload?.lobbyId || !payload?.friendId) {
        throw new ValidationError("lobbyId et friendId requis");
      }
      return {
        lobbyId: validateLobbyId(payload.lobbyId),
        friendId: validateUserId(payload.friendId)
      };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.inviteToLobby(
        userId,
        validatedPayload.lobbyId,
        validatedPayload.friendId
      );
    }
  );

  /**
   * Rejoint un lobby
   */
  static handleJoinLobby = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      return { lobbyId: validateLobbyId(payload.lobbyId) };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.joinLobby(userId, validatedPayload.lobbyId);
    }
  );

  /**
   * Quitte un lobby
   */
  static handleLeaveLobby = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      return { lobbyId: validateLobbyId(payload.lobbyId) };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.leaveLobby(userId, validatedPayload.lobbyId);
    }
  );

  /**
   * Met à jour les paramètres du lobby
   */
  static handleUpdateLobbySettings = withValidation(
    (payload) => {
      if (!payload?.lobbyId || !payload?.settings) {
        throw new ValidationError("lobbyId et settings requis");
      }
      return {
        lobbyId: validateLobbyId(payload.lobbyId),
        settings: validateUpdateLobbySettingsRequest({ settings: payload.settings }).settings
      };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.updateLobbySettings(
        userId,
        validatedPayload.lobbyId,
        validatedPayload.settings
      );
    }
  );

  /**
   * Met à jour le statut de préparation d'un joueur
   */
  static handleSetPlayerReady = withValidation(
    (payload) => {
      if (!payload?.lobbyId || typeof payload?.ready !== 'boolean') {
        throw new ValidationError("lobbyId et ready (boolean) requis");
      }
      return {
        lobbyId: validateLobbyId(payload.lobbyId),
        ready: payload.ready
      };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.setPlayerReady(
        userId,
        validatedPayload.lobbyId,
        validatedPayload.ready
      );
    }
  );

  // ========== GESTION DU JEU ==========

  /**
   * Démarre une partie
   */
  static handleStartGame = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      return { lobbyId: validateLobbyId(payload.lobbyId) };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.startGame(userId, validatedPayload.lobbyId);
    }
  );

  /**
   * Met à jour la progression du jeu
   */
  static handleUpdateGameProgress = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      const gameProgress = validateGameProgressRequest({
        score: payload.score,
        progress: payload.progress || 0,
        answerTime: payload.answerTime,
        isConsecutiveCorrect: payload.isConsecutiveCorrect
      });
      return {
        lobbyId: validateLobbyId(payload.lobbyId),
        ...gameProgress
      };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.updateGameProgress(
        userId,
        validatedPayload.lobbyId,
        validatedPayload.score,
        validatedPayload.answerTime,
        validatedPayload.isConsecutiveCorrect
      );
    }
  );

  /**
   * Met à jour la progression détaillée du joueur
   */
  static handleUpdatePlayerProgress = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      const playerProgress = validatePlayerProgressRequest({
        validatedCountries: payload.validatedCountries || [],
        incorrectCountries: payload.incorrectCountries || [],
        score: payload.score,
        progress: payload.progress || 0
      });
      return {
        lobbyId: validateLobbyId(payload.lobbyId),
        totalQuestions: payload.totalQuestions || playerProgress.validatedCountries.length + playerProgress.incorrectCountries.length,
        ...playerProgress
      };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.updatePlayerProgress(
        userId,
        validatedPayload.lobbyId,
        validatedPayload.validatedCountries,
        validatedPayload.incorrectCountries,
        validatedPayload.score,
        validatedPayload.totalQuestions
      );
    }
  );

  /**
   * Quitte une partie en cours
   */
  static handleLeaveGame = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      return { lobbyId: validateLobbyId(payload.lobbyId) };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.leaveGame(userId, validatedPayload.lobbyId);
    }
  );

  // ========== MÉTHODES UTILITAIRES ==========

  /**
   * Récupère l'état du lobby
   */
  static handleGetLobbyState = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      return { lobbyId: validateLobbyId(payload.lobbyId) };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.getLobbyState(validatedPayload.lobbyId, userId);
    }
  );

  /**
   * Récupère l'état du jeu
   */
  static handleGetGameState = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      return { lobbyId: validateLobbyId(payload.lobbyId) };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.getGameState(validatedPayload.lobbyId, userId);
    }
  );

  /**
   * Récupère les résultats de la partie
   */
  static handleGetGameResults = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      return { lobbyId: validateLobbyId(payload.lobbyId) };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.getGameResults(validatedPayload.lobbyId, userId);
    }
  );

  /**
   * Redémarre une partie
   */
  static handleRestartGame = withValidation(
    (payload) => {
      if (!payload?.lobbyId) {
        throw new ValidationError("lobbyId requis");
      }
      return { lobbyId: validateLobbyId(payload.lobbyId) };
    },
    async (validatedPayload, userId) => {
      return await LobbyService.restartGame(userId, validatedPayload.lobbyId);
    }
  );
}
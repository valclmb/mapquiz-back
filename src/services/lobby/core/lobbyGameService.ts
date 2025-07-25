import { loggers } from "../../../config/logger.js";
import { APP_CONSTANTS } from "../../../lib/config.js";
import { LobbyError } from "../../../lib/errors.js";
import {
  validateGameProgressRequest,
  validateLobbyId,
  validatePlayerProgressRequest,
  validateUserId,
} from "../../../lib/validation.js";
import { lobbyRepository } from "../../../repositories/lobbyRepository.js";
import { LobbyManager } from "../../../websocket/lobby/lobbyManagerStub.js";

/**
 * Service dédié à la gestion du jeu dans les lobbies
 */
export class LobbyGameService {
  /**
   * Démarre une partie
   */
  static async startGame(userId: string, lobbyId: string) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    // Vérifier que l'utilisateur est l'hôte
    if (lobby.hostId !== validatedUserId) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    // S'assurer que l'hôte est marqué comme prêt
    await lobbyRepository.updatePlayerStatus(
      validatedLobbyId,
      validatedUserId,
      APP_CONSTANTS.PLAYER_STATUS.READY
    );

    // Mettre à jour le statut du lobby
    await lobbyRepository.updateStatus(
      validatedLobbyId,
      APP_CONSTANTS.LOBBY_STATUS.PLAYING
    );

    // Démarrer le jeu en mémoire
    LobbyManager.startGame(validatedLobbyId);

    // Diffuser le démarrage
    // await BroadcastManager.broadcastGameStart(validatedLobbyId, { started: true });

    loggers.game.info("Partie démarrée", {
      lobbyId: validatedLobbyId,
      hostId: validatedUserId,
      playersCount: lobby.players.length,
    });

    return {
      success: true,
      message: "Partie démarrée avec succès",
      gameState: LobbyManager.getGameState(validatedLobbyId),
    };
  }

  /**
   * Met à jour les paramètres du lobby
   */
  static async updateLobbySettings(
    userId: string,
    lobbyId: string,
    settings: any
  ) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    // Vérifier que l'utilisateur est l'hôte
    if (lobby.hostId !== validatedUserId) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    // Mettre à jour en base de données
    await lobbyRepository.updateSettings(validatedLobbyId, settings);

    // Mettre à jour en mémoire
    LobbyManager.updateLobbySettings(validatedLobbyId, settings);

    // Diffuser la mise à jour
    // await BroadcastManager.broadcastLobbyUpdate(validatedLobbyId, lobby);

    loggers.game.debug("Paramètres du lobby mis à jour", {
      lobbyId: validatedLobbyId,
      settings,
    });

    return { success: true, settings };
  }

  /**
   * Met à jour la progression du jeu
   */
  static async updateGameProgress(
    userId: string,
    lobbyId: string,
    score: number,
    answerTime?: number,
    isConsecutiveCorrect?: boolean
  ) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    // Validation des données de progression
    const progressData = validateGameProgressRequest({
      score,
      progress: 0, // À calculer
      answerTime,
      isConsecutiveCorrect,
    });

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    // Vérifier que le joueur est dans le lobby
    const player = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (!player) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.PLAYER_NOT_IN_LOBBY);
    }

    // Mettre à jour la progression en mémoire
    const updated = LobbyManager.updatePlayerProgress(
      validatedLobbyId,
      validatedUserId,
      {
        score: progressData.score,
        answerTime: progressData.answerTime,
        isConsecutiveCorrect: progressData.isConsecutiveCorrect,
      }
    );

    if (updated) {
      // Diffuser la mise à jour de progression
      // await BroadcastManager.broadcastGameProgress(validatedLobbyId, validatedUserId, {
      //   score: progressData.score,
      //   answerTime: progressData.answerTime,
      //   isConsecutiveCorrect: progressData.isConsecutiveCorrect
      // });
    }

    return { success: true, updated };
  }

  /**
   * Met à jour la progression détaillée du joueur
   */
  static async updatePlayerProgress(
    userId: string,
    lobbyId: string,
    validatedCountries: string[],
    incorrectCountries: string[],
    score: number,
    totalQuestions: number
  ) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    // Validation des données
    const progressData = validatePlayerProgressRequest({
      validatedCountries,
      incorrectCountries,
      score,
      progress: Math.round((validatedCountries.length / totalQuestions) * 100),
    });

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    // Vérifier que le joueur est dans le lobby
    const player = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (!player) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.PLAYER_NOT_IN_LOBBY);
    }

    // Mettre à jour en base de données
    await lobbyRepository.updatePlayerProgress(
      validatedLobbyId,
      validatedUserId,
      {
        validatedCountries: progressData.validatedCountries,
        incorrectCountries: progressData.incorrectCountries,
        score: progressData.score,
      }
    );

    // Mettre à jour en mémoire
    LobbyManager.updatePlayerProgress(validatedLobbyId, validatedUserId, {
      validatedCountries: progressData.validatedCountries,
      incorrectCountries: progressData.incorrectCountries,
      score: progressData.score,
      progress: progressData.progress,
    });

    // Diffuser la mise à jour
    // await BroadcastManager.broadcastPlayerProgress(validatedLobbyId, validatedUserId, progressData);

    return { success: true, progress: progressData.progress };
  }

  /**
   * Récupère l'état du lobby
   */
  static async getLobbyState(lobbyId: string, userId: string) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    // Vérifier que le joueur est autorisé
    if (!lobby.authorizedPlayers.includes(validatedUserId)) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    // Obtenir l'état depuis la mémoire (plus rapide)
    const memoryState = LobbyManager.getLobbyState(validatedLobbyId);

    if (memoryState) {
      return {
        success: true,
        lobby: memoryState,
      };
    }

    // Fallback vers la base de données
    return {
      success: true,
      lobby: {
        id: lobby.id,
        name: lobby.name,
        hostId: lobby.hostId,
        status: lobby.status,
        settings: lobby.gameSettings,
        players: lobby.players.map((p) => ({
          id: p.userId,
          name: p.user.name,
          status: p.status,
          isHost: p.userId === lobby.hostId,
        })),
      },
    };
  }

  /**
   * Récupère l'état du jeu
   */
  static async getGameState(lobbyId: string, userId: string) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    // Vérifier que le joueur est dans le lobby
    const player = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (!player) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.PLAYER_NOT_IN_LOBBY);
    }

    const gameState = LobbyManager.getGameState(validatedLobbyId);

    if (!gameState) {
      throw new LobbyError("Aucun état de jeu trouvé");
    }

    return {
      success: true,
      gameState,
    };
  }

  /**
   * Quitte une partie en cours
   */
  static async leaveGame(userId: string, lobbyId: string) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    const player = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (!player) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.PLAYER_NOT_IN_LOBBY);
    }

    // Marquer le joueur comme ayant quitté
    await lobbyRepository.updatePlayerStatus(
      validatedLobbyId,
      validatedUserId,
      APP_CONSTANTS.PLAYER_STATUS.DISCONNECTED
    );

    // Mettre à jour en mémoire
    LobbyManager.removePlayerFromLobby(validatedLobbyId, validatedUserId);

    // Si c'est l'hôte, terminer la partie
    if (lobby.hostId === validatedUserId) {
      await this._endGame(validatedLobbyId, "host_left");
      return { success: true, message: "Partie terminée car l'hôte a quitté" };
    }

    // Diffuser la mise à jour
    // await BroadcastManager.broadcastPlayerLeft(validatedLobbyId, validatedUserId);

    return { success: true, message: "Partie quittée avec succès" };
  }

  /**
   * Redémarre une partie
   */
  static async restartGame(userId: string, lobbyId: string) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    // Vérifier que l'utilisateur est l'hôte
    if (lobby.hostId !== validatedUserId) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    // Réinitialiser le statut du lobby
    await lobbyRepository.updateStatus(
      validatedLobbyId,
      APP_CONSTANTS.LOBBY_STATUS.WAITING
    );

    // Réinitialiser les statuts des joueurs
    for (const player of lobby.players) {
      await lobbyRepository.updatePlayerStatus(
        validatedLobbyId,
        player.userId,
        APP_CONSTANTS.PLAYER_STATUS.JOINED
      );
    }

    // Redémarrer en mémoire
    LobbyManager.restartGame(validatedLobbyId);

    // Diffuser le redémarrage
    // await BroadcastManager.broadcastGameRestart(validatedLobbyId);

    loggers.game.info("Partie redémarrée", {
      lobbyId: validatedLobbyId,
      hostId: validatedUserId,
    });

    return { success: true, message: "Partie redémarrée avec succès" };
  }

  /**
   * Obtient les résultats de la partie
   */
  static async getGameResults(lobbyId: string, userId: string) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findLobbyByIdOrThrow(validatedLobbyId);

    // Vérifier que le joueur est dans le lobby
    const player = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (!player) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.PLAYER_NOT_IN_LOBBY);
    }

    const results = LobbyManager.getGameResults(validatedLobbyId);

    return {
      success: true,
      results: results || {
        players: lobby.players.map((p) => ({
          id: p.userId,
          name: p.user.name,
          score: p.score || 0,
          validatedCountries: p.validatedCountries || [],
          incorrectCountries: p.incorrectCountries || [],
        })),
      },
    };
  }

  /**
   * Termine une partie
   */
  private static async _endGame(lobbyId: string, reason: string) {
    loggers.game.info("Fin de partie", { lobbyId, reason });

    await lobbyRepository.updateStatus(
      lobbyId,
      APP_CONSTANTS.LOBBY_STATUS.FINISHED
    );

    LobbyManager.endGame(lobbyId);

    // await BroadcastManager.broadcastGameEnd(lobbyId, reason);
  }
}

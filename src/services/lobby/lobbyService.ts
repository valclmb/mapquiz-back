import { LobbySettings } from '../../types/index.js';
import { LobbyCreationService } from './core/lobbyCreationService.js';
import { LobbyGameService } from './core/lobbyGameService.js';
import { LobbyPlayerService } from './core/lobbyPlayerService.js';

/**
 * Service principal orchestrant la gestion des lobbies
 * Délègue aux services spécialisés pour chaque domaine
 */
export class LobbyService {
  // ========== CRÉATION ==========
  
  /**
   * Crée un nouveau lobby
   */
  static async createLobby(userId: string, name: string, settings: LobbySettings = {}) {
    return LobbyCreationService.createLobby(userId, name, settings);
  }

  // ========== GESTION DES JOUEURS ==========

  /**
   * Invite un ami dans un lobby
   */
  static async inviteToLobby(hostId: string, lobbyId: string, friendId: string) {
    return LobbyPlayerService.inviteToLobby(hostId, lobbyId, friendId);
  }

  /**
   * Rejoint un lobby
   */
  static async joinLobby(userId: string, lobbyId: string) {
    return LobbyPlayerService.joinLobby(userId, lobbyId);
  }

  /**
   * Quitte un lobby
   */
  static async leaveLobby(userId: string, lobbyId: string) {
    return LobbyPlayerService.leaveLobby(userId, lobbyId);
  }

  /**
   * Met à jour le statut de préparation d'un joueur
   */
  static async setPlayerReady(userId: string, lobbyId: string, ready: boolean) {
    return LobbyPlayerService.setPlayerReady(userId, lobbyId, ready);
  }

  /**
   * Met à jour le statut absent d'un joueur
   */
  static async setPlayerAbsent(userId: string, lobbyId: string, absent: boolean) {
    return LobbyPlayerService.setPlayerAbsent(userId, lobbyId, absent);
  }

  // ========== GESTION DU JEU ==========

  /**
   * Met à jour les paramètres du lobby
   */
  static async updateLobbySettings(userId: string, lobbyId: string, settings: LobbySettings) {
    return LobbyGameService.updateLobbySettings(userId, lobbyId, settings);
  }

  /**
   * Démarre une partie
   */
  static async startGame(userId: string, lobbyId: string) {
    return LobbyGameService.startGame(userId, lobbyId);
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
    return LobbyGameService.updateGameProgress(
      userId,
      lobbyId,
      score,
      answerTime,
      isConsecutiveCorrect
    );
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
    return LobbyGameService.updatePlayerProgress(
      userId,
      lobbyId,
      validatedCountries,
      incorrectCountries,
      score,
      totalQuestions
    );
  }

  /**
   * Récupère l'état du lobby
   */
  static async getLobbyState(lobbyId: string, userId: string) {
    return LobbyGameService.getLobbyState(lobbyId, userId);
  }

  /**
   * Récupère l'état du jeu
   */
  static async getGameState(lobbyId: string, userId: string) {
    return LobbyGameService.getGameState(lobbyId, userId);
  }

  /**
   * Quitte une partie en cours
   */
  static async leaveGame(userId: string, lobbyId: string) {
    return LobbyGameService.leaveGame(userId, lobbyId);
  }

  /**
   * Récupère les résultats de la partie
   */
  static async getGameResults(lobbyId: string, userId: string) {
    return LobbyGameService.getGameResults(lobbyId, userId);
  }

  /**
   * Redémarre une partie
   */
  static async restartGame(userId: string, lobbyId: string) {
    return LobbyGameService.restartGame(userId, lobbyId);
  }
}
import { LobbySettings } from "../types/index.js";
import { LobbyCreationService } from "./lobby/lobbyCreationService.js";
import { LobbyGameService } from "./lobby/lobbyGameService.js";
import { LobbyPlayerService } from "./lobby/lobbyPlayerService.js";

/**
 * Service principal pour la gestion des lobbies
 * Utilise les services spécialisés pour chaque aspect
 */
export class LobbyService {
  /**
   * Crée un nouveau lobby
   */
  static async createLobby(
    userId: string,
    name: string,
    settings: LobbySettings
  ) {
    return await LobbyCreationService.createLobby(userId, name, settings);
  }

  /**
   * Invite un ami dans un lobby
   */
  static async inviteToLobby(
    hostId: string,
    lobbyId: string,
    friendId: string
  ) {
    return await LobbyPlayerService.inviteToLobby(hostId, lobbyId, friendId);
  }

  /**
   * Rejoint un lobby
   */
  static async joinLobby(userId: string, lobbyId: string) {
    return await LobbyPlayerService.joinLobby(userId, lobbyId);
  }

  /**
   * Quitte un lobby
   */
  static async leaveLobby(userId: string, lobbyId: string) {
    return await LobbyPlayerService.leaveLobby(userId, lobbyId);
  }

  /**
   * Met à jour les paramètres du lobby
   */
  static async updateLobbySettings(
    userId: string,
    lobbyId: string,
    settings: any
  ) {
    return await LobbyGameService.updateLobbySettings(
      userId,
      lobbyId,
      settings
    );
  }

  /**
   * Met à jour le statut de préparation d'un joueur
   */
  static async setPlayerReady(userId: string, lobbyId: string, ready: boolean) {
    return await LobbyPlayerService.setPlayerReady(userId, lobbyId, ready);
  }

  /**
   * Démarre une partie
   */
  static async startGame(userId: string, lobbyId: string) {
    return await LobbyGameService.startGame(userId, lobbyId);
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
    return await LobbyGameService.updateGameProgress(
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
    return await LobbyGameService.updatePlayerProgress(
      userId,
      lobbyId,
      validatedCountries,
      incorrectCountries,
      score,
      totalQuestions
    );
  }

  /**
   * Récupère l'état du jeu
   */
  static async getGameState(lobbyId: string, userId: string) {
    return await LobbyGameService.getGameState(lobbyId, userId);
  }

  /**
   * Quitte une partie en cours
   */
  static async leaveGame(userId: string, lobbyId: string) {
    return await LobbyGameService.leaveGame(userId, lobbyId);
  }

  /**
   * Récupère les résultats de la partie
   */
  static async getGameResults(lobbyId: string, userId: string) {
    return await LobbyGameService.getGameResults(lobbyId, userId);
  }

  /**
   * Redémarre une partie
   */
  static async restartGame(userId: string, lobbyId: string) {
    return await LobbyGameService.restartGame(userId, lobbyId);
  }
}

import * as LobbyModel from "../models/lobbyModel.js";
import { BroadcastManager } from "../websocket/lobby/broadcastManager.js";
import { LobbyLifecycleManager } from "../websocket/lobby/lobbyLifecycle.js";
import { LobbyService } from "./lobbyService.js";
import { PlayerService } from "./playerService.js";

/**
 * Service pour la gestion du jeu
 */
export class GameService {
  /**
   * Démarre une partie
   */
  static async startGame(lobbyId: string): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      return false;
    }

    try {
      // Mettre à jour le statut du lobby en base de données
      await LobbyModel.updateLobbyStatus(lobbyId, "playing");

      // Créer l'état de jeu
      const gameState = {
        startTime: new Date().toISOString(),
        currentQuestion: 0,
        totalQuestions: lobby.settings?.totalQuestions || 10,
        countries: [],
        currentCountry: null,
        settings: lobby.settings,
      };

      // Sauvegarder l'état de jeu en base de données
      await LobbyModel.saveGameState(lobbyId, gameState);

      // Mettre à jour l'état en mémoire
      lobby.gameState = gameState;
      lobby.status = "playing";

      // Diffuser le début de partie
      BroadcastManager.broadcastGameStart(lobbyId, lobby);

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Met à jour le score d'un joueur
   */
  static async updatePlayerScore(
    lobbyId: string,
    playerId: string,
    score: number,
    progress: number,
    answerTime?: number,
    isConsecutiveCorrect?: boolean
  ): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby || !lobby.players.has(playerId)) return false;

    const playerData = lobby.players.get(playerId);
    const updatedPlayer = PlayerService.updatePlayerScore(
      playerData,
      score,
      progress,
      answerTime,
      isConsecutiveCorrect
    );

    lobby.players.set(playerId, updatedPlayer);

    // Sauvegarder en base de données
    try {
      await LobbyService.updatePlayerScore(
        lobbyId,
        playerId,
        updatedPlayer.score,
        updatedPlayer.progress,
        updatedPlayer.validatedCountries || [],
        updatedPlayer.incorrectCountries || []
      );
    } catch (error) {
      console.error(
        `Erreur lors de la sauvegarde du score en DB pour ${playerId}:`,
        error
      );
    }

    // Vérifier si le joueur a terminé la partie
    if (updatedPlayer.progress >= 100) {
      this.checkGameCompletion(lobbyId, playerId);
    }

    BroadcastManager.broadcastScoreUpdate(lobbyId, lobby, playerId);
    return true;
  }

  /**
   * Met à jour la progression détaillée du joueur
   */
  static async updatePlayerProgress(
    lobbyId: string,
    userId: string,
    validatedCountries: string[],
    incorrectCountries: string[],
    score: number,
    totalQuestions: number
  ): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      return false;
    }

    const player = lobby.players.get(userId);
    if (!player) {
      return false;
    }

    // Mettre à jour les données du joueur
    player.score = score;
    player.progress =
      (validatedCountries.length + incorrectCountries.length) / totalQuestions;
    player.validatedCountries = validatedCountries;
    player.incorrectCountries = incorrectCountries;

    // Mettre à jour en base de données
    try {
      await LobbyModel.updatePlayerGameData(
        lobbyId,
        userId,
        score,
        player.progress,
        validatedCountries,
        incorrectCountries
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Vérifie si la partie est terminée
   */
  private static checkGameCompletion(lobbyId: string, playerId: string): void {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      return;
    }

    // Marquer le joueur comme terminé
    const playerData = lobby.players.get(playerId);
    if (playerData) {
      lobby.players.set(playerId, { ...playerData, status: "finished" });
    }

    // Vérifier si tous les joueurs ont terminé
    let allFinished = true;
    for (const [id, data] of lobby.players.entries()) {
      if (data.status !== "finished") {
        allFinished = false;
      }
    }

    if (allFinished) {
      this.endGame(lobbyId).catch((error) => {
        console.error("Erreur lors de la fin de jeu:", error);
      });
    }
  }

  /**
   * Termine la partie
   */
  private static async endGame(lobbyId: string): Promise<void> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      return;
    }

    lobby.status = "finished";

    // Mettre à jour le statut du lobby en base de données
    try {
      await LobbyService.updateLobbyStatus(lobbyId, "finished");
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du statut du lobby ${lobbyId} en base de données:`,
        error
      );
    }

    // Diffuser un lobby_update avec le status finished pour synchroniser le frontend
    await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

    // Envoyer game_end après le lobby_update
    BroadcastManager.broadcastGameEnd(lobbyId);
  }

  /**
   * Redémarre un lobby
   */
  static async restartLobby(lobbyId: string): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      console.log(`Lobby ${lobbyId} non trouvé en mémoire`);
      return false;
    }

    // Réinitialiser le statut du lobby
    lobby.status = "waiting";
    lobby.gameState = null;

    // Mettre à jour le statut du lobby en base de données
    try {
      await LobbyService.updateLobbyStatus(lobbyId, "waiting");
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du statut du lobby ${lobbyId} en base de données:`,
        error
      );
    }

    // Réinitialiser tous les joueurs
    const resetPlayers = PlayerService.resetPlayersForNewGame(lobby.players);
    lobby.players = resetPlayers;

    // Remettre à zéro en base de données aussi
    for (const [playerId] of lobby.players) {
      try {
        await LobbyService.updatePlayerScore(
          lobbyId,
          playerId,
          0, // score
          0, // progress
          [], // validatedCountries
          [] // incorrectCountries
        );
        // Mettre à jour le statut du joueur
        await LobbyService.updatePlayerStatus(lobbyId, playerId, "joined");
      } catch (error) {
        console.error(
          `Erreur lors du reset du joueur ${playerId} en DB:`,
          error
        );
      }
    }

    return true;
  }
}

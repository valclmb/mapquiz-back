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
      console.log(`Lobby ${lobbyId} non trouvé en mémoire`);
      return false;
    }

    console.log(`Démarrage de la partie pour le lobby ${lobbyId}`);

    // Mettre à jour le statut du lobby
    lobby.status = "playing";

    // Initialiser l'état du jeu
    lobby.gameState = {
      startTime: Date.now(),
      settings: lobby.settings,
    };

    // Mettre à jour le statut de tous les joueurs
    for (const [playerId, playerData] of lobby.players) {
      lobby.players.set(
        playerId,
        PlayerService.updatePlayerStatus(playerData, "playing")
      );
    }

    // Mettre à jour le statut du lobby en base de données
    try {
      await LobbyService.startGame(lobbyId);
      console.log(`Statut du lobby ${lobbyId} mis à jour en base de données`);
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du statut du lobby ${lobbyId}:`,
        error
      );
    }

    // Mettre à jour le statut de tous les joueurs en base de données
    try {
      for (const [playerId] of lobby.players) {
        await LobbyService.updatePlayerStatus(lobbyId, playerId, "playing");
      }
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du statut "playing":`,
        error
      );
    }

    // Sauvegarder l'état du jeu en base de données
    try {
      await LobbyService.saveGameState(lobbyId, lobby.gameState);
      console.log(
        `État du jeu sauvegardé en base de données pour le lobby ${lobbyId}`
      );
    } catch (error) {
      console.error(
        `Erreur lors de la sauvegarde de l'état du jeu pour le lobby ${lobbyId}:`,
        error
      );
    }

    // Diffuser le début de la partie
    BroadcastManager.broadcastGameStart(lobbyId, lobby);

    console.log(`Partie démarrée avec succès pour le lobby ${lobbyId}`);
    return true;
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
      console.log(
        `Joueur ${playerId} a terminé avec ${updatedPlayer.progress}% de progression`
      );
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
    playerId: string,
    validatedCountries: string[],
    incorrectCountries: string[],
    score: number,
    totalQuestions: number
  ): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby || !lobby.players.has(playerId)) return false;

    const playerData = lobby.players.get(playerId);
    const updatedPlayer = PlayerService.updatePlayerProgress(
      playerData,
      validatedCountries,
      incorrectCountries,
      score,
      totalQuestions
    );

    lobby.players.set(playerId, updatedPlayer);

    // Sauvegarder en base de données
    try {
      await LobbyService.updatePlayerProgress(
        lobbyId,
        playerId,
        updatedPlayer.validatedCountries,
        updatedPlayer.incorrectCountries,
        updatedPlayer.score,
        totalQuestions
      );
    } catch (error) {
      console.error(
        `Erreur lors de la sauvegarde de la progression en DB pour ${playerId}:`,
        error
      );
    }

    // Vérifier si le joueur a terminé la partie
    if (updatedPlayer.progress >= 100) {
      console.log(
        `GameService.updatePlayerProgress - Joueur ${playerId} a terminé avec ${updatedPlayer.progress}% de progression`
      );
      this.checkGameCompletion(lobbyId, playerId);
    }

    BroadcastManager.broadcastPlayerProgressUpdate(lobbyId, lobby);
    return true;
  }

  /**
   * Vérifie si la partie est terminée
   */
  private static checkGameCompletion(lobbyId: string, playerId: string): void {
    console.log(
      `GameService.checkGameCompletion - Début pour lobbyId: ${lobbyId}, playerId: ${playerId}`
    );

    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      console.log(`Lobby ${lobbyId} non trouvé en mémoire`);
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
      console.log(
        `🎯 GameService.checkGameCompletion - Tous les joueurs ont terminé, appel de endGame pour le lobby ${lobbyId}`
      );
      this.endGame(lobbyId).catch((error) => {
        console.error("Erreur lors de la fin de jeu:", error);
      });
    } else {
      console.log(
        `⏳ GameService.checkGameCompletion - Pas tous les joueurs ont terminé, pas de fin de jeu`
      );
    }
  }

  /**
   * Termine la partie
   */
  private static async endGame(lobbyId: string): Promise<void> {
    console.log(`🏁 GameService.endGame - Début pour le lobby ${lobbyId}`);

    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      console.log(
        `❌ GameService.endGame - Lobby ${lobbyId} non trouvé en mémoire`
      );
      return;
    }

    lobby.status = "finished";
    console.log(
      `✅ GameService.endGame - Statut du lobby mis à jour vers 'finished' en mémoire`
    );

    const rankings = PlayerService.calculateRankings(lobby.players);

    // Mettre à jour le statut du lobby en base de données
    try {
      await LobbyService.updateLobbyStatus(lobbyId, "finished");
      console.log(
        `✅ GameService.endGame - Statut du lobby mis à jour vers 'finished' en base de données`
      );
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du statut du lobby ${lobbyId} en base de données:`,
        error
      );
    }

    BroadcastManager.broadcastGameEnd(lobbyId);
    console.log(`📢 GameService.endGame - game_end diffusé`);

    // Diffuser un lobby_update avec le status finished pour synchroniser le frontend
    await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
    console.log(
      `📢 GameService.endGame - lobby_update diffusé avec statut finished`
    );
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

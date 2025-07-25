import * as LobbyModel from "../../models/lobbyModel.js";
import { BroadcastManager } from "./broadcastManager.js";
import { GameStateManager } from "./gameStateManager.js";
import { LobbyLifecycleManager } from "./lobbyLifecycle.js";
import { PlayerManager } from "./playerManager.js";

/**
 * Gestionnaire de la logique de jeu
 */
export class GameManager {
  /**
   * Démarre une partie
   */
  static async startGame(lobbyId: string): Promise<boolean> {
    console.log("🚀 GameManager.startGame - DÉBUT pour le lobby:", lobbyId);

    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      console.log(
        "❌ GameManager.startGame - Lobby non trouvé en mémoire:",
        lobbyId
      );
      return false;
    }

    console.log("✅ GameManager.startGame - Lobby trouvé, début du traitement");

    // Mettre à jour le statut du lobby en base de données
    try {
      await LobbyModel.updateLobbyStatus(lobbyId, "playing");
      console.log(`Statut du lobby ${lobbyId} mis à jour en base de données`);
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du statut du lobby ${lobbyId}:`,
        error
      );
    }

    lobby.status = "playing";
    lobby.gameState = {
      startTime: Date.now(),
      settings: {
        selectedRegions: lobby.settings.selectedRegions || [],
      },
    };

    console.log("GameManager.startGame - gameState créé:", {
      startTime: lobby.gameState.startTime,
      settings: lobby.gameState.settings,
    });

    // Réinitialiser tous les joueurs pour la nouvelle partie
    lobby.players = PlayerManager.resetPlayersForNewGame(lobby.players);

    console.log(
      `GameManager.startGame - Joueurs après reset:`,
      Array.from(lobby.players.keys())
    );

    // Mettre à jour le statut "playing" de tous les joueurs
    try {
      for (const [playerId, playerData] of lobby.players) {
        // Mettre à jour en mémoire
        lobby.players.set(
          playerId,
          PlayerManager.updatePlayerStatus(playerData, "playing")
        );

        // Mettre à jour en base de données
        await LobbyModel.updatePlayerStatus(lobbyId, playerId, "playing");
      }

      console.log(
        `Statut "playing" mis à jour en mémoire et en DB pour tous les joueurs du lobby ${lobbyId}`
      );
    } catch (error) {
      console.error(`Erreur lors de la mise à jour du statut "playing":`, error);
    }

    // Sauvegarder l'état du jeu en base de données
    try {
      await LobbyModel.saveGameState(lobbyId, lobby.gameState);
      console.log(
        `État du jeu sauvegardé en base de données pour le lobby ${lobbyId}`
      );
    } catch (error) {
      console.error(
        `Erreur lors de la sauvegarde de l'état du jeu pour le lobby ${lobbyId}:`,
        error
      );
    }

    console.log(`GameManager.startGame - Broadcast du début de partie`);
    BroadcastManager.broadcastGameStart(lobbyId, lobby);

    // Diffuser aussi la mise à jour du lobby avec le nouveau statut "playing"
    console.log(`GameManager.startGame - Broadcast de la mise à jour du lobby`);
    await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
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
    const updatedPlayer = PlayerManager.updatePlayerScore(
      playerData,
      score,
      progress,
      answerTime,
      isConsecutiveCorrect
    );

    lobby.players.set(playerId, updatedPlayer);

    // Sauvegarder en base de données
    try {
      await LobbyModel.updatePlayerGameData(
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
    const updatedPlayer = PlayerManager.updatePlayerProgress(
      playerData,
      validatedCountries,
      incorrectCountries,
      score,
      totalQuestions
    );

    lobby.players.set(playerId, updatedPlayer);

    // Sauvegarder en base de données
    try {
      await LobbyModel.updatePlayerGameData(
        lobbyId,
        playerId,
        updatedPlayer.score,
        updatedPlayer.progress,
        updatedPlayer.validatedCountries,
        updatedPlayer.incorrectCountries
      );
    } catch (error) {
      console.error(
        `❌ Erreur lors de la sauvegarde de la progression en DB pour ${playerId}:`,
        error
      );
    }

    // Vérifier si le joueur a terminé la partie
    if (updatedPlayer.progress >= 100) {
      console.log(
        `GameManager.updatePlayerProgress - Joueur ${playerId} a terminé avec ${updatedPlayer.progress}% de progression`
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
      `GameManager.checkGameCompletion - Début pour lobbyId: ${lobbyId}, playerId: ${playerId}`
    );

    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      console.log(
        `GameManager.checkGameCompletion - Lobby ${lobbyId} non trouvé`
      );
      return;
    }

    // Marquer le joueur comme ayant terminé
    const playerData = lobby.players.get(playerId);
    if (playerData) {
      lobby.players.set(playerId, { ...playerData, status: "finished" });
      console.log(
        `GameManager.checkGameCompletion - Joueur ${playerId} marqué comme finished`
      );
    }

    // Vérifier si tous les joueurs ont terminé
    let allFinished = true;
    for (const [id, data] of lobby.players.entries()) {
      if (data.status !== "finished") {
        allFinished = false;
      }
    }

    if (allFinished) {
      console.log(`GameManager.checkGameCompletion - Fin de jeu déclenchée !`);
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
    if (!lobby) return;

    lobby.status = "finished";
    const rankings = GameStateManager.calculateRankings(lobby.players);

    // Mettre à jour le statut du lobby en base de données
    try {
      await LobbyModel.updateLobbyStatus(lobbyId, "finished");
      console.log(
        `Statut du lobby ${lobbyId} mis à jour en base de données vers 'finished'`
      );
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du statut du lobby ${lobbyId} en base de données:`,
        error
      );
    }

    console.log("GameManager.endGame - Fin de jeu, rankings:", rankings);
    BroadcastManager.broadcastGameEnd(lobbyId);
    // Diffuser un lobby_update avec le status finished pour synchroniser le frontend
    await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
  }

  /**
   * Redémarre un lobby
   */
  static async restartLobby(lobbyId: string): Promise<boolean> {
    console.log(`GameManager.restartLobby - Redémarrage du lobby ${lobbyId}`);

    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      console.log(`Lobby ${lobbyId} non trouvé en mémoire`);
      return false;
    }

    // Réinitialiser le statut du lobby
    lobby.status = "waiting";
    lobby.gameState = null;

    // Réinitialiser tous les joueurs
    for (const [playerId, playerData] of lobby.players) {
      lobby.players.set(playerId, {
        ...playerData,
        status: "joined",
        score: 0,
        progress: 0,
        validatedCountries: [],
        incorrectCountries: [],
        completionTime: null,
      });

      // Remettre à zéro en base de données aussi
      try {
        await LobbyModel.updatePlayerGameData(
          lobbyId,
          playerId,
          0, // score
          0, // progress
          [], // validatedCountries
          [] // incorrectCountries
        );
      } catch (error) {
        console.error(`Erreur lors du reset du joueur ${playerId} en DB:`, error);
      }
    }

    console.log(`Lobby ${lobbyId} redémarré avec succès`);
    return true;
  }
} 
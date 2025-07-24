import { PlayerProgress } from "./gameStateManager.js";

/**
 * Gestionnaire des joueurs dans un lobby
 */
export class PlayerManager {
  /**
   * Crée un nouveau joueur avec les données par défaut
   */
  static createPlayer(playerName: string): PlayerProgress {
    return {
      status: "joined",
      score: 0,
      progress: 0,
      name: playerName,
      validatedCountries: [],
      incorrectCountries: [],
    };
  }

  /**
   * Met à jour le statut d'un joueur
   */
  static updatePlayerStatus(
    player: PlayerProgress,
    status: string
  ): PlayerProgress {
    return { ...player, status };
  }

  /**
   * Met à jour le score d'un joueur
   */
  static updatePlayerScore(
    player: PlayerProgress,
    score: number,
    progress: number,
    answerTime?: number,
    isConsecutiveCorrect?: boolean
  ): PlayerProgress {
    // Calculer le score avec bonus de vitesse
    let finalScore = score;
    if (answerTime && answerTime < 3000) {
      // Bonus de vitesse pour les réponses rapides (< 3 secondes)
      finalScore += Math.floor((3000 - answerTime) / 100);
    }

    // Bonus pour les réponses consécutives correctes
    if (isConsecutiveCorrect && player.consecutiveCorrect) {
      const consecutiveBonus = Math.min(player.consecutiveCorrect * 10, 50);
      finalScore += consecutiveBonus;
    }

    return {
      ...player,
      score: finalScore,
      progress,
      lastAnswerTime: answerTime,
      consecutiveCorrect: isConsecutiveCorrect
        ? (player.consecutiveCorrect || 0) + 1
        : 0,
    };
  }

  /**
   * Met à jour la progression détaillée d'un joueur
   */
  static updatePlayerProgress(
    player: PlayerProgress,
    validatedCountries: string[],
    incorrectCountries: string[],
    score: number,
    totalQuestions: number
  ): PlayerProgress {
    // Calculer la progression basée sur le total des réponses données
    const totalAnswered = validatedCountries.length + incorrectCountries.length;

    // En mode multijoueur, totalQuestions représente les pays actifs (filtrés)
    // Donc la progression est basée sur les pays actifs, pas tous les pays
    const progress =
      totalQuestions > 0 ? (totalAnswered / totalQuestions) * 100 : 0;

    console.log("PlayerManager.updatePlayerProgress - Calcul progression:", {
      validatedCountries: validatedCountries.length,
      incorrectCountries: incorrectCountries.length,
      totalAnswered,
      totalQuestions,
      progress: Math.min(progress, 100),
    });

    const updatedPlayer = {
      ...player,
      validatedCountries,
      incorrectCountries,
      score,
      progress: Math.min(progress, 100), // S'assurer que la progression ne dépasse pas 100%
    };

    console.log(`🔍 PlayerManager.updatePlayerProgress - Statut préservé:`, {
      playerId: player.name,
      oldStatus: player.status,
      newStatus: updatedPlayer.status,
    });

    return updatedPlayer;
  }

  /**
   * Vérifie si tous les joueurs sont prêts
   */
  static areAllPlayersReady(
    players: Map<string, PlayerProgress>,
    hostId: string
  ): boolean {
    for (const [playerId, playerData] of players.entries()) {
      // Tous les joueurs, y compris l'hôte, doivent être explicitement prêts
      if (playerData.status !== "ready") {
        return false;
      }
    }
    return true;
  }

  /**
   * Réinitialise tous les joueurs pour une nouvelle partie
   */
  static resetPlayersForNewGame(
    players: Map<string, PlayerProgress>
  ): Map<string, PlayerProgress> {
    const resetPlayers = new Map();
    for (const [playerId, playerData] of players.entries()) {
      resetPlayers.set(playerId, {
        ...playerData,
        status: "playing",
        score: 0,
        progress: 0,
        validatedCountries: [],
        incorrectCountries: [],
      });
    }
    return resetPlayers;
  }
}

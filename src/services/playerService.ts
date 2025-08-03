// Type pour les données de progression d'un joueur
export type PlayerProgress = {
  validatedCountries: string[];
  incorrectCountries: string[];
  score: number;
  progress: number;
  status: string;
  name: string;
  lastAnswerTime?: number;
  consecutiveCorrect?: number;
};

/**
 * Service pour la gestion des joueurs
 */
export class PlayerService {
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

    const updatedPlayer = {
      ...player,
      validatedCountries,
      incorrectCountries,
      score,
      progress: Math.min(progress, 100), // S'assurer que la progression ne dépasse pas 100%
    };

    return updatedPlayer;
  }

  /**
   * Vérifie si tous les joueurs sont prêts
   */
  static areAllPlayersReady(
    players: Map<string, PlayerProgress>,
    hostId: string
  ): boolean {
    for (const [playerId, player] of players.entries()) {
      // Tous les joueurs, y compris l'hôte, doivent être prêts
      if (player.status !== "ready") {
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
    
    for (const [playerId, player] of players.entries()) {
      resetPlayers.set(playerId, {
        ...player,
        status: "joined",
        score: 0,
        progress: 0,
        validatedCountries: [],
        incorrectCountries: [],
        lastAnswerTime: undefined,
        consecutiveCorrect: 0,
      });
    }
    
    return resetPlayers;
  }

  /**
   * Vérifie si un joueur a terminé la partie
   */
  static checkGameCompletion(
    playerProgress: PlayerProgress,
    totalQuestions: number
  ): boolean {
    return playerProgress.progress >= totalQuestions;
  }

  /**
   * Calcule les classements des joueurs
   */
  static calculateRankings(players: Map<string, PlayerProgress>): any[] {
    const playerArray = Array.from(players.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      score: data.score,
      progress: data.progress,
      status: data.status,
    }));

    // Trier par score décroissant, puis par progression décroissante
    const sortedPlayers = playerArray.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.progress - a.progress;
    });

    // Ajouter le rang à chaque joueur
    return sortedPlayers.map((player, index) => ({
      ...player,
      rank: index + 1, // Rang basé sur la position dans le tableau trié
      completionTime: null, // Pour l'instant, on n'a pas le temps de completion
    }));
  }
} 
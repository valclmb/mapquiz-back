import * as ScoreModel from "../models/scoreModel.js";
import * as UserModel from "../models/userModel.js";

/**
 * Service unifié pour la gestion des scores
 */
export class ScoreService {
  /**
   * Sauvegarde un score
   */
  static async saveScore(
    userId: string,
    score: number,
    totalQuestions: number,
    selectedRegions: string[],
    gameMode: string = "quiz",
    duration?: number
  ) {
    const user = await UserModel.findUserById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    const gameScore = await ScoreModel.createScore({
      userId,
      score,
      totalQuestions,
      selectedRegions,
      gameMode,
      duration,
    });

    return {
      success: true,
      score: gameScore,
    };
  }

  /**
   * Récupère l'historique des scores d'un utilisateur
   */
  static async getScoreHistory(userId: string) {
    const user = await UserModel.findUserById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    const scores = await ScoreModel.getUserScores(userId);

    // Transformer les données pour le frontend (minimal)
    return scores
      .map((item) => ({
        score: item.score,
        duration: item.duration || 0,
        selectedRegions: item.selectedRegions,
        date: item.createdAt.toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        }),
      }))
      .reverse(); // Du plus ancien au plus récent pour le graphique
  }

  /**
   * Récupère les statistiques d'un utilisateur
   */
  static async getUserStats(userId: string) {
    const user = await UserModel.findUserById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    const stats = await ScoreModel.getScoreStats(userId);
    return stats;
  }
}

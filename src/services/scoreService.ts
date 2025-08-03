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
    return scores;
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

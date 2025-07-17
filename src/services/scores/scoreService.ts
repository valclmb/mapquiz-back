import { ScoreHistoryService } from "./scoreHistoryService";
import { ScoreSaveService } from "./scoreSaveService";
import { ChartScoreItem, SaveScoreData } from "./types";

export class ScoreService {
  /**
   * Save a new score for a user
   */
  async saveScore(scoreData: SaveScoreData) {
    return ScoreSaveService.saveScore(scoreData);
  }

  /**
   * Get score history for a user
   */
  async getScoreHistory(userId: string): Promise<ChartScoreItem[]> {
    return ScoreHistoryService.getScoreHistory(userId);
  }

  /**
   * Get user's best score
   */
  async getBestScore(userId: string): Promise<ChartScoreItem | null> {
    const scores = await ScoreHistoryService.getScoreHistory(userId);
    return scores.length > 0 ? scores[0] : null;
  }

  /**
   * Get user's average score
   */
  async getAverageScore(userId: string): Promise<number> {
    const scores = await ScoreHistoryService.getScoreHistory(userId);
    if (scores.length === 0) return 0;

    const totalScore = scores.reduce((sum, score) => sum + score.score, 0);
    return Math.round(totalScore / scores.length);
  }

  /**
   * Get top scores globally
   */
  async getTopScores(limit: number = 10): Promise<ChartScoreItem[]> {
    // This would need to be implemented in ScoreHistoryService
    // For now, return empty array
    return [];
  }

  /**
   * Get user's recent scores
   */
  async getRecentScores(
    userId: string,
    limit: number = 5
  ): Promise<ChartScoreItem[]> {
    const scores = await ScoreHistoryService.getScoreHistory(userId);
    return scores.slice(0, limit);
  }
}

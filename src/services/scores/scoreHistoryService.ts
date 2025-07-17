import * as ScoreModel from "../../models/scoreModel.js";
import { ChartScoreItem } from "./types.js";

/**
 * Service pour l'historique des scores
 */
export class ScoreHistoryService {
  /**
   * Récupère l'historique des scores d'un utilisateur
   */
  static async getScoreHistory(userId: string): Promise<ChartScoreItem[]> {
    const scores = await ScoreModel.getUserScores(userId); // Limité à 10 scores par défaut
    return scores
      .map((item) => ({
        id: item.id,
        score: item.score,
        date: new Date(item.createdAt).toLocaleDateString("fr-FR", {
          day: "2-digit",
          month: "2-digit",
        }),
        raw: {
          id: item.id,
          score: item.score,
          totalQuestions: item.totalQuestions,
          selectedRegions: item.selectedRegions,
          gameMode: item.gameMode,
          duration: item.duration ?? 0,
          createdAt: new Date(item.createdAt).toISOString(),
        },
      }))
      .reverse();
  }

  /**
   * Récupère le meilleur score d'un utilisateur
   */
  static async getBestScore(userId: string): Promise<ChartScoreItem | null> {
    const score = await ScoreModel.getBestScore(userId);
    if (!score) return null;

    return {
      id: score.id,
      score: score.score,
      date: new Date(score.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      raw: {
        id: score.id,
        score: score.score,
        totalQuestions: score.totalQuestions,
        selectedRegions: score.selectedRegions,
        gameMode: score.gameMode,
        duration: score.duration ?? 0,
        createdAt: new Date(score.createdAt).toISOString(),
      },
    };
  }

  /**
   * Récupère la moyenne des scores d'un utilisateur
   */
  static async getAverageScore(userId: string): Promise<number> {
    return await ScoreModel.getAverageScore(userId);
  }

  /**
   * Récupère les meilleurs scores globaux
   */
  static async getTopScores(limit: number = 10): Promise<ChartScoreItem[]> {
    const scores = await ScoreModel.getTopScores(limit);
    return scores.map((item) => ({
      id: item.id,
      score: item.score,
      date: new Date(item.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      raw: {
        id: item.id,
        score: item.score,
        totalQuestions: item.totalQuestions,
        selectedRegions: item.selectedRegions,
        gameMode: item.gameMode,
        duration: item.duration ?? 0,
        createdAt: new Date(item.createdAt).toISOString(),
      },
    }));
  }

  /**
   * Récupère les scores récents d'un utilisateur
   */
  static async getRecentScores(
    userId: string,
    limit: number = 5
  ): Promise<ChartScoreItem[]> {
    const scores = await ScoreModel.getRecentScores(userId, limit);
    return scores.map((item) => ({
      id: item.id,
      score: item.score,
      date: new Date(item.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      raw: {
        id: item.id,
        score: item.score,
        totalQuestions: item.totalQuestions,
        selectedRegions: item.selectedRegions,
        gameMode: item.gameMode,
        duration: item.duration ?? 0,
        createdAt: new Date(item.createdAt).toISOString(),
      },
    }));
  }
}

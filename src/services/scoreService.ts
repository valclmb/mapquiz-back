import * as ScoreModel from "../models/scoreModel.js";

interface SaveScoreData {
  userId: string;
  score: number;
  totalQuestions: number;
  selectedRegions: string[];
  gameMode: string;
  duration?: number;
}

export const saveScore = async (data: SaveScoreData) => {
  return await ScoreModel.createScore(data);
};

export const getScoreHistory = async (userId: string) => {
  const scores = await ScoreModel.getUserScores(userId); // Déjà limité à 10 scores par défaut

  // Transformer les données au format attendu par le frontend
  return scores
    .map((item) => ({
      id: item.id,
      score: item.score,
      totalQuestions: item.totalQuestions,
      selectedRegions: item.selectedRegions,
      gameMode: item.gameMode,
      duration: item.duration,
      // Formater la date pour l'affichage dans le graphique
      date: new Date(item.createdAt).toLocaleDateString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
      }),
      // Garder createdAt pour compatibilité
      createdAt: item.createdAt,
    }))
    .reverse(); // Ordre chronologique
};

export const getStats = async (userId: string) => {
  const scores = await ScoreModel.getUserScores(userId);

  if (scores.length === 0) {
    return {
      totalGames: 0,
      averageScore: 0,
      bestScore: 0,
      totalCorrectAnswers: 0,
    };
  }

  const totalGames = scores.length;
  const totalCorrectAnswers = scores.reduce(
    (sum, score) => sum + score.score,
    0
  );
  const totalQuestions = scores.reduce(
    (sum, score) => sum + score.totalQuestions,
    0
  );
  const averageScore =
    totalQuestions > 0 ? (totalCorrectAnswers / totalQuestions) * 100 : 0;
  const bestScore = Math.max(
    ...scores.map((s) => (s.score / s.totalQuestions) * 100)
  );

  return {
    totalGames,
    averageScore: Math.round(averageScore * 100) / 100,
    bestScore: Math.round(bestScore * 100) / 100,
    totalCorrectAnswers,
  };
};

// Nouveau type pour le format des données du graphique
export interface ChartScoreItem {
  id: string;
  date: string; // Format dd/MM
  score: number; // Pourcentage arrondi
  raw: {
    id: string;
    score: number;
    totalQuestions: number;
    selectedRegions: string[];
    gameMode: string;
    duration: number;
    createdAt: string;
  };
}

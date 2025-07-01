import { FastifyInstance } from "fastify";
import * as ScoreController from "../controllers/scoreController.js";
import { requireAuth } from "../middleware/auth.js";

// Définir les interfaces pour les types de requêtes
interface SaveScoreRequest {
  Body: {
    score: number;
    totalQuestions: number;
    selectedRegions: string[];
    gameMode: string;
    duration?: number;
  };
}

export async function scoresRoutes(fastify: FastifyInstance) {
  // Sauvegarder un score
  fastify.post<SaveScoreRequest>(
    "/",
    {
      preHandler: requireAuth,
    },
    ScoreController.saveScore
  );

  // Récupérer l'historique des scores
  fastify.get(
    "/history",
    {
      preHandler: requireAuth,
    },
    ScoreController.getScoreHistory
  );

  // Récupérer les statistiques
  fastify.get(
    "/stats",
    {
      preHandler: requireAuth,
    },
    ScoreController.getStats
  );
}

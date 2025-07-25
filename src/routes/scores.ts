import { FastifyInstance } from "fastify";
import * as ScoreController from "../controllers/scoreController.js";
import { requireAuth } from "../middleware/auth.js";

export async function scoresRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/save",
    {
      preHandler: requireAuth,
    },
    ScoreController.saveScore
  );

  fastify.get(
    "/history",
    {
      preHandler: requireAuth,
    },
    ScoreController.getScoreHistory
  );

  fastify.get(
    "/stats",
    {
      preHandler: requireAuth,
    },
    ScoreController.getUserStats
  );
}

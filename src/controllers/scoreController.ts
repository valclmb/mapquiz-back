import { FastifyReply, FastifyRequest } from "fastify";
import * as ScoreService from "../services/scoreService.js";

interface SaveScoreRequest {
  score: number;
  totalQuestions: number;
  selectedRegions: string[];
  gameMode: string;
  duration?: number;
}

export const saveScore = async (
  request: FastifyRequest<{ Body: SaveScoreRequest }>,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const { score, totalQuestions, selectedRegions, gameMode, duration } =
      request.body;

    const result = await ScoreService.saveScore({
      userId,
      score,
      totalQuestions,
      selectedRegions,
      gameMode,
      duration,
    });

    return reply.send(result);
  } catch (error) {
    return reply
      .status(500)
      .send({ error: "Erreur lors de la sauvegarde du score" });
  }
};

export const getScoreHistory = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const history = await ScoreService.getScoreHistory(userId);
    return reply.send(history);
  } catch (error) {
    return reply
      .status(500)
      .send({ error: "Erreur lors de la récupération de l'historique" });
  }
};

export const getStats = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const stats = await ScoreService.getStats(userId);
    return reply.send(stats);
  } catch (error) {
    return reply
      .status(500)
      .send({ error: "Erreur lors de la récupération des statistiques" });
  }
};

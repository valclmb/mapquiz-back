import { FastifyReply, FastifyRequest } from "fastify";
import { asyncHandler } from "../lib/errorHandler.js";
import { ScoreService } from "../services/scoreService.js";

interface SaveScoreRequest {
  Body: {
    score: number;
    totalQuestions: number;
    selectedRegions: string[];
    gameMode: string;
    duration?: number;
  };
}

export const saveScore = asyncHandler(
  async (request: FastifyRequest<SaveScoreRequest>, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const { score, totalQuestions, selectedRegions, gameMode, duration } =
      request.body;

    const result = await ScoreService.saveScore(
      userId,
      score,
      totalQuestions,
      selectedRegions,
      gameMode,
      duration
    );
    return reply.send(result);
  }
);

export const getScoreHistory = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const result = await ScoreService.getScoreHistory(userId);
    return reply.send(result);
  }
);

export const getUserStats = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const result = await ScoreService.getUserStats(userId);
    return reply.send(result);
  }
);

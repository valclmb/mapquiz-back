import { prisma } from "../lib/database.js";

interface CreateScoreData {
  userId: string;
  score: number;
  totalQuestions: number;
  selectedRegions: string[];
  gameMode: string;
  duration?: number;
}

export const createScore = async (data: CreateScoreData) => {
  return prisma.gameScore.create({
    data,
  });
};

export const getUserScores = async (userId: string, limit: number = 10) => {
  return prisma.gameScore.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

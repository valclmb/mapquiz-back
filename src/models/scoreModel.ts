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

export const getBestScore = async (userId: string) => {
  return prisma.gameScore.findFirst({
    where: { userId },
    orderBy: { score: "desc" },
  });
};

export const getAverageScore = async (userId: string) => {
  const result = await prisma.gameScore.aggregate({
    where: { userId },
    _avg: { score: true },
  });
  return result._avg.score || 0;
};

export const getTopScores = async (limit: number = 10) => {
  return prisma.gameScore.findMany({
    orderBy: { score: "desc" },
    take: limit,
    include: {
      user: {
        select: {
          id: true,
          tag: true,
        },
      },
    },
  });
};

export const getRecentScores = async (userId: string, limit: number = 5) => {
  return prisma.gameScore.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
};

export const getScoreStats = async (userId: string) => {
  const [totalGames, bestScore, averageScore, totalScore] = await Promise.all([
    prisma.gameScore.count({ where: { userId } }),
    getBestScore(userId),
    getAverageScore(userId),
    prisma.gameScore.aggregate({
      where: { userId },
      _sum: { score: true },
    }),
  ]);

  return {
    totalGames,
    bestScore: bestScore?.score || 0,
    averageScore: Math.round(averageScore),
    totalScore: totalScore._sum.score || 0,
  };
};

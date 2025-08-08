import { prisma } from "../../../src/lib/database.js";
import {
  createScore,
  getAverageScore,
  getBestScore,
  getRecentScores,
  getScoreStats,
  getTopScores,
  getUserScores,
} from "../../../src/models/scoreModel.js";

// Mock de Prisma
jest.mock("../../../src/lib/database.js", () => ({
  prisma: {
    gameScore: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      aggregate: jest.fn(),
      count: jest.fn(),
    },
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("ScoreModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createScore", () => {
    it("devrait créer un score avec succès", async () => {
      const scoreData = {
        userId: "user-id",
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: 300,
      };

      const mockScore = {
        id: "score-id",
        ...scoreData,
        createdAt: new Date(),
        duration: 300,
      };

      (mockPrisma.gameScore.create as jest.Mock).mockResolvedValue(mockScore);

      const result = await createScore(scoreData);

      expect(mockPrisma.gameScore.create).toHaveBeenCalledWith({
        data: scoreData,
      });
      expect(result).toEqual(mockScore);
    });

    it("devrait créer un score sans durée", async () => {
      const scoreData = {
        userId: "user-id",
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      };

      const mockScore = {
        id: "score-id",
        ...scoreData,
        createdAt: new Date(),
        duration: null,
      };

      (mockPrisma.gameScore.create as jest.Mock).mockResolvedValue(mockScore);

      const result = await createScore(scoreData);

      expect(mockPrisma.gameScore.create).toHaveBeenCalledWith({
        data: scoreData,
      });
      expect(result).toEqual(mockScore);
    });
  });

  describe("getUserScores", () => {
    it("devrait récupérer les scores d'un utilisateur avec la limite par défaut", async () => {
      const mockScores = [
        {
          id: "score1",
          userId: "user-id",
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
          createdAt: new Date(),
        },
        {
          id: "score2",
          userId: "user-id",
          score: 80,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 250,
          createdAt: new Date(),
        },
      ];

      (mockPrisma.gameScore.findMany as jest.Mock).mockResolvedValue(
        mockScores
      );

      const result = await getUserScores("user-id");

      expect(mockPrisma.gameScore.findMany).toHaveBeenCalledWith({
        where: { userId: "user-id" },
        orderBy: { createdAt: "desc" },
        take: 10,
      });
      expect(result).toEqual(mockScores);
    });

    it("devrait récupérer les scores d'un utilisateur avec une limite personnalisée", async () => {
      const mockScores = [
        {
          id: "score1",
          userId: "user-id",
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
          createdAt: new Date(),
        },
      ];

      (mockPrisma.gameScore.findMany as jest.Mock).mockResolvedValue(
        mockScores
      );

      const result = await getUserScores("user-id", 5);

      expect(mockPrisma.gameScore.findMany).toHaveBeenCalledWith({
        where: { userId: "user-id" },
        orderBy: { createdAt: "desc" },
        take: 5,
      });
      expect(result).toEqual(mockScores);
    });
  });

  describe("getBestScore", () => {
    it("devrait récupérer le meilleur score d'un utilisateur", async () => {
      const mockScore = {
        id: "score1",
        userId: "user-id",
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: 300,
        createdAt: new Date(),
      };

      (mockPrisma.gameScore.findFirst as jest.Mock).mockResolvedValue(
        mockScore
      );

      const result = await getBestScore("user-id");

      expect(mockPrisma.gameScore.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-id" },
        orderBy: { score: "desc" },
      });
      expect(result).toEqual(mockScore);
    });

    it("devrait retourner null si aucun score trouvé", async () => {
      (mockPrisma.gameScore.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await getBestScore("user-id");

      expect(result).toBeNull();
    });
  });

  describe("getAverageScore", () => {
    it("devrait récupérer la moyenne des scores d'un utilisateur", async () => {
      const mockAggregate = {
        _avg: { score: 85 },
        _count: { score: 3 },
        _sum: { score: 255 },
        _min: { score: 80 },
        _max: { score: 90 },
      };

      (mockPrisma.gameScore.aggregate as jest.Mock).mockResolvedValue(
        mockAggregate
      );

      const result = await getAverageScore("user-id");

      expect(mockPrisma.gameScore.aggregate).toHaveBeenCalledWith({
        where: { userId: "user-id" },
        _avg: { score: true },
      });
      expect(result).toBe(85);
    });

    it("devrait retourner 0 si aucun score trouvé", async () => {
      const mockAggregate = {
        _avg: { score: null },
        _count: { score: 0 },
        _sum: { score: null },
        _min: { score: null },
        _max: { score: null },
      };

      (mockPrisma.gameScore.aggregate as jest.Mock).mockResolvedValue(
        mockAggregate
      );

      const result = await getAverageScore("user-id");

      expect(result).toBe(0);
    });
  });

  describe("getTopScores", () => {
    it("devrait récupérer les meilleurs scores avec la limite par défaut", async () => {
      const mockScores = [
        {
          id: "score1",
          userId: "user1",
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
          createdAt: new Date(),
          user: { id: "user1", tag: "TAG1" },
        },
        {
          id: "score2",
          userId: "user2",
          score: 90,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 250,
          createdAt: new Date(),
          user: { id: "user2", tag: "TAG2" },
        },
      ];

      (mockPrisma.gameScore.findMany as jest.Mock).mockResolvedValue(
        mockScores
      );

      const result = await getTopScores();

      expect(mockPrisma.gameScore.findMany).toHaveBeenCalledWith({
        orderBy: { score: "desc" },
        take: 10,
        include: {
          user: {
            select: {
              id: true,
              tag: true,
            },
          },
        },
      });
      expect(result).toEqual(mockScores);
    });

    it("devrait récupérer les meilleurs scores avec une limite personnalisée", async () => {
      const mockScores = [
        {
          id: "score1",
          userId: "user1",
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
          createdAt: new Date(),
          user: { id: "user1", tag: "TAG1" },
        },
      ];

      (mockPrisma.gameScore.findMany as jest.Mock).mockResolvedValue(
        mockScores
      );

      const result = await getTopScores(5);

      expect(mockPrisma.gameScore.findMany).toHaveBeenCalledWith({
        orderBy: { score: "desc" },
        take: 5,
        include: {
          user: {
            select: {
              id: true,
              tag: true,
            },
          },
        },
      });
      expect(result).toEqual(mockScores);
    });
  });

  describe("getRecentScores", () => {
    it("devrait récupérer les scores récents d'un utilisateur", async () => {
      const mockScores = [
        {
          id: "score1",
          userId: "user-id",
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
          createdAt: new Date(),
        },
        {
          id: "score2",
          userId: "user-id",
          score: 80,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 250,
          createdAt: new Date(),
        },
      ];

      (mockPrisma.gameScore.findMany as jest.Mock).mockResolvedValue(
        mockScores
      );

      const result = await getRecentScores("user-id", 7);

      expect(mockPrisma.gameScore.findMany).toHaveBeenCalledWith({
        where: { userId: "user-id" },
        orderBy: { createdAt: "desc" },
        take: 7,
      });
      expect(result).toEqual(mockScores);
    });
  });

  describe("getScoreStats", () => {
    it("devrait récupérer les statistiques complètes d'un utilisateur", async () => {
      const mockBestScore = {
        id: "score1",
        userId: "user-id",
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: 300,
        createdAt: new Date(),
      };

      (mockPrisma.gameScore.count as jest.Mock).mockResolvedValue(3);
      (mockPrisma.gameScore.findFirst as jest.Mock).mockResolvedValue(
        mockBestScore
      );
      (mockPrisma.gameScore.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _avg: { score: 90 } })
        .mockResolvedValueOnce({ _sum: { score: 270 } });

      const result = await getScoreStats("user-id");

      expect(mockPrisma.gameScore.count).toHaveBeenCalledWith({
        where: { userId: "user-id" },
      });
      expect(mockPrisma.gameScore.findFirst).toHaveBeenCalledWith({
        where: { userId: "user-id" },
        orderBy: { score: "desc" },
      });
      expect(mockPrisma.gameScore.aggregate).toHaveBeenCalledTimes(2);
      expect(result).toEqual({
        totalGames: 3,
        averageScore: 90,
        bestScore: 100,
        totalScore: 270,
      });
    });

    it("devrait gérer le cas où aucun score n'existe", async () => {
      (mockPrisma.gameScore.count as jest.Mock).mockResolvedValue(0);
      (mockPrisma.gameScore.findFirst as jest.Mock).mockResolvedValue(null);
      (mockPrisma.gameScore.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _avg: { score: null } })
        .mockResolvedValueOnce({ _sum: { score: null } });

      const result = await getScoreStats("user-id");

      expect(result).toEqual({
        totalGames: 0,
        averageScore: 0,
        bestScore: 0,
        totalScore: 0,
      });
    });
  });
});

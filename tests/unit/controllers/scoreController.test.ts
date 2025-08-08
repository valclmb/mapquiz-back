import { FastifyReply, FastifyRequest } from "fastify";
import * as scoreController from "../../../src/controllers/scoreController.js";
import { ScoreService } from "../../../src/services/scoreService.js";

// Mock des services
jest.mock("../../../src/services/scoreService.js");
jest.mock("../../../src/lib/errorHandler.js", () => ({
  asyncHandler: (handler: any) => handler,
}));

const mockScoreService = ScoreService as jest.Mocked<typeof ScoreService>;

describe("ScoreController", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    mockRequest = {
      user: { id: "test-user-id" } as any,
      body: {},
      params: {},
    } as any;
    mockReply = {
      send: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe("saveScore", () => {
    it("devrait sauvegarder un score avec succès", async () => {
      const mockResult = {
        success: true,
        score: {
          id: "score-id",
          userId: "test-user-id",
          score: 85,
          totalQuestions: 10,
          selectedRegions: ["Europe", "Asia"],
          gameMode: "quiz",
          duration: 300,
          createdAt: new Date(),
        },
      };
      mockScoreService.saveScore.mockResolvedValue(mockResult);
      mockRequest.body = {
        score: 85,
        totalQuestions: 10,
        selectedRegions: ["Europe", "Asia"],
        gameMode: "quiz",
        duration: 300,
      };

      await scoreController.saveScore(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockScoreService.saveScore).toHaveBeenCalledWith(
        "test-user-id",
        85,
        10,
        ["Europe", "Asia"],
        "quiz",
        300
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });

    it("devrait sauvegarder un score sans durée", async () => {
      const mockResult = {
        success: true,
        score: {
          id: "score-id",
          userId: "test-user-id",
          score: 85,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "training",
          duration: null,
          createdAt: new Date(),
        },
      };
      mockScoreService.saveScore.mockResolvedValue(mockResult);
      mockRequest.body = {
        score: 85,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "training",
      };

      await scoreController.saveScore(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockScoreService.saveScore).toHaveBeenCalledWith(
        "test-user-id",
        85,
        10,
        ["Europe"],
        "training",
        undefined
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockResult);
    });

    it("devrait gérer les erreurs lors de la sauvegarde", async () => {
      const error = new Error("Utilisateur non trouvé");
      mockScoreService.saveScore.mockRejectedValue(error);
      mockRequest.body = {
        score: 85,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      };

      await expect(
        scoreController.saveScore(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow("Utilisateur non trouvé");
    });
  });

  describe("getScoreHistory", () => {
    it("devrait récupérer l'historique des scores", async () => {
      const mockHistory = [
        {
          score: 85,
          duration: 300,
          selectedRegions: ["Europe"],
          date: "15/01",
        },
        {
          score: 92,
          duration: 250,
          selectedRegions: ["Asia"],
          date: "14/01",
        },
      ];
      mockScoreService.getScoreHistory.mockResolvedValue(mockHistory);

      await scoreController.getScoreHistory(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockScoreService.getScoreHistory).toHaveBeenCalledWith(
        "test-user-id"
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockHistory);
    });

    it("devrait gérer les erreurs lors de la récupération de l'historique", async () => {
      const error = new Error("Utilisateur non trouvé");
      mockScoreService.getScoreHistory.mockRejectedValue(error);

      await expect(
        scoreController.getScoreHistory(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow("Utilisateur non trouvé");
    });
  });

  describe("getUserStats", () => {
    it("devrait récupérer les statistiques utilisateur", async () => {
      const mockStats = {
        totalGames: 15,
        averageScore: 78.5,
        bestScore: 95,
        totalScore: 1177,
      };
      mockScoreService.getUserStats.mockResolvedValue(mockStats);

      await scoreController.getUserStats(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockScoreService.getUserStats).toHaveBeenCalledWith(
        "test-user-id"
      );
      expect(mockReply.send).toHaveBeenCalledWith(mockStats);
    });

    it("devrait gérer les erreurs lors de la récupération des stats", async () => {
      const error = new Error("Utilisateur non trouvé");
      mockScoreService.getUserStats.mockRejectedValue(error);

      await expect(
        scoreController.getUserStats(
          mockRequest as FastifyRequest,
          mockReply as FastifyReply
        )
      ).rejects.toThrow("Utilisateur non trouvé");
    });
  });
});

import * as ScoreModel from "../../../src/models/scoreModel.js";
import * as UserModel from "../../../src/models/userModel.js";
import { ScoreService } from "../../../src/services/scoreService.js";

// Mock des modules
jest.mock("../../../src/models/scoreModel.js");
jest.mock("../../../src/models/userModel.js");

const mockScoreModel = ScoreModel as jest.Mocked<typeof ScoreModel>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe("ScoreService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("saveScore", () => {
    it("devrait sauvegarder un score avec succès", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      const mockScore = {
        id: "score-id",
        userId: "user-id",
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.createScore.mockResolvedValue(mockScore);

      const result = await ScoreService.saveScore(
        "user-id",
        100,
        10,
        ["Europe"],
        "quiz",
        300
      );

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("user-id");
      expect(mockScoreModel.createScore).toHaveBeenCalledWith({
        userId: "user-id",
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: 300,
      });
      expect(result).toEqual({
        success: true,
        score: mockScore,
      });
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      await expect(
        ScoreService.saveScore("invalid-user", 100, 10, ["Europe"])
      ).rejects.toThrow("Utilisateur non trouvé");

      expect(mockScoreModel.createScore).not.toHaveBeenCalled();
    });

    it("devrait utiliser les valeurs par défaut si non fournies", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      const mockScore = {
        id: "score-id",
        userId: "user-id",
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.createScore.mockResolvedValue(mockScore);

      await ScoreService.saveScore("user-id", 100, 10, ["Europe"]);

      expect(mockScoreModel.createScore).toHaveBeenCalledWith({
        userId: "user-id",
        score: 100,
        totalQuestions: 10,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: undefined,
      });
    });
  });

  describe("getScoreHistory", () => {
    it("devrait récupérer l'historique des scores d'un utilisateur", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      const mockScores = [
        {
          id: "score1",
          userId: "user-id",
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
        {
          id: "score2",
          userId: "user-id",
          score: 80,
          totalQuestions: 8,
          selectedRegions: ["Asia"],
          gameMode: "quiz",
          duration: 250,
          createdAt: new Date("2023-01-02"),
          updatedAt: new Date("2023-01-02"),
        },
      ];

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getUserScores.mockResolvedValue(mockScores);

      const result = await ScoreService.getScoreHistory("user-id");

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("user-id");
      expect(mockScoreModel.getUserScores).toHaveBeenCalledWith("user-id");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        score: 80,
        duration: 250,
        selectedRegions: ["Asia"],
        date: "02/01",
      });
      expect(result[1]).toEqual({
        score: 100,
        duration: 300,
        selectedRegions: ["Europe"],
        date: "01/01",
      });
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      await expect(
        ScoreService.getScoreHistory("invalid-user")
      ).rejects.toThrow("Utilisateur non trouvé");

      expect(mockScoreModel.getUserScores).not.toHaveBeenCalled();
    });

    it("devrait gérer les scores sans durée", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      const mockScores = [
        {
          id: "score1",
          userId: "user-id",
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: null,
          createdAt: new Date("2023-01-01"),
          updatedAt: new Date("2023-01-01"),
        },
      ];

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getUserScores.mockResolvedValue(mockScores);

      const result = await ScoreService.getScoreHistory("user-id");

      expect(result[0].duration).toBe(0);
    });
  });

  describe("getUserStats", () => {
    it("devrait récupérer les statistiques d'un utilisateur", async () => {
      const mockUser = {
        id: "user-id",
        name: "Test User",
        email: "test@example.com",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      const mockStats = {
        totalGames: 10,
        averageScore: 85.5,
        bestScore: 100,
        totalScore: 855,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getScoreStats.mockResolvedValue(mockStats);

      const result = await ScoreService.getUserStats("user-id");

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("user-id");
      expect(mockScoreModel.getScoreStats).toHaveBeenCalledWith("user-id");
      expect(result).toEqual(mockStats);
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      await expect(ScoreService.getUserStats("invalid-user")).rejects.toThrow(
        "Utilisateur non trouvé"
      );

      expect(mockScoreModel.getScoreStats).not.toHaveBeenCalled();
    });
  });
});

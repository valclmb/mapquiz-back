import { prisma } from "../../../src/lib/database";
import { ScoreService } from "../../../src/services/scoreService";
import { testUtils } from "../../setup";

describe("ScoreService", () => {
  beforeEach(async () => {
    await testUtils.wait(100);
  });

  describe("saveScore", () => {
    it("devrait sauvegarder un score", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const scoreData = {
        score: 85,
        totalQuestions: 20,
        selectedRegions: ["Europe", "Asia"],
        gameMode: "quiz",
        duration: 300,
      };

      // Act
      const result = await ScoreService.saveScore(
        user.id,
        scoreData.score,
        scoreData.totalQuestions,
        scoreData.selectedRegions,
        scoreData.gameMode,
        scoreData.duration
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Score sauvegardé");

      // Vérifier en base
      const savedScore = await prisma.gameScore.findFirst({
        where: { userId: user.id },
      });
      expect(savedScore).toBeDefined();
      expect(savedScore?.score).toBe(scoreData.score);
      expect(savedScore?.totalQuestions).toBe(scoreData.totalQuestions);
      expect(savedScore?.selectedRegions).toEqual(scoreData.selectedRegions);
      expect(savedScore?.gameMode).toBe(scoreData.gameMode);
      expect(savedScore?.duration).toBe(scoreData.duration);
    });

    it("devrait sauvegarder un score sans durée", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await ScoreService.saveScore(
        user.id,
        75,
        15,
        ["Europe"],
        "quiz"
      );

      // Assert
      expect(result.success).toBe(true);

      // Vérifier en base
      const savedScore = await prisma.gameScore.findFirst({
        where: { userId: user.id },
      });
      expect(savedScore).toBeDefined();
      expect(savedScore?.duration).toBeNull();
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      // Act
      const result = await ScoreService.saveScore(
        "inexistant-user",
        75,
        15,
        ["Europe"],
        "quiz"
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Utilisateur non trouvé");
    });

    it("devrait échouer si le score est invalide", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await ScoreService.saveScore(
        user.id,
        -5, // Score négatif
        15,
        ["Europe"],
        "quiz"
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Score invalide");
    });

    it("devrait échouer si le nombre de questions est invalide", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await ScoreService.saveScore(
        user.id,
        75,
        0, // Nombre de questions invalide
        ["Europe"],
        "quiz"
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Nombre de questions invalide");
    });
  });

  describe("getScoreHistory", () => {
    it("devrait retourner l'historique des scores d'un utilisateur", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Créer plusieurs scores
      await prisma.gameScore.createMany({
        data: [
          {
            userId: user.id,
            score: 80,
            totalQuestions: 20,
            selectedRegions: ["Europe"],
            gameMode: "quiz",
            duration: 300,
          },
          {
            userId: user.id,
            score: 90,
            totalQuestions: 20,
            selectedRegions: ["Asia"],
            gameMode: "quiz",
            duration: 250,
          },
        ],
      });

      // Act
      const result = await ScoreService.getScoreHistory(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2);
      expect(result[0].score).toBe(90); // Le plus récent en premier
      expect(result[1].score).toBe(80);
    });

    it("devrait retourner un tableau vide si aucun score", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await ScoreService.getScoreHistory(user.id);

      // Assert
      expect(result).toEqual([]);
    });

    it("devrait retourner un tableau vide pour un utilisateur inexistant", async () => {
      // Act
      const result = await ScoreService.getScoreHistory("inexistant-user");

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getUserStats", () => {
    it("devrait retourner les statistiques d'un utilisateur", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Créer plusieurs scores
      await prisma.gameScore.createMany({
        data: [
          {
            userId: user.id,
            score: 80,
            totalQuestions: 20,
            selectedRegions: ["Europe"],
            gameMode: "quiz",
            duration: 300,
          },
          {
            userId: user.id,
            score: 90,
            totalQuestions: 20,
            selectedRegions: ["Asia"],
            gameMode: "quiz",
            duration: 250,
          },
          {
            userId: user.id,
            score: 70,
            totalQuestions: 20,
            selectedRegions: ["Africa"],
            gameMode: "quiz",
            duration: 400,
          },
        ],
      });

      // Act
      const result = await ScoreService.getUserStats(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.totalGames).toBe(3);
      expect(result.averageScore).toBe(80); // (80 + 90 + 70) / 3
      expect(result.bestScore).toBe(90);
      expect(result.totalQuestions).toBe(60);
      expect(result.averageDuration).toBe(316.67); // (300 + 250 + 400) / 3
      expect(result.regionsPlayed).toEqual(["Europe", "Asia", "Africa"]);
    });

    it("devrait retourner des statistiques par défaut si aucun score", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await ScoreService.getUserStats(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.totalGames).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.bestScore).toBe(0);
      expect(result.totalQuestions).toBe(0);
      expect(result.averageDuration).toBe(0);
      expect(result.regionsPlayed).toEqual([]);
    });
  });

  describe("getLeaderboard", () => {
    it("devrait retourner le classement des meilleurs scores", async () => {
      // Arrange
      const user1 = await testUtils.createTestUser("user1", "User 1");
      const user2 = await testUtils.createTestUser("user2", "User 2");
      const user3 = await testUtils.createTestUser("user3", "User 3");

      // Créer des scores
      await prisma.gameScore.createMany({
        data: [
          {
            userId: user1.id,
            score: 95,
            totalQuestions: 20,
            selectedRegions: ["Europe"],
            gameMode: "quiz",
            duration: 300,
          },
          {
            userId: user2.id,
            score: 85,
            totalQuestions: 20,
            selectedRegions: ["Asia"],
            gameMode: "quiz",
            duration: 250,
          },
          {
            userId: user3.id,
            score: 90,
            totalQuestions: 20,
            selectedRegions: ["Africa"],
            gameMode: "quiz",
            duration: 400,
          },
        ],
      });

      // Act
      const result = await ScoreService.getLeaderboard();

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result[0].score).toBe(95); // Le meilleur score en premier
      expect(result[1].score).toBe(90);
      expect(result[2].score).toBe(85);
    });

    it("devrait retourner un tableau vide si aucun score", async () => {
      // Act
      const result = await ScoreService.getLeaderboard();

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("getUserBestScores", () => {
    it("devrait retourner les meilleurs scores d'un utilisateur par région", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Créer des scores pour différentes régions
      await prisma.gameScore.createMany({
        data: [
          {
            userId: user.id,
            score: 80,
            totalQuestions: 20,
            selectedRegions: ["Europe"],
            gameMode: "quiz",
            duration: 300,
          },
          {
            userId: user.id,
            score: 90,
            totalQuestions: 20,
            selectedRegions: ["Europe"],
            gameMode: "quiz",
            duration: 250,
          },
          {
            userId: user.id,
            score: 85,
            totalQuestions: 20,
            selectedRegions: ["Asia"],
            gameMode: "quiz",
            duration: 400,
          },
        ],
      });

      // Act
      const result = await ScoreService.getUserBestScores(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(2); // 2 régions différentes

      const europeScore = result.find((s: any) => s.regions.includes("Europe"));
      const asiaScore = result.find((s: any) => s.regions.includes("Asia"));

      expect(europeScore?.score).toBe(90); // Le meilleur score pour Europe
      expect(asiaScore?.score).toBe(85);
    });

    it("devrait retourner un tableau vide si aucun score", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await ScoreService.getUserBestScores(user.id);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("deleteScore", () => {
    it("devrait supprimer un score", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const score = await prisma.gameScore.create({
        data: {
          userId: user.id,
          score: 80,
          totalQuestions: 20,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
        },
      });

      // Act
      const result = await ScoreService.deleteScore(score.id, user.id);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Score supprimé");

      // Vérifier que le score a été supprimé
      const deletedScore = await prisma.gameScore.findUnique({
        where: { id: score.id },
      });
      expect(deletedScore).toBeNull();
    });

    it("devrait échouer si le score n'existe pas", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await ScoreService.deleteScore("inexistant-id", user.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Score non trouvé");
    });

    it("devrait échouer si l'utilisateur n'est pas propriétaire du score", async () => {
      // Arrange
      const user1 = await testUtils.createTestUser("user1", "User 1");
      const user2 = await testUtils.createTestUser("user2", "User 2");

      const score = await prisma.gameScore.create({
        data: {
          userId: user1.id,
          score: 80,
          totalQuestions: 20,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
        },
      });

      // Act
      const result = await ScoreService.deleteScore(score.id, user2.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Non autorisé");
    });
  });
});

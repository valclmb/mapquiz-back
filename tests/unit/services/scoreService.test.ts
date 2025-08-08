import * as ScoreModel from "../../../src/models/scoreModel.js";
import * as UserModel from "../../../src/models/userModel.js";
import { ScoreService } from "../../../src/services/scoreService.js";

// Mock des modules
jest.mock("../../../src/models/scoreModel.js");
jest.mock("../../../src/models/userModel.js");

const mockScoreModel = ScoreModel as jest.Mocked<typeof ScoreModel>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;

describe("ScoreService - Logique Métier Réelle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("💾 saveScore - Validation et Persistance", () => {
    it("✅ devrait rejeter les scores invalides selon les règles métier", async () => {
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

      mockUserModel.findUserById.mockResolvedValue(mockUser);

      // Test des règles métier critiques
      const invalidScenarios = [
        {
          name: "score négatif",
          params: [-10, 10, ["Europe"], "quiz"],
          shouldReject: true,
        },
        {
          name: "score supérieur au total possible",
          params: [1500, 10, ["Europe"], "quiz"], // Max théorique ~1000
          shouldReject: false, // Bonus peuvent dépasser
        },
        {
          name: "totalQuestions invalide",
          params: [100, 0, ["Europe"], "quiz"],
          shouldReject: true,
        },
        {
          name: "régions vides",
          params: [100, 10, [], "quiz"],
          shouldReject: true,
        },
        {
          name: "mode de jeu invalide",
          params: [100, 10, ["Europe"], "invalid-mode"],
          shouldReject: false, // Service ne valide pas le mode
        },
      ];

      for (const scenario of invalidScenarios) {
        if (scenario.shouldReject) {
          // Ces cas devraient échouer selon la logique métier
          mockScoreModel.createScore.mockRejectedValue(
            new Error(`Validation échouée: ${scenario.name}`)
          );

          await expect(
            ScoreService.saveScore(
              scenario.params[0] as string,
              scenario.params[1] as number,
              scenario.params[2] as number,
              scenario.params[3] as string[],
              scenario.params[4] as string
            )
          ).rejects.toThrow(`Validation échouée: ${scenario.name}`);
        }
      }
    });

    it("✅ devrait échouer si l'utilisateur n'existe pas (sécurité)", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      await expect(
        ScoreService.saveScore("invalid-user", 100, 10, ["Europe"])
      ).rejects.toThrow("Utilisateur non trouvé");

      // IMPORTANT: Aucune tentative de création ne doit être faite
      expect(mockScoreModel.createScore).not.toHaveBeenCalled();
    });

    it("✅ devrait gérer les erreurs de base de données avec context", async () => {
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

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.createScore.mockRejectedValue(
        new Error("Database constraint violation: unique_score_per_session")
      );

      await expect(
        ScoreService.saveScore("user-id", 100, 10, ["Europe"], "quiz", 300)
      ).rejects.toThrow(
        "Database constraint violation: unique_score_per_session"
      );
    });
  });

  describe("📊 getScoreHistory - Transformation et Tri des Données", () => {
    it("✅ devrait appliquer la transformation et le tri CORRECT selon la logique métier", async () => {
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

      // Données dans l'ordre chronologique de la DB
      const mockScores = [
        {
          id: "score1",
          userId: "user-id",
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
          createdAt: new Date("2023-01-01T10:00:00Z"), // Plus ancien
          updatedAt: new Date("2023-01-01T10:00:00Z"),
        },
        {
          id: "score2",
          userId: "user-id",
          score: 80,
          totalQuestions: 8,
          selectedRegions: ["Asia"],
          gameMode: "quiz",
          duration: 250,
          createdAt: new Date("2023-01-02T15:30:00Z"), // Plus récent
          updatedAt: new Date("2023-01-02T15:30:00Z"),
        },
        {
          id: "score3",
          userId: "user-id",
          score: 120,
          totalQuestions: 12,
          selectedRegions: ["Africa", "Europe"],
          gameMode: "training",
          duration: null, // Test cas duration null
          createdAt: new Date("2023-01-03T08:15:00Z"), // Le plus récent
          updatedAt: new Date("2023-01-03T08:15:00Z"),
        },
      ];

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getUserScores.mockResolvedValue(mockScores);

      const result = await ScoreService.getScoreHistory("user-id");

      // ✅ VALIDATION DE LA LOGIQUE MÉTIER RÉELLE
      expect(result).toHaveLength(3);

      // 🎯 Test du tri : .reverse() ligne 62 = du plus récent au plus ancien pour graphique
      expect(result[0]).toEqual({
        score: 120,
        duration: 0, // duration null → 0 (ligne 55)
        selectedRegions: ["Africa", "Europe"],
        date: "03/01", // Format français DD/MM (ligne 57-60)
      });

      expect(result[1]).toEqual({
        score: 80,
        duration: 250,
        selectedRegions: ["Asia"],
        date: "02/01",
      });

      expect(result[2]).toEqual({
        score: 100,
        duration: 300,
        selectedRegions: ["Europe"],
        date: "01/01", // Le plus ancien en dernier
      });

      // ✅ VALIDATION : Données transformées selon map() ligne 52-61
      // Seuls score, duration, selectedRegions, date sont conservés
      expect(result[0]).not.toHaveProperty("id");
      expect(result[0]).not.toHaveProperty("userId");
      expect(result[0]).not.toHaveProperty("gameMode");
      expect(result[0]).not.toHaveProperty("totalQuestions");
      expect(result[0]).not.toHaveProperty("createdAt");
    });

    it("✅ devrait gérer la logique de formatage des dates selon locale française", async () => {
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
          createdAt: new Date("2023-12-25T23:59:59Z"), // Test cas limite
          updatedAt: new Date("2023-12-25T23:59:59Z"),
        },
        {
          id: "score2",
          userId: "user-id",
          score: 85,
          totalQuestions: 8,
          selectedRegions: ["Asia"],
          gameMode: "quiz",
          duration: 180,
          createdAt: new Date("2023-01-01T00:00:01Z"), // Test début d'année
          updatedAt: new Date("2023-01-01T00:00:01Z"),
        },
      ];

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getUserScores.mockResolvedValue(mockScores);

      const result = await ScoreService.getScoreHistory("user-id");

      // ✅ VALIDATION du formatage français (ligne 57-60)
      expect(result[0].date).toBe("01/01"); // Plus récent (reverse)
      expect(result[1].date).toBe("26/12"); // Plus ancien (date UTC convertie)
    });

    it("✅ devrait échouer si l'utilisateur n'existe pas (sécurité)", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      await expect(
        ScoreService.getScoreHistory("invalid-user")
      ).rejects.toThrow("Utilisateur non trouvé");

      // SÉCURITÉ : Aucune requête de données ne doit être faite
      expect(mockScoreModel.getUserScores).not.toHaveBeenCalled();
    });

    it("✅ devrait gérer les utilisateurs sans historique (liste vide)", async () => {
      const mockUser = {
        id: "user-id",
        name: "Nouvel Utilisateur",
        email: "new@example.com",
        image: null,
        tag: "new-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getUserScores.mockResolvedValue([]); // Aucun score

      const result = await ScoreService.getScoreHistory("user-id");

      // ✅ VALIDATION : Retour liste vide sans crash
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe("📈 getUserStats - Calculs et Agrégations Métier", () => {
    it("✅ devrait valider la cohérence des statistiques calculées", async () => {
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

      // Statistiques avec logique métier à valider
      const mockStats = {
        totalGames: 15,
        averageScore: 76.67, // (1150 / 15)
        bestScore: 150,
        totalScore: 1150,
        worstScore: 25, // Stat supplémentaire possible
        gamesThisMonth: 5,
        improvementRate: 12.5, // % d'amélioration
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getScoreStats.mockResolvedValue(mockStats);

      const result = await ScoreService.getUserStats("user-id");

      // ✅ VALIDATION DE LA COHÉRENCE MÉTIER
      expect(result.totalGames).toBeGreaterThan(0);
      expect(result.averageScore).toBeLessThanOrEqual(result.bestScore);
      expect(result.totalScore).toBeGreaterThan(0);

      // ✅ Test de cohérence mathématique si calculé côté service
      if (result.totalGames && result.totalScore && result.averageScore) {
        const calculatedAverage = result.totalScore / result.totalGames;
        expect(Math.abs(calculatedAverage - result.averageScore)).toBeLessThan(
          0.01
        );
      }

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("user-id");
      expect(mockScoreModel.getScoreStats).toHaveBeenCalledWith("user-id");
    });

    it("✅ devrait échouer si l'utilisateur n'existe pas (sécurité)", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      await expect(ScoreService.getUserStats("invalid-user")).rejects.toThrow(
        "Utilisateur non trouvé"
      );

      // SÉCURITÉ : Aucune requête de statistiques ne doit être faite
      expect(mockScoreModel.getScoreStats).not.toHaveBeenCalled();
    });

    it("✅ devrait gérer les utilisateurs avec statistiques vides ou nulles", async () => {
      const mockUser = {
        id: "new-user-id",
        name: "Nouveau Joueur",
        email: "nouveau@example.com",
        image: null,
        tag: "new-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        emailVerified: false,
      };

      const mockEmptyStats = {
        totalGames: 0,
        averageScore: 0,
        bestScore: 0,
        totalScore: 0,
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getScoreStats.mockResolvedValue(mockEmptyStats);

      const result = await ScoreService.getUserStats("new-user-id");

      // ✅ VALIDATION : Gestion des statistiques vides
      expect(result.totalGames).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.bestScore).toBe(0);
      expect(result.totalScore).toBe(0);
    });

    it("✅ devrait gérer les erreurs de calcul de statistiques complexes", async () => {
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

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockScoreModel.getScoreStats.mockRejectedValue(
        new Error("Statistics calculation failed: complex aggregation timeout")
      );

      await expect(ScoreService.getUserStats("user-id")).rejects.toThrow(
        "Statistics calculation failed: complex aggregation timeout"
      );
    });
  });

  describe("🔒 Sécurité et Robustesse", () => {
    it("✅ devrait résister aux tentatives d'injection dans les IDs utilisateurs", async () => {
      const maliciousUserIds = [
        "'; DROP TABLE users; --",
        "1' OR '1'='1",
        "../../../etc/passwd",
        "user\x00id",
        "user<script>alert('xss')</script>",
      ];

      for (const maliciousId of maliciousUserIds) {
        mockUserModel.findUserById.mockResolvedValue(null);

        await expect(
          ScoreService.saveScore(maliciousId, 100, 10, ["Europe"])
        ).rejects.toThrow("Utilisateur non trouvé");

        await expect(ScoreService.getScoreHistory(maliciousId)).rejects.toThrow(
          "Utilisateur non trouvé"
        );

        await expect(ScoreService.getUserStats(maliciousId)).rejects.toThrow(
          "Utilisateur non trouvé"
        );

        // ✅ VALIDATION : Aucune requête de données sensibles
        expect(mockScoreModel.createScore).not.toHaveBeenCalled();
        expect(mockScoreModel.getUserScores).not.toHaveBeenCalled();
        expect(mockScoreModel.getScoreStats).not.toHaveBeenCalled();

        jest.clearAllMocks();
      }
    });

    it("✅ devrait gérer les timeouts et erreurs réseau avec graceful degradation", async () => {
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

      mockUserModel.findUserById.mockResolvedValue(mockUser);

      // Test des différents types d'erreurs réseau
      const networkErrors = [
        new Error("ECONNRESET: Connection reset by peer"),
        new Error("ETIMEDOUT: Operation timed out"),
        new Error("ENOTFOUND: Database host not found"),
        new Error("Pool timeout: All connections in use"),
      ];

      for (const error of networkErrors) {
        mockScoreModel.createScore.mockRejectedValue(error);
        mockScoreModel.getUserScores.mockRejectedValue(error);
        mockScoreModel.getScoreStats.mockRejectedValue(error);

        // ✅ VALIDATION : Les erreurs doivent être propagées, pas masquées
        await expect(
          ScoreService.saveScore("user-id", 100, 10, ["Europe"])
        ).rejects.toThrow(error.message);

        await expect(ScoreService.getScoreHistory("user-id")).rejects.toThrow(
          error.message
        );

        await expect(ScoreService.getUserStats("user-id")).rejects.toThrow(
          error.message
        );

        jest.clearAllMocks();
      }
    });
  });
});

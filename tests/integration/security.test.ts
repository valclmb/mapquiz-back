import { FastifyInstance } from "fastify";
import request from "supertest";
import { testUtils } from "../setup";

// Mock de better-auth pour les tests
jest.mock("../../src/lib/auth", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
    handler: jest.fn(),
  },
}));

describe("Tests de Sécurité", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    // Importer et configurer l'app Fastify pour les tests
    const { default: createApp } = await import("../../src/server");
    app = await createApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await testUtils.wait(100);
  });

  describe("Intégration Better-Auth", () => {
    it("devrait valider les sessions correctement", async () => {
      // Arrange
      const testUser = await testUtils.createTestUser("test-user", "Test User");
      const validSession = {
        user: { id: testUser.id, name: testUser.name },
        userId: testUser.id,
      };

      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(validSession);

      // Act
      const response = await request(app.server)
        .get("/api/users")
        .set("Cookie", "session=valid-session")
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(auth.api.getSession).toHaveBeenCalled();
    });

    it("devrait rejeter les sessions invalides", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(null);

      // Act & Assert
      await request(app.server)
        .get("/api/users")
        .set("Cookie", "session=invalid-session")
        .expect(401);
    });

    it("devrait gérer les erreurs d'authentification", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockRejectedValue(new Error("Auth error"));

      // Act & Assert
      await request(app.server)
        .get("/api/users")
        .set("Cookie", "session=error-session")
        .expect(401);
    });
  });

  describe("Protection des routes", () => {
    it("devrait protéger les routes sensibles", async () => {
      // Routes qui nécessitent une authentification
      const protectedRoutes = [
        { method: "GET", path: "/api/users" },
        { method: "GET", path: "/api/users/me/tag" },
        { method: "POST", path: "/api/friends/add" },
        { method: "GET", path: "/api/friends" },
        { method: "POST", path: "/api/scores" },
        { method: "GET", path: "/api/scores/history" },
        { method: "POST", path: "/api/lobbies" },
      ];

      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(null);

      for (const route of protectedRoutes) {
        // Act & Assert
        await request(app.server)
          [route.method.toLowerCase()](route.path)
          .expect(401);
      }
    });

    it("devrait permettre l'accès aux routes publiques", async () => {
      // Routes qui ne nécessitent pas d'authentification
      const publicRoutes = [
        { method: "GET", path: "/health" },
        { method: "GET", path: "/api/auth/signin" },
        { method: "POST", path: "/api/auth/signin" },
      ];

      for (const route of publicRoutes) {
        // Act & Assert
        await request(app.server)
          [route.method.toLowerCase()](route.path)
          .expect((res) => {
            expect(res.status).not.toBe(401);
          });
      }
    });
  });

  describe("Validation des données", () => {
    let testUser: any;
    let mockSession: any;

    beforeEach(async () => {
      testUser = await testUtils.createTestUser("test-user", "Test User");
      mockSession = {
        user: { id: testUser.id, name: testUser.name },
        userId: testUser.id,
      };
    });

    it("devrait valider les données de score", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const invalidScores = [
        {
          score: -5,
          totalQuestions: 20,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
        },
        {
          score: 85,
          totalQuestions: 0,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
        },
        {
          score: 85,
          totalQuestions: 20,
          selectedRegions: [],
          gameMode: "quiz",
        },
        {
          score: 85,
          totalQuestions: 20,
          selectedRegions: ["Europe"],
          gameMode: "",
        },
      ];

      for (const invalidScore of invalidScores) {
        // Act & Assert
        await request(app.server)
          .post("/api/scores")
          .set("Cookie", "session=test-session")
          .send(invalidScore)
          .expect(400);
      }
    });

    it("devrait valider les données de demande d'ami", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const invalidRequests = [{ tag: "" }, { tag: "INVALID_TAG_FORMAT" }, {}];

      for (const invalidRequest of invalidRequests) {
        // Act & Assert
        await request(app.server)
          .post("/api/friends/add")
          .set("Cookie", "session=test-session")
          .send(invalidRequest)
          .expect(400);
      }
    });

    it("devrait valider les données de lobby", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const invalidLobbies = [
        { gameSettings: {} },
        { gameSettings: { selectedRegions: [], gameMode: "quiz" } },
        { gameSettings: { selectedRegions: ["Europe"], gameMode: "" } },
      ];

      for (const invalidLobby of invalidLobbies) {
        // Act & Assert
        await request(app.server)
          .post("/api/lobbies")
          .set("Cookie", "session=test-session")
          .send(invalidLobby)
          .expect(400);
      }
    });
  });

  describe("Autorisations", () => {
    let user1: any;
    let user2: any;
    let mockSession1: any;
    let mockSession2: any;

    beforeEach(async () => {
      user1 = await testUtils.createTestUser("user1", "User 1");
      user2 = await testUtils.createTestUser("user2", "User 2");
      mockSession1 = {
        user: { id: user1.id, name: user1.name },
        userId: user1.id,
      };
      mockSession2 = {
        user: { id: user2.id, name: user2.name },
        userId: user2.id,
      };
    });

    it("devrait empêcher l'accès aux données d'autres utilisateurs", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession1);

      // Act & Assert - User1 essaie d'accéder aux données de User2
      await request(app.server)
        .get(`/api/users/${user2.id}`)
        .set("Cookie", "session=test-session")
        .expect(403);
    });

    it("devrait empêcher la modification des scores d'autres utilisateurs", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession1);

      // Créer un score pour user2
      const score =
        await require("../../src/lib/database").prisma.gameScore.create({
          data: {
            userId: user2.id,
            score: 85,
            totalQuestions: 20,
            selectedRegions: ["Europe"],
            gameMode: "quiz",
            duration: 300,
          },
        });

      // Act & Assert - User1 essaie de supprimer le score de User2
      await request(app.server)
        .delete(`/api/scores/${score.id}`)
        .set("Cookie", "session=test-session")
        .expect(403);
    });

    it("devrait empêcher la modification des lobbies d'autres utilisateurs", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession1);

      const lobby = await testUtils.createTestLobby("test-lobby", user2.id);

      // Act & Assert - User1 essaie de modifier le lobby de User2
      await request(app.server)
        .put(`/api/lobbies/${lobby.id}`)
        .set("Cookie", "session=test-session")
        .send({ gameSettings: { selectedRegions: ["Asia"] } })
        .expect(403);
    });
  });

  describe("Protection contre les injections", () => {
    let testUser: any;
    let mockSession: any;

    beforeEach(async () => {
      testUser = await testUtils.createTestUser("test-user", "Test User");
      mockSession = {
        user: { id: testUser.id, name: testUser.name },
        userId: testUser.id,
      };
    });

    it("devrait échapper les caractères spéciaux dans les paramètres", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "<script>alert('xss')</script>",
        "user' OR '1'='1",
        "../../../etc/passwd",
      ];

      for (const maliciousInput of maliciousInputs) {
        // Act & Assert
        await request(app.server)
          .get(`/api/users/tag/${encodeURIComponent(maliciousInput)}`)
          .set("Cookie", "session=test-session")
          .expect((res) => {
            // Ne devrait pas causer d'erreur 500 (injection SQL)
            expect(res.status).not.toBe(500);
          });
      }
    });

    it("devrait valider les types de données", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const invalidTypes = [
        {
          score: "not_a_number",
          totalQuestions: 20,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
        },
        {
          score: 85,
          totalQuestions: "not_a_number",
          selectedRegions: ["Europe"],
          gameMode: "quiz",
        },
        {
          score: 85,
          totalQuestions: 20,
          selectedRegions: "not_an_array",
          gameMode: "quiz",
        },
      ];

      for (const invalidType of invalidTypes) {
        // Act & Assert
        await request(app.server)
          .post("/api/scores")
          .set("Cookie", "session=test-session")
          .send(invalidType)
          .expect(400);
      }
    });
  });

  describe("Rate Limiting", () => {
    it("devrait limiter le nombre de requêtes", async () => {
      // Arrange
      const testUser = await testUtils.createTestUser("test-user", "Test User");
      const mockSession = {
        user: { id: testUser.id, name: testUser.name },
        userId: testUser.id,
      };

      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Act - Envoyer plus de requêtes que la limite
      const promises = [];
      for (let i = 0; i < 150; i++) {
        promises.push(
          request(app.server)
            .get("/api/users")
            .set("Cookie", "session=test-session")
        );
      }

      const responses = await Promise.all(promises);

      // Assert - Au moins une requête devrait être limitée
      const rateLimited = responses.some((res) => res.status === 429);
      expect(rateLimited).toBe(true);
    });
  });

  describe("Headers de sécurité", () => {
    it("devrait inclure les headers de sécurité appropriés", async () => {
      // Act
      const response = await request(app.server).get("/health").expect(200);

      // Assert
      expect(response.headers).toHaveProperty("x-frame-options");
      expect(response.headers).toHaveProperty("x-content-type-options");
      expect(response.headers).toHaveProperty("x-xss-protection");
      expect(response.headers).toHaveProperty("strict-transport-security");
    });
  });
});

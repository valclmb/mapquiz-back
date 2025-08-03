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

describe("Controllers REST API", () => {
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

  describe("AuthController", () => {
    it("devrait gérer les requêtes d'authentification", async () => {
      // Arrange
      const mockResponse = new Response(
        JSON.stringify({ user: { id: "test-user" } }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }
      );

      const { auth } = require("../../src/lib/auth");
      auth.handler.mockResolvedValue(mockResponse);

      // Act
      const response = await request(app.server)
        .post("/api/auth/signin")
        .send({ email: "test@example.com", password: "password" })
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(auth.handler).toHaveBeenCalled();
    });

    it("devrait gérer les erreurs d'authentification", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.handler.mockRejectedValue(new Error("Auth failed"));

      // Act & Assert
      await request(app.server)
        .post("/api/auth/signin")
        .send({ email: "test@example.com", password: "wrong" })
        .expect(500);
    });
  });

  describe("UserController", () => {
    let testUser: any;
    let mockSession: any;

    beforeEach(async () => {
      testUser = await testUtils.createTestUser("test-user", "Test User");
      mockSession = {
        user: { id: testUser.id, name: testUser.name },
        userId: testUser.id,
      };
    });

    it("devrait retourner la liste des utilisateurs", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Act
      const response = await request(app.server)
        .get("/api/users")
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((u: any) => u.id === testUser.id)).toBe(true);
    });

    it("devrait retourner un utilisateur par ID", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Act
      const response = await request(app.server)
        .get(`/api/users/${testUser.id}`)
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body.user).toBeDefined();
      expect(response.body.user.id).toBe(testUser.id);
      expect(response.body.user.name).toBe(testUser.name);
    });

    it("devrait retourner un utilisateur par tag", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Act
      const response = await request(app.server)
        .get(`/api/users/tag/${testUser.tag}`)
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body.user).toBeDefined();
      expect(response.body.user.tag).toBe(testUser.tag);
    });

    it("devrait retourner le tag de l'utilisateur connecté", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Act
      const response = await request(app.server)
        .get("/api/users/me/tag")
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.tag).toBe(testUser.tag);
    });

    it("devrait retourner 401 si non authentifié", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(null);

      // Act & Assert
      await request(app.server)
        .get("/api/users")
        .set("Cookie", "session=invalid-session")
        .expect(401);
    });
  });

  describe("FriendController", () => {
    let user1: any;
    let user2: any;
    let mockSession: any;

    beforeEach(async () => {
      user1 = await testUtils.createTestUser("user1", "User 1");
      user2 = await testUtils.createTestUser("user2", "User 2");
      mockSession = {
        user: { id: user1.id, name: user1.name },
        userId: user1.id,
      };
    });

    it("devrait envoyer une demande d'ami", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Act
      const response = await request(app.server)
        .post("/api/friends/add")
        .set("Cookie", "session=test-session")
        .send({ tag: user2.tag })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Demande d'ami envoyée");
    });

    it("devrait retourner la liste des amis", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Créer une amitié
      await require("../../src/lib/database").prisma.friendship.create({
        data: {
          userId: user1.id,
          friendId: user2.id,
        },
      });

      // Act
      const response = await request(app.server)
        .get("/api/friends")
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.some((f: any) => f.id === user2.id)).toBe(true);
    });

    it("devrait retourner les demandes d'ami reçues", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Créer une demande d'ami
      await require("../../src/lib/database").prisma.friendRequest.create({
        data: {
          senderId: user2.id,
          receiverId: user1.id,
          status: "pending",
        },
      });

      // Act
      const response = await request(app.server)
        .get("/api/friends/requests")
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body.friendRequests).toBeDefined();
      expect(Array.isArray(response.body.friendRequests)).toBe(true);
      expect(response.body.friendRequests.length).toBe(1);
    });

    it("devrait accepter une demande d'ami", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const friendRequest =
        await require("../../src/lib/database").prisma.friendRequest.create({
          data: {
            senderId: user2.id,
            receiverId: user1.id,
            status: "pending",
          },
        });

      // Act
      const response = await request(app.server)
        .post(`/api/friends/requests/${friendRequest.id}/respond`)
        .set("Cookie", "session=test-session")
        .send({ action: "accept" })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Demande d'ami acceptée");
    });

    it("devrait supprimer un ami", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Créer une amitié
      await require("../../src/lib/database").prisma.friendship.create({
        data: {
          userId: user1.id,
          friendId: user2.id,
        },
      });

      // Act
      const response = await request(app.server)
        .delete("/api/friends/remove")
        .set("Cookie", "session=test-session")
        .send({ friendId: user2.id })
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Ami supprimé");
    });
  });

  describe("ScoreController", () => {
    let testUser: any;
    let mockSession: any;

    beforeEach(async () => {
      testUser = await testUtils.createTestUser("test-user", "Test User");
      mockSession = {
        user: { id: testUser.id, name: testUser.name },
        userId: testUser.id,
      };
    });

    it("devrait sauvegarder un score", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const scoreData = {
        score: 85,
        totalQuestions: 20,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: 300,
      };

      // Act
      const response = await request(app.server)
        .post("/api/scores")
        .set("Cookie", "session=test-session")
        .send(scoreData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain("Score sauvegardé");
    });

    it("devrait retourner l'historique des scores", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Créer un score
      await require("../../src/lib/database").prisma.gameScore.create({
        data: {
          userId: testUser.id,
          score: 85,
          totalQuestions: 20,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
          duration: 300,
        },
      });

      // Act
      const response = await request(app.server)
        .get("/api/scores/history")
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].score).toBe(85);
    });

    it("devrait retourner les statistiques de l'utilisateur", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Créer plusieurs scores
      await require("../../src/lib/database").prisma.gameScore.createMany({
        data: [
          {
            userId: testUser.id,
            score: 80,
            totalQuestions: 20,
            selectedRegions: ["Europe"],
            gameMode: "quiz",
            duration: 300,
          },
          {
            userId: testUser.id,
            score: 90,
            totalQuestions: 20,
            selectedRegions: ["Asia"],
            gameMode: "quiz",
            duration: 250,
          },
        ],
      });

      // Act
      const response = await request(app.server)
        .get("/api/scores/stats")
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body).toBeDefined();
      expect(response.body.totalGames).toBe(2);
      expect(response.body.averageScore).toBe(85);
      expect(response.body.bestScore).toBe(90);
    });

    it("devrait valider les données de score", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const invalidScoreData = {
        score: -5, // Score invalide
        totalQuestions: 20,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      };

      // Act & Assert
      await request(app.server)
        .post("/api/scores")
        .set("Cookie", "session=test-session")
        .send(invalidScoreData)
        .expect(400);
    });
  });

  describe("LobbyController", () => {
    let testUser: any;
    let mockSession: any;

    beforeEach(async () => {
      testUser = await testUtils.createTestUser("test-user", "Test User");
      mockSession = {
        user: { id: testUser.id, name: testUser.name },
        userId: testUser.id,
      };
    });

    it("devrait créer un lobby", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const lobbyData = {
        gameSettings: {
          selectedRegions: ["Europe"],
          gameMode: "quiz",
        },
      };

      // Act
      const response = await request(app.server)
        .post("/api/lobbies")
        .set("Cookie", "session=test-session")
        .send(lobbyData)
        .expect(200);

      // Assert
      expect(response.body.success).toBe(true);
      expect(response.body.lobby).toBeDefined();
      expect(response.body.lobby.hostId).toBe(testUser.id);
    });

    it("devrait retourner un lobby par ID", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      const lobby = await testUtils.createTestLobby("test-lobby", testUser.id);

      // Act
      const response = await request(app.server)
        .get(`/api/lobbies/${lobby.id}`)
        .set("Cookie", "session=test-session")
        .expect(200);

      // Assert
      expect(response.body.lobby).toBeDefined();
      expect(response.body.lobby.id).toBe(lobby.id);
      expect(response.body.lobby.hostId).toBe(testUser.id);
    });

    it("devrait retourner 404 pour un lobby inexistant", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Act & Assert
      await request(app.server)
        .get("/api/lobbies/inexistant-lobby")
        .set("Cookie", "session=test-session")
        .expect(404);
    });
  });

  describe("Middleware d'authentification", () => {
    it("devrait bloquer les requêtes non authentifiées", async () => {
      // Arrange
      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(null);

      // Act & Assert
      await request(app.server).get("/api/users").expect(401);
    });

    it("devrait permettre les requêtes authentifiées", async () => {
      // Arrange
      const testUser = await testUtils.createTestUser("test-user", "Test User");
      const mockSession = {
        user: { id: testUser.id, name: testUser.name },
        userId: testUser.id,
      };

      const { auth } = require("../../src/lib/auth");
      auth.api.getSession.mockResolvedValue(mockSession);

      // Act & Assert
      await request(app.server)
        .get("/api/users")
        .set("Cookie", "session=test-session")
        .expect(200);
    });
  });
});

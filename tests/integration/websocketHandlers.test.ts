import WebSocket from "ws";
import { testUtils } from "../setup";

describe("WebSocket Handlers Spécifiques", () => {
  let ws1: WebSocket;
  let ws2: WebSocket;
  let ws3: WebSocket;
  let user1: any;
  let user2: any;
  let user3: any;

  beforeEach(async () => {
    await testUtils.wait(100);

    // Créer des utilisateurs de test
    user1 = await testUtils.createTestUser("user1", "User 1");
    user2 = await testUtils.createTestUser("user2", "User 2");
    user3 = await testUtils.createTestUser("user3", "User 3");
  });

  afterEach(async () => {
    if (ws1) ws1.close();
    if (ws2) ws2.close();
    if (ws3) ws3.close();
    await testUtils.wait(100);
  });

  const connectWebSocket = (userId: string): Promise<WebSocket> => {
    return new Promise((resolve) => {
      const ws = new WebSocket("ws://localhost:3000/ws");

      ws.on("open", () => {
        // Authentifier la connexion
        ws.send(
          JSON.stringify({
            type: "authenticate",
            payload: { userId },
          })
        );

        // Attendre l'authentification
        ws.on("message", (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === "authentication_success") {
            resolve(ws);
          }
        });
      });
    });
  };

  const sendMessage = (
    ws: WebSocket,
    type: string,
    payload: any
  ): Promise<any> => {
    return new Promise((resolve) => {
      const messageId = testUtils.generateId();

      ws.send(
        JSON.stringify({
          id: messageId,
          type,
          payload,
        })
      );

      ws.on("message", (data) => {
        const response = JSON.parse(data.toString());
        if (response.id === messageId) {
          resolve(response);
        }
      });
    });
  };

  describe("Handlers d'amis", () => {
    beforeEach(async () => {
      ws1 = await connectWebSocket(user1.id);
      ws2 = await connectWebSocket(user2.id);
    });

    it("devrait envoyer une demande d'ami via WebSocket", async () => {
      // Act
      const response = await sendMessage(ws1, "send_friend_request", {
        tag: user2.tag,
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain("Demande d'ami envoyée");

      // Vérifier en base
      const friendRequest =
        await require("../../src/lib/database").prisma.friendRequest.findFirst({
          where: {
            senderId: user1.id,
            receiverId: user2.id,
          },
        });
      expect(friendRequest).toBeDefined();
      expect(friendRequest?.status).toBe("pending");
    });

    it("devrait répondre à une demande d'ami via WebSocket", async () => {
      // Arrange - Créer une demande d'ami
      const friendRequest =
        await require("../../src/lib/database").prisma.friendRequest.create({
          data: {
            senderId: user1.id,
            receiverId: user2.id,
            status: "pending",
          },
        });

      // Act
      const response = await sendMessage(ws2, "respond_friend_request", {
        requestId: friendRequest.id,
        action: "accept",
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain("Demande d'ami acceptée");

      // Vérifier que l'amitié a été créée
      const friendship =
        await require("../../src/lib/database").prisma.friendship.findFirst({
          where: {
            userId: user1.id,
            friendId: user2.id,
          },
        });
      expect(friendship).toBeDefined();
    });

    it("devrait échouer si le tag n'existe pas", async () => {
      // Act
      const response = await sendMessage(ws1, "send_friend_request", {
        tag: "INEXISTANT",
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toContain("Utilisateur non trouvé");
    });

    it("devrait échouer si on s'ajoute soi-même", async () => {
      // Act
      const response = await sendMessage(ws1, "send_friend_request", {
        tag: user1.tag,
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toContain(
        "Vous ne pouvez pas vous ajouter vous-même"
      );
    });
  });

  describe("Handlers de scores", () => {
    beforeEach(async () => {
      ws1 = await connectWebSocket(user1.id);
    });

    it("devrait sauvegarder un score via WebSocket", async () => {
      // Act
      const response = await sendMessage(ws1, "save_score", {
        score: 85,
        totalQuestions: 20,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
        duration: 300,
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain("Score sauvegardé");

      // Vérifier en base
      const score =
        await require("../../src/lib/database").prisma.gameScore.findFirst({
          where: { userId: user1.id },
        });
      expect(score).toBeDefined();
      expect(score?.score).toBe(85);
    });

    it("devrait échouer avec un score invalide", async () => {
      // Act
      const response = await sendMessage(ws1, "save_score", {
        score: -5,
        totalQuestions: 20,
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toContain("Score invalide");
    });
  });

  describe("Gestion des erreurs WebSocket", () => {
    beforeEach(async () => {
      ws1 = await connectWebSocket(user1.id);
    });

    it("devrait gérer les messages avec un type invalide", async () => {
      // Act
      const response = await sendMessage(ws1, "invalid_type", {
        data: "test",
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toContain("Type de message non supporté");
    });

    it("devrait gérer les payloads invalides", async () => {
      // Act
      const response = await sendMessage(ws1, "create_lobby", {
        // Payload manquant ou invalide
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toContain("Données invalides");
    });

    it("devrait gérer les erreurs de parsing JSON", async () => {
      // Arrange
      const messageId = testUtils.generateId();

      return new Promise<void>((resolve) => {
        ws1.send("invalid json string");

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          expect(response.success).toBe(false);
          expect(response.message).toContain("Format de message invalide");
          resolve();
        });
      });
    });

    it("devrait gérer les erreurs de base de données", async () => {
      // Arrange - Créer une situation qui cause une erreur DB
      const invalidUserId = "user-inexistant";

      // Act
      const response = await sendMessage(ws1, "get_user_stats", {
        userId: invalidUserId,
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toContain("Erreur interne");
    });
  });

  describe("Handlers de lobby avancés", () => {
    let lobby: any;

    beforeEach(async () => {
      ws1 = await connectWebSocket(user1.id);
      ws2 = await connectWebSocket(user2.id);

      // Créer un lobby
      lobby = await testUtils.createTestLobby("test-lobby", user1.id);
    });

    it("devrait mettre à jour les paramètres du lobby", async () => {
      // Act
      const response = await sendMessage(ws1, "update_lobby_settings", {
        lobbyId: lobby.id,
        settings: {
          selectedRegions: ["Europe", "Asia"],
          gameMode: "quiz",
          maxPlayers: 4,
        },
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain("Paramètres mis à jour");

      // Vérifier en base
      const updatedLobby =
        await require("../../src/lib/database").prisma.gameLobby.findUnique({
          where: { id: lobby.id },
        });
      expect(updatedLobby?.gameSettings.selectedRegions).toEqual([
        "Europe",
        "Asia",
      ]);
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      // Act
      const response = await sendMessage(ws2, "update_lobby_settings", {
        lobbyId: lobby.id,
        settings: {
          selectedRegions: ["Europe"],
          gameMode: "quiz",
        },
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toContain("Non autorisé");
    });

    it("devrait inviter un joueur au lobby", async () => {
      // Act
      const response = await sendMessage(ws1, "invite_to_lobby", {
        lobbyId: lobby.id,
        tag: user2.tag,
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain("Invitation envoyée");

      // Vérifier en base
      const updatedLobby =
        await require("../../src/lib/database").prisma.gameLobby.findUnique({
          where: { id: lobby.id },
        });
      expect(updatedLobby?.authorizedPlayers).toContain(user2.id);
    });

    it("devrait échouer si le joueur est déjà dans le lobby", async () => {
      // Arrange - Ajouter le joueur au lobby
      await require("../../src/lib/database").prisma.gameLobby.update({
        where: { id: lobby.id },
        data: {
          authorizedPlayers: [user1.id, user2.id],
        },
      });

      // Act
      const response = await sendMessage(ws1, "invite_to_lobby", {
        lobbyId: lobby.id,
        tag: user2.tag,
      });

      // Assert
      expect(response.success).toBe(false);
      expect(response.message).toContain("Joueur déjà dans le lobby");
    });
  });

  describe("Handlers de jeu avancés", () => {
    let lobby: any;

    beforeEach(async () => {
      ws1 = await connectWebSocket(user1.id);
      ws2 = await connectWebSocket(user2.id);

      // Créer un lobby en cours de jeu
      lobby = await testUtils.createTestLobby("test-lobby", user1.id, {
        status: "playing",
        authorizedPlayers: [user1.id, user2.id],
      });
    });

    it("devrait mettre à jour la progression du jeu", async () => {
      // Act
      const response = await sendMessage(ws1, "update_game_progress", {
        lobbyId: lobby.id,
        currentQuestion: 5,
        score: 80,
        progress: 25,
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain("Progression mise à jour");

      // Vérifier en base
      const gameState =
        await require("../../src/lib/database").prisma.gameState.findFirst({
          where: {
            lobbyId: lobby.id,
            userId: user1.id,
          },
        });
      expect(gameState?.currentQuestion).toBe(5);
      expect(gameState?.score).toBe(80);
      expect(gameState?.progress).toBe(25);
    });

    it("devrait obtenir l'état du jeu", async () => {
      // Arrange - Créer un état de jeu
      await require("../../src/lib/database").prisma.gameState.create({
        data: {
          lobbyId: lobby.id,
          userId: user1.id,
          currentQuestion: 3,
          score: 60,
          totalQuestions: 20,
          status: "playing",
          progress: 15,
        },
      });

      // Act
      const response = await sendMessage(ws1, "get_game_state", {
        lobbyId: lobby.id,
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(response.data.currentQuestion).toBe(3);
      expect(response.data.score).toBe(60);
    });

    it("devrait obtenir les résultats du jeu", async () => {
      // Arrange - Créer des états de jeu terminés
      await require("../../src/lib/database").prisma.gameState.createMany({
        data: [
          {
            lobbyId: lobby.id,
            userId: user1.id,
            currentQuestion: 20,
            score: 85,
            totalQuestions: 20,
            status: "finished",
            progress: 100,
          },
          {
            lobbyId: lobby.id,
            userId: user2.id,
            currentQuestion: 20,
            score: 90,
            totalQuestions: 20,
            status: "finished",
            progress: 100,
          },
        ],
      });

      // Act
      const response = await sendMessage(ws1, "get_game_results", {
        lobbyId: lobby.id,
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.data).toBeDefined();
      expect(Array.isArray(response.data.players)).toBe(true);
      expect(response.data.players.length).toBe(2);

      // Vérifier l'ordre (le meilleur score en premier)
      expect(response.data.players[0].score).toBe(90);
      expect(response.data.players[1].score).toBe(85);
    });

    it("devrait redémarrer un lobby", async () => {
      // Act
      const response = await sendMessage(ws1, "restart_game", {
        lobbyId: lobby.id,
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain("Partie redémarrée");

      // Vérifier en base
      const updatedLobby =
        await require("../../src/lib/database").prisma.gameLobby.findUnique({
          where: { id: lobby.id },
        });
      expect(updatedLobby?.status).toBe("waiting");
    });

    it("devrait quitter le jeu", async () => {
      // Act
      const response = await sendMessage(ws1, "leave_game", {
        lobbyId: lobby.id,
      });

      // Assert
      expect(response.success).toBe(true);
      expect(response.message).toContain("Partie quittée");

      // Vérifier en base
      const gameState =
        await require("../../src/lib/database").prisma.gameState.findFirst({
          where: {
            lobbyId: lobby.id,
            userId: user1.id,
          },
        });
      expect(gameState?.status).toBe("left");
    });
  });

  describe("Gestion des connexions multiples", () => {
    it("devrait gérer plusieurs connexions du même utilisateur", async () => {
      // Arrange
      const ws1_1 = await connectWebSocket(user1.id);
      const ws1_2 = await connectWebSocket(user1.id);

      // Act - Envoyer un message depuis la première connexion
      const response1 = await sendMessage(ws1_1, "ping", {});

      // Assert
      expect(response1.success).toBe(true);

      // Nettoyer
      ws1_1.close();
      ws1_2.close();
    });

    it("devrait gérer la déconnexion proprement", async () => {
      // Arrange
      const ws = await connectWebSocket(user1.id);

      // Act
      ws.close();

      // Assert - Attendre que la déconnexion soit traitée
      await testUtils.wait(100);

      // Vérifier que l'utilisateur n'est plus connecté
      // (Cette vérification dépend de l'implémentation du ConnectionManager)
    });
  });
});

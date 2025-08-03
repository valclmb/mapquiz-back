import WebSocket from "ws";
import { LobbyLifecycleManager } from "../../src/websocket/lobby/lobbyLifecycle.js";
import { testUtils } from "../setup.js";

describe("WebSocket Integration Tests", () => {
  let server: any;
  let ws: WebSocket;
  const baseUrl = "ws://localhost:3000";

  beforeAll(async () => {
    // Démarrer le serveur de test
    const { createServer } = await import("../../src/server.js");
    server = await createServer();
    await server.listen({ port: 3000 });
  });

  afterAll(async () => {
    // Nettoyer les lobbies en mémoire
    const activeLobbies = LobbyLifecycleManager.getAllActiveLobbies();
    activeLobbies.clear();

    // Fermer le serveur
    if (server) {
      await server.close();
    }
  });

  beforeEach(async () => {
    // Nettoyer les lobbies en mémoire
    const activeLobbies = LobbyLifecycleManager.getAllActiveLobbies();
    activeLobbies.clear();
  });

  afterEach(() => {
    // Fermer la connexion WebSocket
    if (ws) {
      ws.close();
    }
  });

  describe("Connexion WebSocket", () => {
    it("devrait se connecter avec succès", (done) => {
      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        expect(ws.readyState).toBe(WebSocket.OPEN);
        done();
      });

      ws.on("error", (error) => {
        done(error);
      });
    });

    it("devrait répondre au ping", (done) => {
      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(JSON.stringify({ type: "ping" }));
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe("pong");
        done();
      });

      ws.on("error", (error) => {
        done(error);
      });
    });
  });

  describe("Gestion des Lobbies", () => {
    it("devrait créer un lobby avec succès", async (done) => {
      const userId = testUtils.generateId();
      await testUtils.createTestUser(userId);

      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "create_lobby",
            payload: {
              name: "Test Lobby",
              settings: { selectedRegions: ["Europe"], gameMode: "quiz" },
            },
          })
        );
      });

      let messageCount = 0;
      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;

        if (messageCount === 1) {
          expect(message.type).toBe("create_lobby_success");
          expect(message.data.success).toBe(true);
          expect(message.data.lobbyId).toBeDefined();
        } else if (messageCount === 2) {
          expect(message.type).toBe("lobby_update");
          expect(message.payload.lobbyId).toBeDefined();
          expect(message.payload.hostId).toBe(userId);
          done();
        }
      });

      ws.on("error", (error) => {
        done(error);
      });
    });

    it("devrait rejoindre un lobby existant", async (done) => {
      const hostId = testUtils.generateId();
      const playerId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les utilisateurs et le lobby
      await testUtils.createTestUser(hostId);
      await testUtils.createTestUser(playerId);
      await testUtils.createTestLobby(lobbyId, hostId);

      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "join_lobby",
            payload: { lobbyId },
          })
        );
      });

      let messageCount = 0;
      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;

        if (messageCount === 1) {
          expect(message.type).toBe("join_lobby_success");
          expect(message.data.success).toBe(true);
        } else if (messageCount === 2) {
          expect(message.type).toBe("lobby_update");
          expect(message.payload.lobbyId).toBe(lobbyId);
          expect(message.payload.players).toHaveLength(2);
          done();
        }
      });

      ws.on("error", (error) => {
        done(error);
      });
    });

    it("devrait quitter un lobby", async (done) => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer l'utilisateur et le lobby
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "leave_lobby",
            payload: { lobbyId },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe("leave_lobby_success");
        expect(message.data.success).toBe(true);
        done();
      });

      ws.on("error", (error) => {
        done(error);
      });
    });
  });

  describe("Gestion du Jeu", () => {
    it("devrait démarrer une partie", async (done) => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer l'utilisateur et le lobby
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "set_player_ready",
            payload: { lobbyId },
          })
        );
      });

      let messageCount = 0;
      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;

        if (messageCount === 1) {
          expect(message.type).toBe("update_player_status_success");
        } else if (messageCount === 2) {
          expect(message.type).toBe("lobby_update");
          expect(message.payload.status).toBe("playing");
          done();
        }
      });

      ws.on("error", (error) => {
        done(error);
      });
    });

    it("devrait mettre à jour la progression d'un joueur", async (done) => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer l'utilisateur et le lobby
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire avec statut "playing"
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });
      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      if (lobby) {
        lobby.status = "playing";
      }

      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "update_player_progress",
            payload: {
              lobbyId,
              validatedCountries: ["FR", "DE"],
              incorrectCountries: ["IT", "ES"],
              score: 15,
              totalQuestions: 20,
            },
          })
        );
      });

      let messageCount = 0;
      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;

        if (messageCount === 1) {
          expect(message.type).toBe("update_player_progress_success");
        } else if (messageCount === 2) {
          expect(message.type).toBe("player_progress_update");
          expect(message.payload.lobbyId).toBe(lobbyId);
          done();
        }
      });

      ws.on("error", (error) => {
        done(error);
      });
    });
  });

  describe("Gestion des Erreurs", () => {
    it("devrait gérer les messages non supportés", (done) => {
      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "unsupported_message",
            payload: {},
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe("error");
        expect(message.message).toContain("Type de message non supporté");
        done();
      });

      ws.on("error", (error) => {
        done(error);
      });
    });

    it("devrait gérer les payloads invalides", (done) => {
      ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "create_lobby",
            payload: {}, // Payload manquant
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        expect(message.type).toBe("error");
        done();
      });

      ws.on("error", (error) => {
        done(error);
      });
    });
  });

  describe("Scénarios Multi-Joueurs", () => {
    it("devrait gérer plusieurs joueurs dans un lobby", async (done) => {
      const hostId = testUtils.generateId();
      const playerId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les utilisateurs et le lobby
      await testUtils.createTestUser(hostId);
      await testUtils.createTestUser(playerId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      // Première connexion (hôte)
      const ws1 = new WebSocket(baseUrl);
      let ws1MessageCount = 0;

      ws1.on("open", () => {
        ws1.send(
          JSON.stringify({
            type: "join_lobby",
            payload: { lobbyId },
          })
        );
      });

      ws1.on("message", (data) => {
        const message = JSON.parse(data.toString());
        ws1MessageCount++;

        if (ws1MessageCount === 2) {
          // Deuxième connexion (joueur)
          const ws2 = new WebSocket(baseUrl);
          let ws2MessageCount = 0;

          ws2.on("open", () => {
            ws2.send(
              JSON.stringify({
                type: "join_lobby",
                payload: { lobbyId },
              })
            );
          });

          ws2.on("message", (data) => {
            const message = JSON.parse(data.toString());
            ws2MessageCount++;

            if (ws2MessageCount === 2) {
              expect(message.payload.players).toHaveLength(2);
              ws1.close();
              ws2.close();
              done();
            }
          });

          ws2.on("error", (error) => {
            ws1.close();
            done(error);
          });
        }
      });

      ws1.on("error", (error) => {
        done(error);
      });
    });
  });
});

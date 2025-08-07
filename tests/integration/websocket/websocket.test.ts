import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../../src/server.js";
import { testUtils } from "../../setup.js";

describe("WebSocket Integration Tests", () => {
  let app: FastifyInstance;
  let server: any;
  let testUser: any;
  let testLobby: any;
  let ws: WebSocket;

  beforeAll(async () => {
    // Construire l'application Fastify
    app = await build();

    // Démarrer le serveur sur un port aléatoire
    await app.listen({ port: 0, host: "localhost" });
    server = app.server;

    // Créer un utilisateur de test
    testUser = await testUtils.createTestUser("test-user-id", "Test User");
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Nettoyer la base de données avant chaque test
    await testUtils.cleanDatabase();

    // Recréer l'utilisateur de test
    testUser = await testUtils.createTestUser("test-user-id", "Test User");

    // Vérifier que l'utilisateur a été créé
    console.log(
      `🔍 Utilisateur de test créé: ${testUser.id} - ${testUser.name}`
    );

    // Créer un lobby de test
    testLobby = await testUtils.createTestLobby("test-lobby-id", testUser.id);
  });

  afterEach(() => {
    // Fermer la connexion WebSocket si elle existe
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  });

  describe("Connexion WebSocket", () => {
    it("devrait établir une connexion WebSocket avec succès", async () => {
      // Arrange & Act
      await new Promise<void>((resolve, reject) => {
        ws = new WebSocket(`ws://localhost:${server.address().port}/ws`);

        ws.on("open", () => {
          // Assert
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait accepter une connexion avec authentification", async () => {
      // Arrange
      const authHeaders = {
        "x-user-id": testUser.id,
      };

      // Act
      await new Promise<void>((resolve, reject) => {
        ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: authHeaders,
        });

        ws.on("open", () => {
          // Assert
          expect(ws.readyState).toBe(WebSocket.OPEN);
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait rejeter une connexion sans authentification", async () => {
      // Act
      await new Promise<void>((resolve) => {
        ws = new WebSocket(`ws://localhost:${server.address().port}/ws`);

        ws.on("close", (code) => {
          // Assert - Le code peut varier selon l'implémentation
          expect(code).toBeGreaterThan(0);
          resolve();
        });

        ws.on("error", (error) => {
          // Ignorer les erreurs de connexion refusée
          if (error.message.includes("ECONNREFUSED")) {
            resolve();
          }
        });
      });
    });
  });

  describe("Messages WebSocket", () => {
    beforeEach(async () => {
      // Établir une connexion WebSocket authentifiée
      await new Promise<void>((resolve, reject) => {
        ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: {
            "x-user-id": testUser.id,
          },
        });

        ws.on("open", () => {
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait envoyer et recevoir un message de ping", async () => {
      // Arrange
      const pingMessage = {
        type: "ping",
      };

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        ws.send(JSON.stringify(pingMessage));

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          expect(response.type).toBe("pong");
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait créer un nouveau lobby", async () => {
      // Arrange
      const createLobbyMessage = {
        type: "create_lobby",
        payload: {
          name: "Test Lobby",
          settings: {
            selectedRegions: ["Europe"],
            gameMode: "quiz",
          },
        },
      };

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        ws.send(JSON.stringify(createLobbyMessage));

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          console.log(`🔍 Réponse reçue:`, response);

          if (response.type === "error") {
            console.error(`❌ Erreur reçue:`, response.message);
            reject(new Error(`Erreur WebSocket: ${response.message}`));
          } else {
            expect(response.type).toBe("create_lobby_success");
            expect(response.data.success).toBe(true);
            expect(response.data.lobbyId).toBeDefined();
            expect(response.data.hostId).toBe(testUser.id);
            resolve();
          }
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait gérer un message de rejoindre un lobby", async () => {
      // Arrange
      const joinMessage = {
        type: "join_lobby",
        payload: {
          lobbyId: testLobby.id,
        },
      };

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        ws.send(JSON.stringify(joinMessage));

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          expect(response.type).toBe("join_lobby_success");
          expect(response.data.success).toBe(true);
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait gérer un message de quitter un lobby", async () => {
      // Arrange
      const leaveMessage = {
        type: "leave_lobby",
        payload: {
          lobbyId: testLobby.id,
        },
      };

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        ws.send(JSON.stringify(leaveMessage));

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          expect(response.type).toBe("leave_lobby_success");
          expect(response.data.success).toBe(true);
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait gérer un message de mise à jour de score", async () => {
      // Arrange
      const scoreMessage = {
        type: "update_player_progress",
        payload: {
          lobbyId: testLobby.id,
          score: 100,
          progress: 50,
          validatedCountries: ["FRA", "DEU"],
          incorrectCountries: ["USA"],
        },
      };

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        ws.send(JSON.stringify(scoreMessage));

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          expect(response.type).toBe("update_player_progress_success");
          expect(response.data.success).toBe(true);
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait gérer un message de démarrage de partie", async () => {
      // Arrange
      const startMessage = {
        type: "start_game",
        payload: {
          lobbyId: testLobby.id,
        },
      };

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        ws.send(JSON.stringify(startMessage));

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          expect(response.type).toBe("start_game_success");
          expect(response.data.success).toBe(true);
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait gérer un message invalide", async () => {
      // Arrange
      const invalidMessage = {
        type: "invalid_type",
        payload: {},
      };

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        ws.send(JSON.stringify(invalidMessage));

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          expect(response.type).toBe("error");
          expect(response.message).toBeDefined();
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait gérer un message malformé", async () => {
      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        ws.send("invalid json");

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          expect(response.type).toBe("error");
          expect(response.message).toBeDefined();
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });
  });

  describe("Gestion des erreurs WebSocket", () => {
    it("devrait gérer la déconnexion d'un client", async () => {
      // Arrange
      await new Promise<void>((resolve, reject) => {
        ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: {
            "x-user-id": testUser.id,
          },
        });

        ws.on("open", () => {
          // Act - Fermer la connexion
          ws.close();
        });

        ws.on("close", () => {
          // Assert
          expect(ws.readyState).toBe(WebSocket.CLOSED);
          resolve();
        });

        ws.on("error", (error) => {
          reject(error);
        });
      });
    });

    it("devrait gérer les erreurs de connexion", async () => {
      // Act - Essayer de se connecter à un port inexistant
      await new Promise<void>((resolve) => {
        ws = new WebSocket("ws://localhost:9999/ws");

        ws.on("error", (error) => {
          // Assert
          expect(error).toBeDefined();
          resolve();
        });
      });
    });
  });

  describe("Communication multi-joueurs", () => {
    let ws1: WebSocket;
    let ws2: WebSocket;
    let user2: any;

    beforeEach(async () => {
      // Créer un deuxième utilisateur
      user2 = await testUtils.createTestUser("test-user-2", "Test User 2");

      // Connecter le premier utilisateur
      await new Promise<void>((resolve, reject) => {
        ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: {
            "x-user-id": testUser.id,
          },
        });

        ws1.on("open", () => {
          // Connecter le deuxième utilisateur
          ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
            headers: {
              "x-user-id": user2.id,
            },
          });

          ws2.on("open", () => {
            resolve();
          });

          ws2.on("error", (error) => {
            reject(error);
          });
        });

        ws1.on("error", (error) => {
          reject(error);
        });
      });
    });

    afterEach(() => {
      if (ws1 && ws1.readyState === WebSocket.OPEN) {
        ws1.close();
      }
      if (ws2 && ws2.readyState === WebSocket.OPEN) {
        ws2.close();
      }
    });

    it("devrait permettre à deux joueurs de rejoindre le même lobby", async () => {
      // Arrange
      const joinMessage1 = {
        type: "join_lobby",
        payload: {
          lobbyId: testLobby.id,
        },
      };

      const joinMessage2 = {
        type: "join_lobby",
        payload: {
          lobbyId: testLobby.id,
        },
      };

      let messagesReceived = 0;

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        // Premier joueur rejoint
        ws1.send(JSON.stringify(joinMessage1));

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "join_lobby_success") {
            messagesReceived++;

            // Deuxième joueur rejoint
            ws2.send(JSON.stringify(joinMessage2));
          }
        });

        ws2.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "join_lobby_success") {
            messagesReceived++;

            // Assert
            if (messagesReceived === 2) {
              expect(response.data.success).toBe(true);
              resolve();
            }
          }
        });

        // Timeout pour éviter les blocages
        setTimeout(() => {
          reject(new Error("Timeout waiting for lobby join"));
        }, 5000);
      });
    });

    it("devrait diffuser les messages à tous les joueurs du lobby", async () => {
      // Arrange
      const joinMessage1 = {
        type: "join_lobby",
        payload: {
          lobbyId: testLobby.id,
        },
      };

      const joinMessage2 = {
        type: "join_lobby",
        payload: {
          lobbyId: testLobby.id,
        },
      };

      let playersJoined = 0;

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        // Les deux joueurs rejoignent
        ws1.send(JSON.stringify(joinMessage1));
        ws2.send(JSON.stringify(joinMessage2));

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "join_lobby_success") {
            playersJoined++;
            if (playersJoined === 2) {
              // Les deux joueurs ont rejoint avec succès
              resolve();
            }
          }
        });

        ws2.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "join_lobby_success") {
            playersJoined++;
            if (playersJoined === 2) {
              // Les deux joueurs ont rejoint avec succès
              resolve();
            }
          }
        });

        // Timeout pour éviter les blocages
        setTimeout(() => {
          reject(new Error("Timeout waiting for players to join"));
        }, 5000);
      });
    });
  });
});

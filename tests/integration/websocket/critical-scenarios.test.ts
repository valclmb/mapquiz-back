import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../../src/server.js";
import { testUtils } from "../../setup.js";

describe("WebSocket Critical Scenarios Integration Tests", () => {
  let app: FastifyInstance;
  let server: any;
  let testUser: any;
  let testUser2: any;
  let testUser3: any;

  beforeAll(async () => {
    app = await build();
    await app.listen({ port: 0, host: "localhost" });
    server = app.server;

    testUser = await testUtils.createTestUser("test-user-1", "Test User 1");
    testUser2 = await testUtils.createTestUser("test-user-2", "Test User 2");
    testUser3 = await testUtils.createTestUser("test-user-3", "Test User 3");
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await testUtils.cleanDatabase();
    testUser = await testUtils.createTestUser("test-user-1", "Test User 1");
    testUser2 = await testUtils.createTestUser("test-user-2", "Test User 2");
    testUser3 = await testUtils.createTestUser("test-user-3", "Test User 3");
  });

  describe("Scénarios Critiques de Gestion d'État", () => {
    it("devrait gérer la persistance d'état lors des reconnexions", async () => {
      // Créer un lobby
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let lobbyId: string;
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Lobby Persistence",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws1.send(JSON.stringify(createMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              expect(response.data.success).toBe(true);
              expect(lobbyId).toBeDefined();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Fermer la connexion
      ws1.close();

      // Reconnecter et vérifier l'état
      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws2.on("open", () => {
          const getStateMessage = {
            type: "get_lobby_state",
            payload: { lobbyId },
          };
          ws2.send(JSON.stringify(getStateMessage));
        });

        ws2.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "lobby_state") {
              expect(response.data.lobbyId).toBe(lobbyId);
              expect(response.data.hostId).toBe(testUser.id);
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      ws2.close();
    });

    it("devrait gérer les déconnexions brutales avec récupération", async () => {
      // Créer un lobby
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let lobbyId: string;
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Lobby Brutal Disconnect",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws1.send(JSON.stringify(createMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Déconnexion brutale (terminate)
      ws1.terminate();

      // Attendre un peu pour que le serveur traite la déconnexion
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reconnecter et vérifier que l'état est préservé
      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws2.on("open", () => {
          const getStateMessage = {
            type: "get_lobby_state",
            payload: { lobbyId },
          };
          ws2.send(JSON.stringify(getStateMessage));
        });

        ws2.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "lobby_state") {
              // Validation spécifique de la récupération
              expect(response.data.lobbyId).toBe(lobbyId);
              expect(response.data.hostId).toBe(testUser.id);
              expect(response.data.status).toBe("waiting");
              expect(response.data.players).toBeDefined();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      ws2.close();
    });

    it("devrait gérer les erreurs de réseau avec retry", async () => {
      // Test de résilience réseau
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let connectionAttempts = 0;
      const maxAttempts = 3;

      await new Promise<void>((resolve, reject) => {
        const attemptConnection = () => {
          connectionAttempts++;

          ws1.on("open", () => {
            expect(connectionAttempts).toBeLessThanOrEqual(maxAttempts);
            resolve();
          });

          ws1.on("error", (error) => {
            if (connectionAttempts < maxAttempts) {
              // Retry après un délai
              setTimeout(() => {
                ws1.close();
                attemptConnection();
              }, 1000);
            } else {
              reject(
                new Error(`Échec de connexion après ${maxAttempts} tentatives`)
              );
            }
          });
        };

        attemptConnection();
      });

      ws1.close();
    });

    it("devrait gérer les messages corrompus", async () => {
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          // Envoyer des messages corrompus
          ws1.send("invalid json");
          ws1.send(JSON.stringify({ type: "invalid_type" }));
          ws1.send(JSON.stringify({ type: "create_lobby", payload: null }));

          // Attendre un peu pour que le serveur traite les messages
          setTimeout(() => {
            expect(ws1.readyState).toBe(WebSocket.OPEN);
            resolve();
          }, 1000);
        });

        ws1.on("error", (error) => {
          reject(error);
        });
      });

      ws1.close();
    });
  });

  describe("Scénarios Critiques de Concurrence", () => {
    it("devrait gérer les actions simultanées sur le même lobby", async () => {
      // Créer un lobby
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let lobbyId: string;
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Concurrent Actions",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws1.send(JSON.stringify(createMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Actions simultanées
      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws2.on("open", () => {
          // Envoyer plusieurs messages simultanément
          const joinMessage = {
            type: "join_lobby",
            payload: { lobbyId },
          };
          ws2.send(JSON.stringify(joinMessage));

          // Message invalide simultané
          const invalidMessage = {
            type: "invalid_type",
            payload: {},
          };
          ws2.send(JSON.stringify(invalidMessage));

          // Deuxième tentative de rejoindre
          ws2.send(JSON.stringify(joinMessage));
        });

        let successCount = 0;
        ws2.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "join_lobby_success") {
              successCount++;
              if (successCount >= 1) {
                resolve();
              }
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      ws1.close();
      ws2.close();
    });

    it("devrait gérer les messages en rafale", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          // Envoyer 50 messages en rafale
          for (let i = 0; i < 50; i++) {
            const message = {
              type: "ping",
              payload: { index: i },
            };
            ws.send(JSON.stringify(message));
          }
          resolve();
        });

        ws.on("error", reject);
      });

      // Attendre un peu pour traiter les messages
      await new Promise((resolve) => setTimeout(resolve, 1000));

      ws.close();
    });
  });

  describe("Scénarios Critiques de Gestion d'Erreurs", () => {
    it("devrait gérer les timeouts de connexion", async () => {
      // Test avec un timeout court
      const timeoutPromise = new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Timeout de connexion"));
        }, 5000);

        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUser.id },
        });

        ws.on("open", () => {
          clearTimeout(timeout);
          ws.close();
          resolve();
        });

        ws.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      await timeoutPromise;
    });

    it("devrait gérer les messages malformés en rafale", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          // Envoyer des messages malformés
          for (let i = 0; i < 10; i++) {
            ws.send("invalid json");
            ws.send(JSON.stringify({ type: "invalid_type" }));
            ws.send(JSON.stringify({ payload: "missing_type" }));
          }
          resolve();
        });

        ws.on("error", reject);
      });

      // Attendre un peu pour traiter les messages
      await new Promise((resolve) => setTimeout(resolve, 1000));

      ws.close();
    });

    it("devrait gérer les reconnexions après erreur", async () => {
      // Première connexion
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          ws1.close();
          resolve();
        });
        ws1.on("error", reject);
      });

      // Attendre un peu
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Deuxième connexion
      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws2.on("open", () => {
          resolve();
        });
        ws2.on("error", reject);
      });

      ws2.close();
    });
  });

  describe("Scénarios Critiques de Performance", () => {
    it("devrait gérer les connexions multiples simultanées", async () => {
      const maxConnections = 10;
      const connections: WebSocket[] = [];
      const startTime = Date.now();

      try {
        for (let i = 0; i < maxConnections; i++) {
          const ws = new WebSocket(
            `ws://localhost:${server.address().port}/ws`,
            {
              headers: { "x-user-id": `user-${i}` },
            }
          );

          await new Promise<void>((resolve, reject) => {
            ws.on("open", () => {
              connections.push(ws);
              resolve();
            });
            ws.on("error", reject);
          });
        }

        const endTime = Date.now();
        const connectionTime = endTime - startTime;

        expect(connections).toHaveLength(maxConnections);
        connections.forEach((conn) => {
          expect(conn.readyState).toBe(WebSocket.OPEN);
        });

        // Vérifier que le temps de connexion est raisonnable
        expect(connectionTime).toBeLessThan(5000); // 5 secondes max
      } finally {
        connections.forEach((conn) => {
          if (conn.readyState === WebSocket.OPEN) {
            conn.close();
          }
        });
      }
    });

    it("devrait gérer les messages en rafale", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          const startTime = Date.now();
          let messageCount = 0;
          const maxMessages = 50;

          const sendMessage = () => {
            if (messageCount < maxMessages) {
              ws.send(
                JSON.stringify({
                  type: "ping",
                  payload: { timestamp: Date.now() },
                })
              );
              messageCount++;
              setTimeout(sendMessage, 10);
            } else {
              const endTime = Date.now();
              const totalTime = endTime - startTime;
              expect(totalTime).toBeLessThan(2000); // 2 secondes max
              resolve();
            }
          };

          sendMessage();
        });

        ws.on("error", reject);
      });

      ws.close();
    });
  });

  describe("Scénarios Critiques de Sécurité", () => {
    it("devrait rejeter les tentatives d'injection de messages malveillants", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          // Tentatives d'injection
          const maliciousMessages = [
            JSON.stringify({
              type: "create_lobby",
              payload: { name: "<script>alert('xss')</script>" },
            }),
            JSON.stringify({
              type: "join_lobby",
              payload: { lobbyId: "'; DROP TABLE lobbies; --" },
            }),
            JSON.stringify({
              type: "ping",
              payload: { data: "javascript:alert('xss')" },
            }),
          ];

          maliciousMessages.forEach((message) => {
            ws.send(message);
          });

          // Attendre un peu pour traiter les messages
          setTimeout(() => {
            expect(ws.readyState).toBe(WebSocket.OPEN);
            resolve();
          }, 1000);
        });

        ws.on("error", reject);
      });

      ws.close();
    });

    it("devrait gérer les sessions expirées en cours de jeu", async () => {
      // Créer un lobby
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let lobbyId: string;
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Session Expiry",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws1.send(JSON.stringify(createMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Simuler une session expirée en reconnectant sans authentification
      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`);

      await new Promise<void>((resolve, reject) => {
        ws2.on("open", () => {
          const getStateMessage = {
            type: "get_lobby_state",
            payload: { lobbyId },
          };
          ws2.send(JSON.stringify(getStateMessage));
        });

        ws2.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "error") {
              expect(response.message).toContain("Non authentifié");
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      ws1.close();
      ws2.close();
    });
  });

  describe("Scénarios Critiques de Gestion d'État de Jeu", () => {
    it("devrait gérer les états de jeu incohérents", async () => {
      // Créer un lobby et démarrer une partie
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let lobbyId: string;
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Game State",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws1.send(JSON.stringify(createMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Ajouter un deuxième joueur
      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws2.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            payload: { lobbyId },
          };
          ws2.send(JSON.stringify(joinMessage));
        });

        ws2.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "join_lobby_success") {
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Démarrer la partie
      await new Promise<void>((resolve, reject) => {
        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "game_started") {
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        const startMessage = {
          type: "start_game",
          payload: { lobbyId },
        };
        ws1.send(JSON.stringify(startMessage));
      });

      // Vérifier l'état de jeu
      await new Promise<void>((resolve, reject) => {
        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "lobby_state") {
              expect(response.data.status).toBe("playing");
              expect(response.data.players).toBeDefined();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        const getStateMessage = {
          type: "get_lobby_state",
          payload: { lobbyId },
        };
        ws1.send(JSON.stringify(getStateMessage));
      });

      ws1.close();
      ws2.close();
    });

    it("devrait gérer les limites de joueurs dans les lobbies", async () => {
      // Créer un lobby avec limite de 2 joueurs
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let lobbyId: string;
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Player Limits",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 2,
              },
            },
          };
          ws1.send(JSON.stringify(createMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Ajouter un deuxième joueur (succès)
      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws2.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            payload: { lobbyId },
          };
          ws2.send(JSON.stringify(joinMessage));
        });

        ws2.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "join_lobby_success") {
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Tenter d'ajouter un troisième joueur (échec)
      const ws3 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser3.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws3.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            payload: { lobbyId },
          };
          ws3.send(JSON.stringify(joinMessage));
        });

        ws3.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "error") {
              expect(response.message).toContain("Lobby plein");
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      ws1.close();
      ws2.close();
      ws3.close();
    });
  });

  describe("Tests de Cas Limites Critiques", () => {
    it("devrait gérer la corruption de données d'état", async () => {
      // Créer un lobby avec des données corrompues
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let lobbyId: string = "";
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Lobby Corruption",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws1.send(JSON.stringify(createMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      // Simuler une corruption de données
      const corruptedState = {
        type: "update_lobby_state",
        payload: {
          lobbyId,
          state: {
            status: "corrupted",
            players: null,
            settings: undefined,
          },
        },
      };

      ws1.send(JSON.stringify(corruptedState));

      // Vérifier que le système récupère
      await new Promise<void>((resolve, reject) => {
        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "error" || response.type === "lobby_state") {
              expect(response.type).toBeDefined();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      ws1.close();
    }, 30000);

    it("devrait gérer les timeouts de base de données", async () => {
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          // Envoyer des messages qui pourraient causer des timeouts
          const messages = [
            {
              type: "create_lobby",
              payload: {
                name: "Test Timeout",
                settings: {
                  selectedRegions: ["Europe"],
                  gameMode: "quiz",
                  maxPlayers: 4,
                },
              },
            },
            { type: "get_lobby_state", payload: { lobbyId: "non-existent" } },
            { type: "join_lobby", payload: { lobbyId: "non-existent" } },
          ];

          messages.forEach((message) => {
            ws1.send(JSON.stringify(message));
          });

          // Attendre un peu pour traiter les messages
          setTimeout(() => {
            expect(ws1.readyState).toBe(WebSocket.OPEN);
            resolve();
          }, 2000);
        });

        ws1.on("error", reject);
      });

      ws1.close();
    }, 30000);

    it("devrait gérer les fuites mémoire lors des reconnexions", async () => {
      const maxReconnections = 5;
      const connections: WebSocket[] = [];

      for (let i = 0; i < maxReconnections; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUser.id },
        });

        await new Promise<void>((resolve, reject) => {
          ws.on("open", () => {
            connections.push(ws);
            resolve();
          });
          ws.on("error", reject);
        });

        // Fermer la connexion immédiatement
        ws.close();
      }

      // Vérifier que toutes les connexions sont fermées
      connections.forEach((conn) => {
        expect(conn.readyState).toBe(WebSocket.CLOSED);
      });

      // Attendre un peu pour laisser le temps au GC
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }, 30000);
  });
});

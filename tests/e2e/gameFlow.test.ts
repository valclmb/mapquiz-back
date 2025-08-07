import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../src/server.js";
import { testUtils } from "../setup.js";

describe("Game Flow E2E Tests", () => {
  let app: FastifyInstance;
  let server: any;
  let testUser1: any;
  let testUser2: any;
  let testLobby: any;
  let ws1: WebSocket;
  let ws2: WebSocket;

  beforeAll(async () => {
    // Construire l'application Fastify
    app = await build();

    // Démarrer le serveur sur un port aléatoire
    await app.listen({ port: 0, host: "localhost" });
    server = app.server;

    // Créer des utilisateurs de test
    testUser1 = await testUtils.createTestUser("test-user-1", "Test User 1");
    testUser2 = await testUtils.createTestUser("test-user-2", "Test User 2");

    // Créer un lobby de test
    testLobby = await testUtils.createTestLobby("test-lobby-id", testUser1.id);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    // Nettoyer la base de données avant chaque test
    await testUtils.cleanDatabase();

    // Recréer les utilisateurs de test
    testUser1 = await testUtils.createTestUser("test-user-1", "Test User 1");
    testUser2 = await testUtils.createTestUser("test-user-2", "Test User 2");

    // Créer un lobby de test
    testLobby = await testUtils.createTestLobby("test-lobby-id", testUser1.id);
  });

  afterEach(() => {
    // Fermer les connexions WebSocket
    if (ws1 && ws1.readyState === WebSocket.OPEN) {
      ws1.close();
    }
    if (ws2 && ws2.readyState === WebSocket.OPEN) {
      ws2.close();
    }
  });

  describe("Flux de jeu complet", () => {
    it("devrait permettre un cycle complet de jeu multi-joueurs", async () => {
      // Arrange - Connecter les deux joueurs
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      let lobbyJoined = false;
      let gameStarted = false;

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 10000);

        ws1.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            payload: { lobbyId: testLobby.id },
          };
          ws1.send(JSON.stringify(joinMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            console.log("WS1 received:", response.type);

            if (response.type === "join_lobby_success" && !lobbyJoined) {
              lobbyJoined = true;
              // Deuxième joueur rejoint
              const joinMessage2 = {
                type: "join_lobby",
                payload: { lobbyId: testLobby.id },
              };
              ws2.send(JSON.stringify(joinMessage2));
            } else if (response.type === "start_game_success" && !gameStarted) {
              gameStarted = true;
              clearTimeout(timeout);
              resolve();
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        });

        ws2.on("open", () => {
          // Attendre que le premier joueur ait rejoint
        });

        ws2.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            console.log("WS2 received:", response.type);

            if (response.type === "join_lobby_success" && lobbyJoined) {
              // Démarrer la partie
              const startMessage = {
                type: "start_game",
                payload: { lobbyId: testLobby.id },
              };
              ws1.send(JSON.stringify(startMessage));
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        });

        ws1.on("error", (error) => {
          console.error("WS1 error:", error);
          clearTimeout(timeout);
          reject(error);
        });

        ws2.on("error", (error) => {
          console.error("WS2 error:", error);
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, 15000);

    it("devrait gérer la déconnexion d'un joueur pendant le jeu", async () => {
      // Arrange - Connecter les deux joueurs
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      let playerDisconnected = false;
      let ws1Joined = false;
      let ws2Joined = false;

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              "Test timeout - le message de déconnexion n'a pas été reçu"
            )
          );
        }, 10000);

        ws1.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            payload: { lobbyId: testLobby.id },
          };
          ws1.send(JSON.stringify(joinMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            console.log("WS1 received:", response.type);

            if (response.type === "join_lobby_success" && !ws1Joined) {
              ws1Joined = true;
              console.log("✅ WS1 a rejoint le lobby");
              // Deuxième joueur rejoint maintenant que ws1 est dans le lobby
              if (ws2.readyState === WebSocket.OPEN) {
                const joinMessage2 = {
                  type: "join_lobby",
                  payload: { lobbyId: testLobby.id },
                };
                ws2.send(JSON.stringify(joinMessage2));
              }
            } else if (
              response.type === "lobby_update" &&
              response.payload?.players &&
              !playerDisconnected &&
              ws2Joined
            ) {
              // Vérifier si ws2 s'est déconnecté en regardant les joueurs dans le lobby
              const players = response.payload.players;
              const ws2Player = players.find((p: any) => p.id === testUser2.id);
              if (ws2Player && ws2Player.status === "disconnected") {
                console.log(
                  "🎉 WS1 a reçu la mise à jour du lobby indiquant la déconnexion de WS2"
                );
                playerDisconnected = true;
                clearTimeout(timeout);
                resolve();
              }
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        });

        ws2.on("open", () => {
          // Attendre que ws1 soit dans le lobby avant de rejoindre
          if (ws1Joined) {
            const joinMessage2 = {
              type: "join_lobby",
              payload: { lobbyId: testLobby.id },
            };
            ws2.send(JSON.stringify(joinMessage2));
          }
        });

        ws2.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            console.log("WS2 received:", response.type);

            if (response.type === "join_lobby_success" && !ws2Joined) {
              ws2Joined = true;
              console.log("✅ WS2 a rejoint le lobby");
              // Attendre un peu puis déconnecter ws2
              setTimeout(() => {
                console.log("🔄 Fermeture de ws2");
                ws2.close();
              }, 3000); // Augmenter le délai pour laisser le temps au message d'être envoyé
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        });

        ws1.on("error", (error) => {
          console.error("WS1 error:", error);
          clearTimeout(timeout);
          reject(error);
        });

        ws2.on("error", (error) => {
          console.error("WS2 error:", error);
          clearTimeout(timeout);
          reject(error);
        });

        ws2.on("close", () => {
          console.log("🔌 WS2 s'est déconnecté");
        });
      });

      expect(playerDisconnected).toBe(true);
    }, 15000);

    it("devrait gérer les reconnexions de joueurs", async () => {
      // Arrange - Connecter le premier joueur
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let reconnected = false;

      // Act & Assert
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 15000);

        ws1.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            payload: { lobbyId: testLobby.id },
          };
          ws1.send(JSON.stringify(joinMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            console.log("WS1 received:", response.type);

            if (response.type === "join_lobby_success" && !reconnected) {
              // Simuler une déconnexion et reconnexion
              ws1.close();

              setTimeout(() => {
                ws1 = new WebSocket(
                  `ws://localhost:${server.address().port}/ws`,
                  {
                    headers: { "x-user-id": testUser1.id },
                  }
                );

                ws1.on("open", () => {
                  const rejoinMessage = {
                    type: "join_lobby",
                    payload: { lobbyId: testLobby.id },
                  };
                  ws1.send(JSON.stringify(rejoinMessage));
                });

                ws1.on("message", (data) => {
                  try {
                    const response = JSON.parse(data.toString());
                    if (response.type === "join_lobby_success") {
                      reconnected = true;
                      clearTimeout(timeout);
                      resolve();
                    }
                  } catch (error) {
                    console.error("Error parsing message:", error);
                  }
                });
              }, 1000);
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        });

        ws1.on("error", (error) => {
          console.error("WS1 error:", error);
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, 20000);
  });

  describe("Gestion des erreurs E2E", () => {
    it("devrait gérer les messages malformés", async () => {
      // Arrange
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let errorReceived = false;

      // Act
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        ws1.on("open", () => {
          ws1.send("invalid json");
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            console.log("Message reçu (malformé):", response);
            if (response.type === "error" || response.message) {
              expect(response.message || response.error).toBeDefined();
              errorReceived = true;
              clearTimeout(timeout);
              resolve();
            }
          } catch (error) {
            // Ignorer les erreurs de parsing pour les messages malformés
          }
        });

        ws1.on("error", (error) => {
          console.error("WS1 error:", error);
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(errorReceived).toBe(true);
    });

    it("devrait gérer les tentatives de rejoindre un lobby inexistant", async () => {
      // Arrange
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let errorReceived = false;

      // Act
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 5000);

        ws1.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            payload: { lobbyId: "non-existent-lobby" },
          };
          ws1.send(JSON.stringify(joinMessage));
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            console.log("Message reçu (lobby inexistant):", response);
            if (response.type === "error" || response.message) {
              expect(response.message || response.error).toBeDefined();
              errorReceived = true;
              clearTimeout(timeout);
              resolve();
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        });

        ws1.on("error", (error) => {
          console.error("WS1 error:", error);
          clearTimeout(timeout);
          reject(error);
        });
      });

      expect(errorReceived).toBe(true);
    });
  });

  describe("Performance E2E", () => {
    it("devrait gérer plusieurs connexions simultanées", async () => {
      // Arrange - Créer plusieurs connexions
      const connections: WebSocket[] = [];
      const maxConnections = 5;
      let connectedCount = 0;

      // Act
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 10000);

        for (let i = 0; i < maxConnections; i++) {
          const ws = new WebSocket(
            `ws://localhost:${server.address().port}/ws`,
            {
              headers: { "x-user-id": `test-user-${i}` },
            }
          );

          ws.on("open", () => {
            connectedCount++;
            if (connectedCount === maxConnections) {
              // Assert
              expect(connectedCount).toBe(maxConnections);

              // Nettoyer
              connections.forEach((conn) => conn.close());
              clearTimeout(timeout);
              resolve();
            }
          });

          ws.on("error", (error) => {
            console.error("Connection error:", error);
            clearTimeout(timeout);
            reject(error);
          });

          connections.push(ws);
        }
      });
    }, 15000);

    it("devrait gérer les messages rapides", async () => {
      // Arrange
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let messageCount = 0;
      const maxMessages = 10;

      // Act
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Test timeout"));
        }, 10000);

        ws1.on("open", () => {
          // Envoyer plusieurs messages rapidement
          for (let i = 0; i < maxMessages; i++) {
            const pingMessage = {
              type: "ping",
              payload: { timestamp: Date.now(), index: i },
            };
            ws1.send(JSON.stringify(pingMessage));
          }
        });

        ws1.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "pong") {
              messageCount++;
              if (messageCount === maxMessages) {
                expect(messageCount).toBe(maxMessages);
                clearTimeout(timeout);
                resolve();
              }
            }
          } catch (error) {
            console.error("Error parsing message:", error);
          }
        });

        ws1.on("error", (error) => {
          console.error("WS1 error:", error);
          clearTimeout(timeout);
          reject(error);
        });
      });
    }, 15000);
  });
});

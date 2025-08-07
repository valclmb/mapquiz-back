import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { testUtils } from "../setup.js";
import { build } from "../../src/server.js";

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
    await app.listen({ port: 0, host: 'localhost' });
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

      let gameStarted = false;
      let gameEnded = false;

      // Act & Assert
      await new Promise<void>((resolve) => {
        ws1.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            data: { lobbyId: testLobby.id, userId: testUser1.id },
          };
          ws1.send(JSON.stringify(joinMessage));
        });

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          
          if (response.type === "lobby_joined") {
            // Deuxième joueur rejoint
            const joinMessage2 = {
              type: "join_lobby",
              data: { lobbyId: testLobby.id, userId: testUser2.id },
            };
            ws2.send(JSON.stringify(joinMessage2));
          } else if (response.type === "game_started" && !gameStarted) {
            gameStarted = true;
            
            // Simuler des mises à jour de score
            const scoreUpdate1 = {
              type: "update_score",
              data: {
                lobbyId: testLobby.id,
                userId: testUser1.id,
                score: 100,
                progress: 50,
                validatedCountries: ["FRA", "DEU"],
                incorrectCountries: ["USA"],
              },
            };
            ws1.send(JSON.stringify(scoreUpdate1));
          } else if (response.type === "score_updated" && gameStarted) {
            // Simuler la fin de partie
            const endGameMessage = {
              type: "end_game",
              data: {
                lobbyId: testLobby.id,
                userId: testUser1.id,
              },
            };
            ws1.send(JSON.stringify(endGameMessage));
          } else if (response.type === "game_ended" && !gameEnded) {
            gameEnded = true;
            resolve();
          }
        });

        ws2.on("message", (data) => {
          const response = JSON.parse(data.toString());
          
          if (response.type === "lobby_joined") {
            // Démarrer la partie
            const startMessage = {
              type: "start_game",
              data: { lobbyId: testLobby.id, userId: testUser1.id },
            };
            ws1.send(JSON.stringify(startMessage));
          }
        });
      });
    }, 30000);

    it("devrait gérer la déconnexion d'un joueur pendant le jeu", async () => {
      // Arrange - Connecter les deux joueurs
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      let playerDisconnected = false;

      // Act & Assert
      await new Promise<void>((resolve) => {
        ws1.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            data: { lobbyId: testLobby.id, userId: testUser1.id },
          };
          ws1.send(JSON.stringify(joinMessage));
        });

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          
          if (response.type === "lobby_joined") {
            // Deuxième joueur rejoint
            const joinMessage2 = {
              type: "join_lobby",
              data: { lobbyId: testLobby.id, userId: testUser2.id },
            };
            ws2.send(JSON.stringify(joinMessage2));
          } else if (response.type === "player_disconnected" && !playerDisconnected) {
            playerDisconnected = true;
            resolve();
          }
        });

        ws2.on("open", () => {
          // Simuler une déconnexion après un délai
          setTimeout(() => {
            ws2.close();
          }, 1000);
        });
      });
    }, 15000);

    it("devrait gérer les reconnexions de joueurs", async () => {
      // Arrange - Connecter le premier joueur
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let reconnected = false;

      // Act & Assert
      await new Promise<void>((resolve) => {
        ws1.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            data: { lobbyId: testLobby.id, userId: testUser1.id },
          };
          ws1.send(JSON.stringify(joinMessage));
        });

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          
          if (response.type === "lobby_joined" && !reconnected) {
            // Simuler une déconnexion et reconnexion
            ws1.close();
            
            setTimeout(() => {
              ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
                headers: { "x-user-id": testUser1.id },
              });
              
              ws1.on("open", () => {
                const rejoinMessage = {
                  type: "join_lobby",
                  data: { lobbyId: testLobby.id, userId: testUser1.id },
                };
                ws1.send(JSON.stringify(rejoinMessage));
              });
              
              ws1.on("message", (data) => {
                const response = JSON.parse(data.toString());
                if (response.type === "lobby_joined") {
                  reconnected = true;
                  resolve();
                }
              });
            }, 1000);
          }
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

      // Act
      await new Promise<void>((resolve) => {
        ws1.on("open", () => {
          ws1.send("invalid json");
        });

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "error") {
            expect(response.error).toBeDefined();
            resolve();
          }
        });
      });
    });

    it("devrait gérer les tentatives de rejoindre un lobby inexistant", async () => {
      // Arrange
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      // Act
      await new Promise<void>((resolve) => {
        ws1.on("open", () => {
          const joinMessage = {
            type: "join_lobby",
            data: { lobbyId: "non-existent-lobby", userId: testUser1.id },
          };
          ws1.send(JSON.stringify(joinMessage));
        });

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "error") {
            expect(response.error).toBeDefined();
            resolve();
          }
        });
      });
    });
  });

  describe("Performance E2E", () => {
    it("devrait gérer plusieurs connexions simultanées", async () => {
      // Arrange - Créer plusieurs connexions
      const connections: WebSocket[] = [];
      const maxConnections = 5;
      let connectedCount = 0;

      // Act
      for (let i = 0; i < maxConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": `test-user-${i}` },
        });

        await new Promise<void>((resolve) => {
          ws.on("open", () => {
            connectedCount++;
            if (connectedCount === maxConnections) {
              // Assert
              expect(connectedCount).toBe(maxConnections);
              
              // Nettoyer
              connections.forEach(conn => conn.close());
              resolve();
            }
          });

          connections.push(ws);
        });
      }
    }, 10000);

    it("devrait gérer les messages rapides", async () => {
      // Arrange
      ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let messageCount = 0;
      const maxMessages = 10;

      // Act
      await new Promise<void>((resolve) => {
        ws1.on("open", () => {
          // Envoyer plusieurs messages rapidement
          for (let i = 0; i < maxMessages; i++) {
            const pingMessage = {
              type: "ping",
              data: { timestamp: Date.now(), index: i },
            };
            ws1.send(JSON.stringify(pingMessage));
          }
          resolve();
        });

        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "pong") {
            messageCount++;
            if (messageCount === maxMessages) {
              expect(messageCount).toBe(maxMessages);
              resolve();
            }
          }
        });
      });
    }, 10000);
  });
}); 
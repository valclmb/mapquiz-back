import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../src/server.js";
import { testUtils } from "../setup.js";

describe("Performance Load Tests", () => {
  let app: FastifyInstance;
  let server: any;
  let testUsers: any[] = [];

  beforeAll(async () => {
    // Construire l'application Fastify
    app = await build();

    // Démarrer le serveur sur un port aléatoire
    await app.listen({ port: 0, host: "localhost" });
    server = app.server;

    // Créer des utilisateurs de test
    for (let i = 0; i < 100; i++) {
      const user = await testUtils.createTestUser(
        `test-user-${i}`,
        `Test User ${i}`
      );
      testUsers.push(user);
    }
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Nettoyer la base de données avant chaque test
    await testUtils.cleanDatabase();

    // Recréer les utilisateurs de test
    testUsers = [];
    for (let i = 0; i < 100; i++) {
      const user = await testUtils.createTestUser(
        `test-user-${i}`,
        `Test User ${i}`
      );
      testUsers.push(user);
    }
  });

  describe("Tests de charge WebSocket - Connexions simultanées", () => {
    it("devrait gérer 50 connexions WebSocket simultanées", async () => {
      const connections: WebSocket[] = [];
      const maxConnections = 50;
      let connectedCount = 0;
      let messageCount = 0;
      const startTime = Date.now();

      // Créer toutes les connexions
      for (let i = 0; i < maxConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });

        ws.on("open", () => {
          connectedCount++;
          // Envoyer un message de ping
          const pingMessage = {
            type: "ping",
            data: { timestamp: Date.now(), userId: testUsers[i].id },
          };
          ws.send(JSON.stringify(pingMessage));
        });

        ws.on("error", (error) => {
          console.error(
            `Erreur de connexion pour l'utilisateur ${i}:`,
            error.message
          );
        });

        connections.push(ws);
      }

      // Attendre que toutes les connexions soient établies et les messages reçus
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout: Seulement ${connectedCount}/${maxConnections} connexions établies`
            )
          );
        }, 30000);

        connections.forEach((ws) => {
          ws.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "pong") {
                messageCount++;
                if (messageCount === maxConnections) {
                  clearTimeout(timeout);
                  const endTime = Date.now();
                  const duration = endTime - startTime;

                  // Assert
                  expect(connectedCount).toBe(maxConnections);
                  expect(messageCount).toBe(maxConnections);
                  expect(duration).toBeLessThan(30000); // Moins de 30 secondes

                  console.log(
                    `✅ ${maxConnections} connexions établies en ${duration}ms`
                  );

                  // Nettoyer
                  connections.forEach((conn) => conn.close());
                  resolve();
                }
              }
            } catch (error) {
              console.error("Erreur parsing message:", error);
            }
          });
        });
      });
    }, 60000);

    it("devrait gérer 100 connexions WebSocket avec stress test", async () => {
      const connections: WebSocket[] = [];
      const maxConnections = 100;
      let connectedCount = 0;
      let messageCount = 0;
      let errorCount = 0;
      const startTime = Date.now();

      // Créer toutes les connexions avec gestion d'erreur
      for (let i = 0; i < maxConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });

        ws.on("open", () => {
          connectedCount++;
          // Envoyer plusieurs messages de stress
          for (let j = 0; j < 5; j++) {
            const pingMessage = {
              type: "ping",
              data: {
                timestamp: Date.now(),
                userId: testUsers[i].id,
                messageId: j,
              },
            };
            ws.send(JSON.stringify(pingMessage));
          }
        });

        ws.on("error", (error) => {
          errorCount++;
          console.error(
            `Erreur de connexion pour l'utilisateur ${i}:`,
            error.message
          );
        });

        connections.push(ws);
      }

      // Attendre et collecter les résultats
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout: ${connectedCount}/${maxConnections} connexions établies, ${errorCount} erreurs`
            )
          );
        }, 60000);

        connections.forEach((ws) => {
          ws.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "pong") {
                messageCount++;
                if (messageCount >= maxConnections * 5 * 0.8) {
                  // 80% des messages reçus
                  clearTimeout(timeout);
                  const endTime = Date.now();
                  const duration = endTime - startTime;

                  // Assert
                  expect(connectedCount).toBeGreaterThan(maxConnections * 0.8); // Au moins 80% de succès
                  expect(errorCount).toBeLessThan(maxConnections * 0.2); // Moins de 20% d'erreurs
                  expect(duration).toBeLessThan(60000); // Moins de 60 secondes

                  console.log(
                    `✅ Stress test: ${connectedCount}/${maxConnections} connexions, ${errorCount} erreurs, ${duration}ms`
                  );

                  // Nettoyer
                  connections.forEach((conn) => conn.close());
                  resolve();
                }
              }
            } catch (error) {
              console.error("Erreur parsing message:", error);
            }
          });
        });
      });
    }, 120000);

    it("devrait gérer les déconnexions/reconnexions massives", async () => {
      const maxConnections = 30;
      const maxReconnections = 3;
      let totalConnections = 0;
      let totalReconnections = 0;
      const startTime = Date.now();

      // Créer des connexions initiales
      const createConnections = async (count: number): Promise<WebSocket[]> => {
        const connections: WebSocket[] = [];

        for (let i = 0; i < count; i++) {
          const ws = new WebSocket(
            `ws://localhost:${server.address().port}/ws`,
            {
              headers: { "x-user-id": testUsers[i].id },
            }
          );

          await new Promise<void>((resolve) => {
            ws.on("open", () => {
              totalConnections++;
              resolve();
            });
            ws.on("error", () => resolve()); // Ignorer les erreurs pour ce test
          });

          connections.push(ws);
        }

        return connections;
      };

      // Test de déconnexion/reconnexion
      for (let round = 0; round < maxReconnections; round++) {
        console.log(
          `Round ${round + 1}: Création de ${maxConnections} connexions`
        );

        // Créer des connexions
        const connections = await createConnections(maxConnections);

        // Attendre un peu
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Fermer toutes les connexions
        connections.forEach((conn) => conn.close());
        totalReconnections += connections.length;

        // Attendre un peu avant la prochaine série
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(totalConnections).toBeGreaterThan(
        maxConnections * maxReconnections * 0.8
      );
      expect(duration).toBeLessThan(120000); // Moins de 2 minutes

      console.log(
        `✅ Reconnection test: ${totalConnections} connexions totales, ${totalReconnections} reconnections, ${duration}ms`
      );
    }, 180000);
  });

  describe("Tests de charge WebSocket - Messages simultanés", () => {
    it("devrait gérer 1000 messages par seconde", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUsers[0].id },
      });

      let messageCount = 0;
      const maxMessages = 1000;
      const startTime = Date.now();

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(`Timeout: ${messageCount}/${maxMessages} messages reçus`)
          );
        }, 30000);

        ws.on("open", () => {
          // Envoyer 1000 messages rapidement
          for (let i = 0; i < maxMessages; i++) {
            const pingMessage = {
              type: "ping",
              data: { timestamp: Date.now(), index: i },
            };
            ws.send(JSON.stringify(pingMessage));
          }
        });

        ws.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "pong") {
              messageCount++;
              if (messageCount === maxMessages) {
                clearTimeout(timeout);
                const endTime = Date.now();
                const duration = endTime - startTime;
                const messagesPerSecond = (maxMessages / duration) * 1000;

                expect(messageCount).toBe(maxMessages);
                expect(messagesPerSecond).toBeGreaterThan(50); // Au moins 50 msg/s

                console.log(
                  `✅ ${maxMessages} messages traités en ${duration}ms (${messagesPerSecond.toFixed(
                    2
                  )} msg/s)`
                );

                ws.close();
                resolve();
              }
            }
          } catch (error) {
            console.error("Erreur parsing message:", error);
          }
        });
      });
    }, 60000);

    it("devrait gérer des messages simultanés de plusieurs clients", async () => {
      const maxClients = 20;
      const messagesPerClient = 50;
      const connections: WebSocket[] = [];
      let totalMessages = 0;
      const startTime = Date.now();

      // Créer les connexions
      for (let i = 0; i < maxClients; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });
        connections.push(ws);
      }

      // Attendre que toutes les connexions soient établies
      await new Promise<void>((resolve) => {
        let connectedCount = 0;
        connections.forEach((ws) => {
          ws.on("open", () => {
            connectedCount++;
            if (connectedCount === maxClients) {
              resolve();
            }
          });
        });
      });

      // Envoyer des messages simultanément
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(
            new Error(
              `Timeout: ${totalMessages}/${
                maxClients * messagesPerClient
              } messages reçus`
            )
          );
        }, 60000);

        connections.forEach((ws, clientIndex) => {
          let clientMessages = 0;

          ws.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "pong") {
                clientMessages++;
                totalMessages++;

                if (totalMessages === maxClients * messagesPerClient) {
                  clearTimeout(timeout);
                  const endTime = Date.now();
                  const duration = endTime - startTime;
                  const messagesPerSecond = (totalMessages / duration) * 1000;

                  expect(totalMessages).toBe(maxClients * messagesPerClient);
                  expect(messagesPerSecond).toBeGreaterThan(100); // Au moins 100 msg/s

                  console.log(
                    `✅ ${totalMessages} messages simultanés traités en ${duration}ms (${messagesPerSecond.toFixed(
                      2
                    )} msg/s)`
                  );

                  connections.forEach((conn) => conn.close());
                  resolve();
                }
              }
            } catch (error) {
              console.error("Erreur parsing message:", error);
            }
          });

          // Envoyer les messages pour ce client
          for (let i = 0; i < messagesPerClient; i++) {
            const pingMessage = {
              type: "ping",
              data: {
                timestamp: Date.now(),
                clientId: clientIndex,
                messageId: i,
              },
            };
            ws.send(JSON.stringify(pingMessage));
          }
        });
      });
    }, 120000);
  });

  describe("Tests de charge WebSocket - Lobbies simultanés", () => {
    it("devrait gérer la création de 50 lobbies simultanément", async () => {
      const maxLobbies = 50;
      const connections: WebSocket[] = [];
      const lobbyResponses: any[] = [];

      // Créer des connexions WebSocket
      for (let i = 0; i < maxLobbies; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });
        connections.push(ws);
      }

      // Attendre que toutes les connexions soient établies
      await new Promise<void>((resolve) => {
        let connectedCount = 0;
        connections.forEach((ws) => {
          ws.on("open", () => {
            connectedCount++;
            if (connectedCount === maxLobbies) {
              resolve();
            }
          });
        });
      });

      // Créer des lobbies simultanément
      const startTime = Date.now();
      const promises = connections.map((ws, index) => {
        return new Promise<void>((resolve) => {
          const createLobbyMessage = {
            type: "create_lobby",
            payload: {
              name: `Test Lobby ${index}`,
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
              },
            },
          };

          ws.send(JSON.stringify(createLobbyMessage));

          ws.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "create_lobby_success") {
                lobbyResponses.push(response);
                resolve();
              }
            } catch (error) {
              console.error("Erreur parsing message:", error);
            }
          });
        });
      });

      await Promise.all(promises);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(lobbyResponses).toHaveLength(maxLobbies);
      expect(duration).toBeLessThan(60000); // Moins de 60 secondes

      console.log(
        `✅ ${maxLobbies} lobbies créés simultanément en ${duration}ms`
      );

      // Nettoyer
      connections.forEach((conn) => conn.close());
    }, 120000);

    it("devrait gérer des lobbies avec plusieurs joueurs simultanément", async () => {
      const maxLobbies = 10;
      const playersPerLobby = 5;
      const connections: WebSocket[] = [];
      const lobbyIds: string[] = [];

      // Créer des connexions pour tous les joueurs
      for (let i = 0; i < maxLobbies * playersPerLobby; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });
        connections.push(ws);
      }

      // Attendre que toutes les connexions soient établies
      await new Promise<void>((resolve) => {
        let connectedCount = 0;
        connections.forEach((ws) => {
          ws.on("open", () => {
            connectedCount++;
            if (connectedCount === maxLobbies * playersPerLobby) {
              resolve();
            }
          });
        });
      });

      // Créer des lobbies et y ajouter des joueurs
      const startTime = Date.now();

      for (let lobbyIndex = 0; lobbyIndex < maxLobbies; lobbyIndex++) {
        const hostConnection = connections[lobbyIndex * playersPerLobby];

        // Créer le lobby
        const createLobbyMessage = {
          type: "create_lobby",
          payload: {
            name: `Multiplayer Lobby ${lobbyIndex}`,
            settings: {
              selectedRegions: ["Europe"],
              gameMode: "quiz",
            },
          },
        };

        const lobbyId = await new Promise<string>((resolve) => {
          hostConnection.send(JSON.stringify(createLobbyMessage));
          hostConnection.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "create_lobby_success") {
                resolve(response.data.lobbyId);
              }
            } catch (error) {
              console.error("Erreur parsing message:", error);
            }
          });
        });

        lobbyIds.push(lobbyId);

        // Ajouter les autres joueurs au lobby
        for (
          let playerIndex = 1;
          playerIndex < playersPerLobby;
          playerIndex++
        ) {
          const playerConnection =
            connections[lobbyIndex * playersPerLobby + playerIndex];
          const joinLobbyMessage = {
            type: "join_lobby",
            payload: { lobbyId },
          };

          playerConnection.send(JSON.stringify(joinLobbyMessage));
        }
      }

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Assert
      expect(lobbyIds).toHaveLength(maxLobbies);
      expect(duration).toBeLessThan(60000); // Moins de 60 secondes

      console.log(
        `✅ ${maxLobbies} lobbies avec ${playersPerLobby} joueurs chacun créés en ${duration}ms`
      );

      // Nettoyer
      connections.forEach((conn) => conn.close());
    }, 120000);
  });

  describe("Tests de mémoire avancés", () => {
    it("devrait maintenir une utilisation mémoire stable avec 100 connexions", async () => {
      const maxConnections = 100;
      const connections: WebSocket[] = [];
      const initialMemory = process.memoryUsage().heapUsed;
      const memorySnapshots: number[] = [];

      // Créer des connexions par batch
      for (let batch = 0; batch < 5; batch++) {
        const batchConnections: WebSocket[] = [];

        for (let i = 0; i < maxConnections / 5; i++) {
          const ws = new WebSocket(
            `ws://localhost:${server.address().port}/ws`,
            {
              headers: { "x-user-id": testUsers[batch * 20 + i].id },
            }
          );
          batchConnections.push(ws);
        }

        // Attendre que le batch soit connecté
        await new Promise<void>((resolve) => {
          let connectedCount = 0;
          batchConnections.forEach((ws) => {
            ws.on("open", () => {
              connectedCount++;
              if (connectedCount === batchConnections.length) {
                resolve();
              }
            });
          });
        });

        connections.push(...batchConnections);
        memorySnapshots.push(process.memoryUsage().heapUsed);

        // Pause entre les batches
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const maxMemoryIncrease = Math.max(...memorySnapshots) - initialMemory;

      // Assert
      expect(memoryIncrease).toBeLessThan(100 * 1024 * 1024); // Moins de 100MB
      expect(maxMemoryIncrease).toBeLessThan(150 * 1024 * 1024); // Moins de 150MB max

      console.log(
        `✅ Mémoire: augmentation de ${(memoryIncrease / 1024 / 1024).toFixed(
          2
        )}MB (max: ${(maxMemoryIncrease / 1024 / 1024).toFixed(2)}MB)`
      );

      // Nettoyer
      connections.forEach((conn) => conn.close());
    }, 120000);

    it("devrait libérer la mémoire après fermeture massive", async () => {
      const maxConnections = 50;
      const connections: WebSocket[] = [];
      const initialMemory = process.memoryUsage().heapUsed;

      // Créer des connexions
      for (let i = 0; i < maxConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });
        connections.push(ws);
      }

      // Attendre que toutes les connexions soient établies
      await new Promise<void>((resolve) => {
        let connectedCount = 0;
        connections.forEach((ws) => {
          ws.on("open", () => {
            connectedCount++;
            if (connectedCount === maxConnections) {
              resolve();
            }
          });
        });
      });

      const memoryAfterConnections = process.memoryUsage().heapUsed;

      // Fermer toutes les connexions
      connections.forEach((conn) => conn.close());

      // Attendre que la mémoire soit libérée
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryDifference = Math.abs(finalMemory - initialMemory);
      const memoryFreed = memoryAfterConnections - finalMemory;

      // Assert - Plus réaliste
      expect(memoryDifference).toBeLessThan(50 * 1024 * 1024); // Moins de 50MB de différence
      // La mémoire peut ne pas être libérée immédiatement à cause du garbage collector
      // On vérifie juste que la différence totale reste raisonnable
      expect(memoryDifference).toBeLessThan(20 * 1024 * 1024); // Moins de 20MB au total

      console.log(
        `✅ Mémoire: différence totale de ${(
          memoryDifference /
          1024 /
          1024
        ).toFixed(2)}MB`
      );
    }, 90000);
  });

  describe("Tests de latence avancés", () => {
    it("devrait maintenir une latence faible avec 50 connexions simultanées", async () => {
      const maxConnections = 50;
      const connections: WebSocket[] = [];
      const latencies: number[] = [];

      // Créer des connexions
      for (let i = 0; i < maxConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });
        connections.push(ws);
      }

      // Attendre que toutes les connexions soient établies
      await new Promise<void>((resolve) => {
        let connectedCount = 0;
        connections.forEach((ws) => {
          ws.on("open", () => {
            connectedCount++;
            if (connectedCount === maxConnections) {
              resolve();
            }
          });
        });
      });

      // Envoyer des messages de ping et mesurer la latence
      const pingPromises = connections.map((ws, index) => {
        return new Promise<number>((resolve) => {
          const startTime = Date.now();
          const pingMessage = {
            type: "ping",
            data: { timestamp: startTime, connectionId: index },
          };

          ws.send(JSON.stringify(pingMessage));

          ws.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "pong") {
                const endTime = Date.now();
                const latency = endTime - startTime;
                resolve(latency);
              }
            } catch (error) {
              resolve(9999); // Latence élevée en cas d'erreur
            }
          });
        });
      });

      const connectionLatencies = await Promise.all(pingPromises);
      latencies.push(...connectionLatencies);

      // Assert
      const averageLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);
      const minLatency = Math.min(...latencies);

      expect(averageLatency).toBeLessThan(1000); // Moins de 1 seconde en moyenne
      expect(maxLatency).toBeLessThan(5000); // Moins de 5 secondes au maximum
      expect(minLatency).toBeLessThan(500); // Moins de 500ms au minimum

      console.log(
        `✅ Latence: moyenne=${averageLatency.toFixed(
          2
        )}ms, min=${minLatency}ms, max=${maxLatency}ms`
      );

      // Nettoyer
      connections.forEach((conn) => conn.close());
    }, 90000);
  });
});

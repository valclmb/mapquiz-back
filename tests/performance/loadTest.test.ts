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
    server = app.server;

    // Créer des utilisateurs de test
    for (let i = 0; i < 20; i++) {
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
    for (let i = 0; i < 20; i++) {
      const user = await testUtils.createTestUser(
        `test-user-${i}`,
        `Test User ${i}`
      );
      testUsers.push(user);
    }
  });

  describe("Tests de charge WebSocket", () => {
    it("devrait gérer 10 connexions WebSocket simultanées", async () => {
      // Arrange
      const connections: WebSocket[] = [];
      const maxConnections = 10;
      let connectedCount = 0;
      let messageCount = 0;

      // Act
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

        connections.push(ws);
      }

      // Attendre que toutes les connexions soient établies et les messages reçus
      await new Promise<void>((resolve) => {
        connections.forEach((ws) => {
          ws.on("message", (data) => {
            const response = JSON.parse(data.toString());
            if (response.type === "pong") {
              messageCount++;
              if (messageCount === maxConnections) {
                // Assert
                expect(connectedCount).toBe(maxConnections);
                expect(messageCount).toBe(maxConnections);

                // Nettoyer
                connections.forEach((conn) => conn.close());
                resolve();
              }
            }
          });
        });
      });
    }, 15000);

    it("devrait gérer 50 messages par seconde", async () => {
      // Arrange
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUsers[0].id },
      });

      let messageCount = 0;
      const maxMessages = 50;
      const startTime = Date.now();

      // Act & Assert
      await new Promise<void>((resolve) => {
        ws.on("open", () => {
          // Envoyer 50 messages rapidement
          for (let i = 0; i < maxMessages; i++) {
            const pingMessage = {
              type: "ping",
              data: { timestamp: Date.now(), index: i },
            };
            ws.send(JSON.stringify(pingMessage));
          }
        });

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "pong") {
            messageCount++;
            if (messageCount === maxMessages) {
              const endTime = Date.now();
              const duration = endTime - startTime;
              const messagesPerSecond = (maxMessages / duration) * 1000;

              expect(messageCount).toBe(maxMessages);
              expect(messagesPerSecond).toBeGreaterThan(10); // Au moins 10 msg/s

              ws.close();
              resolve();
            }
          }
        });
      });
    }, 10000);

    it("devrait gérer la création de 20 lobbies simultanément", async () => {
      // Arrange
      const lobbyPromises = [];
      const maxLobbies = 20;

      // Act
      for (let i = 0; i < maxLobbies; i++) {
        const lobbyPromise = testUtils.createTestLobby(
          `test-lobby-${i}`,
          testUsers[i].id,
          { selectedRegions: ["Europe"], gameMode: "quiz" }
        );
        lobbyPromises.push(lobbyPromise);
      }

      const lobbies = await Promise.all(lobbyPromises);

      // Assert
      expect(lobbies).toHaveLength(maxLobbies);
      lobbies.forEach((lobby, index) => {
        expect(lobby.id).toBe(`test-lobby-${index}`);
        expect(lobby.hostId).toBe(testUsers[index].id);
      });
    }, 30000);
  });

  describe("Tests de charge HTTP", () => {
    it("devrait gérer 100 requêtes HTTP simultanées", async () => {
      // Arrange
      const requestPromises = [];
      const maxRequests = 100;

      // Act
      for (let i = 0; i < maxRequests; i++) {
        const requestPromise = app.inject({
          method: "GET",
          url: "/health",
        });
        requestPromises.push(requestPromise);
      }

      const responses = await Promise.all(requestPromises);

      // Assert
      expect(responses).toHaveLength(maxRequests);
      responses.forEach((response) => {
        expect(response.statusCode).toBe(200);
        const body = JSON.parse(response.payload);
        expect(body.status).toBe("ok");
      });
    }, 30000);

    it("devrait gérer 50 requêtes de création de lobby simultanées", async () => {
      // Arrange
      const requestPromises = [];
      const maxRequests = 50;

      // Act
      for (let i = 0; i < maxRequests; i++) {
        const requestPromise = app.inject({
          method: "POST",
          url: "/api/lobbies",
          payload: {
            name: `Test Lobby ${i}`,
            settings: { selectedRegions: ["Europe"], gameMode: "quiz" },
          },
          headers: {
            "content-type": "application/json",
            "x-user-id": testUsers[i % testUsers.length].id,
          },
        });
        requestPromises.push(requestPromise);
      }

      const responses = await Promise.all(requestPromises);

      // Assert
      expect(responses).toHaveLength(maxRequests);
      responses.forEach((response) => {
        expect(response.statusCode).toBe(201);
        const body = JSON.parse(response.payload);
        expect(body.success).toBe(true);
        expect(body.lobbyId).toBeDefined();
      });
    }, 60000);
  });

  describe("Tests de mémoire", () => {
    it("devrait maintenir une utilisation mémoire stable", async () => {
      // Arrange
      const initialMemory = process.memoryUsage();
      const connections: WebSocket[] = [];
      const maxConnections = 20;

      // Act - Créer plusieurs connexions
      for (let i = 0; i < maxConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });
        connections.push(ws);
      }

      // Attendre que toutes les connexions soient établies
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Nettoyer
      connections.forEach((conn) => conn.close());

      // Assert - L'augmentation de mémoire ne devrait pas être excessive
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Moins de 50MB
    }, 30000);

    it("devrait libérer la mémoire après fermeture des connexions", async () => {
      // Arrange
      const initialMemory = process.memoryUsage();
      const connections: WebSocket[] = [];
      const maxConnections = 10;

      // Act - Créer et fermer des connexions
      for (let i = 0; i < maxConnections; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[i].id },
        });
        connections.push(ws);
      }

      // Attendre que les connexions soient établies
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Fermer toutes les connexions
      connections.forEach((conn) => conn.close());

      // Attendre la libération de mémoire
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Assert - La mémoire devrait être proche de l'état initial
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024); // Moins de 10MB
    }, 30000);
  });

  describe("Tests de latence", () => {
    it("devrait maintenir une latence faible pour les requêtes HTTP", async () => {
      // Arrange
      const latencies: number[] = [];
      const maxRequests = 20;

      // Act
      for (let i = 0; i < maxRequests; i++) {
        const startTime = Date.now();

        const response = await app.inject({
          method: "GET",
          url: "/health",
        });

        const endTime = Date.now();
        const latency = endTime - startTime;
        latencies.push(latency);

        expect(response.statusCode).toBe(200);
      }

      // Assert
      const averageLatency =
        latencies.reduce((a, b) => a + b, 0) / latencies.length;
      const maxLatency = Math.max(...latencies);

      expect(averageLatency).toBeLessThan(100); // Moins de 100ms en moyenne
      expect(maxLatency).toBeLessThan(500); // Moins de 500ms maximum
    }, 30000);

    it("devrait maintenir une latence faible pour les messages WebSocket", async () => {
      // Arrange
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUsers[0].id },
      });

      const latencies: number[] = [];
      const maxMessages = 20;
      let messageCount = 0;

      // Act & Assert
      await new Promise<void>((resolve) => {
        ws.on("open", () => {
          for (let i = 0; i < maxMessages; i++) {
            const startTime = Date.now();
            const pingMessage = {
              type: "ping",
              data: { timestamp: startTime, index: i },
            };
            ws.send(JSON.stringify(pingMessage));
          }
        });

        ws.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "pong") {
            const endTime = Date.now();
            const latency = endTime - response.data.timestamp;
            latencies.push(latency);

            messageCount++;
            if (messageCount === maxMessages) {
              const averageLatency =
                latencies.reduce((a, b) => a + b, 0) / latencies.length;
              const maxLatency = Math.max(...latencies);

              expect(averageLatency).toBeLessThan(50); // Moins de 50ms en moyenne
              expect(maxLatency).toBeLessThan(200); // Moins de 200ms maximum

              ws.close();
              resolve();
            }
          }
        });
      });
    }, 15000);
  });
});

import WebSocket from "ws";
import { LobbyLifecycleManager } from "../../src/websocket/lobby/lobbyLifecycle.js";
import { testUtils } from "../setup.js";

describe("Performance Tests", () => {
  let server: any;
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

  describe("Tests de Charge", () => {
    it("devrait gérer 10 connexions simultanées", async (done) => {
      const connections: WebSocket[] = [];
      const startTime = Date.now();

      try {
        // Créer 10 connexions simultanées
        for (let i = 0; i < 10; i++) {
          const ws = new WebSocket(baseUrl);
          connections.push(ws);

          await new Promise<void>((resolve, reject) => {
            ws.on("open", () => resolve());
            ws.on("error", reject);
          });
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`10 connexions établies en ${duration}ms`);
        expect(duration).toBeLessThan(5000); // Moins de 5 secondes
        expect(connections.length).toBe(10);

        // Fermer toutes les connexions
        connections.forEach((ws) => ws.close());
        done();
      } catch (error) {
        connections.forEach((ws) => ws.close());
        done(error);
      }
    }, 10000);

    it("devrait gérer 5 lobbies simultanés avec 3 joueurs chacun", async (done) => {
      const lobbies: string[] = [];
      const connections: WebSocket[] = [];
      const startTime = Date.now();

      try {
        // Créer 5 lobbies avec 3 joueurs chacun
        for (let lobbyIndex = 0; lobbyIndex < 5; lobbyIndex++) {
          const hostId = testUtils.generateId();
          await testUtils.createTestUser(hostId, `Host ${lobbyIndex}`);

          // Créer le lobby
          const lobbyId = await createLobbyWithWebSocket(hostId, connections);
          lobbies.push(lobbyId);

          // Ajouter 2 joueurs supplémentaires
          for (let playerIndex = 0; playerIndex < 2; playerIndex++) {
            const playerId = testUtils.generateId();
            await testUtils.createTestUser(
              playerId,
              `Player ${lobbyIndex}-${playerIndex}`
            );
            await joinLobbyWithWebSocket(playerId, lobbyId, connections);
          }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`5 lobbies avec 3 joueurs chacun créés en ${duration}ms`);
        expect(duration).toBeLessThan(10000); // Moins de 10 secondes
        expect(lobbies.length).toBe(5);

        // Vérifier que tous les lobbies sont en mémoire
        const activeLobbies = LobbyLifecycleManager.getAllActiveLobbies();
        expect(activeLobbies.size).toBe(5);

        // Fermer toutes les connexions
        connections.forEach((ws) => ws.close());
        done();
      } catch (error) {
        connections.forEach((ws) => ws.close());
        done(error);
      }
    }, 15000);

    it("devrait gérer 100 messages WebSocket par seconde", async (done) => {
      const hostId = testUtils.generateId();
      await testUtils.createTestUser(hostId, "Performance Host");

      const ws = new WebSocket(baseUrl);
      const lobbyId = await createLobbyWithWebSocket(hostId, [ws]);

      const startTime = Date.now();
      let messageCount = 0;
      const targetMessages = 100;

      // Envoyer 100 messages ping rapidement
      for (let i = 0; i < targetMessages; i++) {
        ws.send(JSON.stringify({ type: "ping" }));
      }

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "pong") {
          messageCount++;
          if (messageCount === targetMessages) {
            const endTime = Date.now();
            const duration = endTime - startTime;
            const messagesPerSecond = (targetMessages / duration) * 1000;

            console.log(
              `${targetMessages} messages traités en ${duration}ms (${messagesPerSecond.toFixed(
                2
              )} msg/s)`
            );
            expect(messagesPerSecond).toBeGreaterThan(50); // Au moins 50 msg/s
            ws.close();
            done();
          }
        }
      });

      ws.on("error", (error) => {
        ws.close();
        done(error);
      });
    }, 10000);
  });

  describe("Tests de Mémoire", () => {
    it("devrait libérer la mémoire après suppression des lobbies", async (done) => {
      const initialMemory = process.memoryUsage();
      const lobbies: string[] = [];
      const connections: WebSocket[] = [];

      try {
        // Créer 10 lobbies
        for (let i = 0; i < 10; i++) {
          const hostId = testUtils.generateId();
          await testUtils.createTestUser(hostId, `Host ${i}`);
          const lobbyId = await createLobbyWithWebSocket(hostId, connections);
          lobbies.push(lobbyId);
        }

        // Vérifier que les lobbies sont créés
        const activeLobbies = LobbyLifecycleManager.getAllActiveLobbies();
        expect(activeLobbies.size).toBe(10);

        // Supprimer tous les lobbies
        for (const lobbyId of lobbies) {
          LobbyLifecycleManager.removeLobby(lobbyId);
        }

        // Vérifier que les lobbies sont supprimés
        const remainingLobbies = LobbyLifecycleManager.getAllActiveLobbies();
        expect(remainingLobbies.size).toBe(0);

        // Fermer les connexions
        connections.forEach((ws) => ws.close());

        // Attendre un peu pour le garbage collector
        await testUtils.wait(1000);

        const finalMemory = process.memoryUsage();
        const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

        console.log(
          `Augmentation mémoire: ${(memoryIncrease / 1024 / 1024).toFixed(
            2
          )} MB`
        );
        expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Moins de 50 MB

        done();
      } catch (error) {
        connections.forEach((ws) => ws.close());
        done(error);
      }
    }, 15000);
  });

  describe("Tests de Latence", () => {
    it("devrait répondre aux messages en moins de 100ms", async (done) => {
      const hostId = testUtils.generateId();
      await testUtils.createTestUser(hostId, "Latency Host");

      const ws = new WebSocket(baseUrl);
      const latencies: number[] = [];

      ws.on("open", () => {
        // Envoyer 10 messages ping et mesurer la latence
        for (let i = 0; i < 10; i++) {
          const startTime = Date.now();
          ws.send(JSON.stringify({ type: "ping" }));

          ws.once("message", (data) => {
            const message = JSON.parse(data.toString());
            if (message.type === "pong") {
              const endTime = Date.now();
              const latency = endTime - startTime;
              latencies.push(latency);

              if (latencies.length === 10) {
                const avgLatency =
                  latencies.reduce((a, b) => a + b, 0) / latencies.length;
                const maxLatency = Math.max(...latencies);

                console.log(
                  `Latence moyenne: ${avgLatency.toFixed(
                    2
                  )}ms, Max: ${maxLatency}ms`
                );
                expect(avgLatency).toBeLessThan(100); // Moins de 100ms en moyenne
                expect(maxLatency).toBeLessThan(200); // Moins de 200ms max

                ws.close();
                done();
              }
            }
          });
        }
      });

      ws.on("error", (error) => {
        ws.close();
        done(error);
      });
    }, 10000);
  });

  describe("Tests de Robustesse", () => {
    it("devrait gérer les déconnexions brutales", async (done) => {
      const connections: WebSocket[] = [];
      const startTime = Date.now();

      try {
        // Créer 20 connexions
        for (let i = 0; i < 20; i++) {
          const ws = new WebSocket(baseUrl);
          connections.push(ws);

          await new Promise<void>((resolve, reject) => {
            ws.on("open", () => resolve());
            ws.on("error", reject);
          });
        }

        // Fermer brutalement 10 connexions
        for (let i = 0; i < 10; i++) {
          connections[i].terminate(); // Fermeture brutale
        }

        // Attendre un peu
        await testUtils.wait(1000);

        // Vérifier que le serveur fonctionne toujours
        const remainingConnections = connections.slice(10);
        for (const ws of remainingConnections) {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "ping" }));
          }
        }

        const endTime = Date.now();
        const duration = endTime - startTime;

        console.log(`Test de robustesse terminé en ${duration}ms`);
        expect(duration).toBeLessThan(10000);

        // Fermer les connexions restantes
        remainingConnections.forEach((ws) => ws.close());
        done();
      } catch (error) {
        connections.forEach((ws) => ws.close());
        done(error);
      }
    }, 15000);
  });

  // Fonctions utilitaires pour les tests de performance
  async function createLobbyWithWebSocket(
    hostId: string,
    connections: WebSocket[]
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);
      connections.push(ws);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "create_lobby",
            payload: {
              name: "Performance Test Lobby",
              settings: { selectedRegions: ["Europe"], gameMode: "quiz" },
            },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "create_lobby_success") {
          resolve(message.data.lobbyId);
        }
      });

      ws.on("error", reject);
    });
  }

  async function joinLobbyWithWebSocket(
    playerId: string,
    lobbyId: string,
    connections: WebSocket[]
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);
      connections.push(ws);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "join_lobby",
            payload: { lobbyId },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "join_lobby_success") {
          resolve();
        }
      });

      ws.on("error", reject);
    });
  }
});

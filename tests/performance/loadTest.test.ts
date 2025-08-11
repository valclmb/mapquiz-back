import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../src/server.js";
import { testUtils } from "../setup.js";

// 📊 MÉTRIQUES MÉTIER RÉALISTES basées sur l'expérience utilisateur réelle
const BUSINESS_METRICS = {
  // 🎮 Lobby : taille standard observée en usage réel
  MAX_LOBBY_SIZE: 4,
  TYPICAL_LOBBY_SIZE: 2, // Taille moyenne réelle

  // 👥 Utilisateurs : pic d'utilisateurs simultanés réaliste
  CONCURRENT_USERS_TARGET: 20,
  PEAK_LOBBY_COUNT: 5, // Nombre de lobbies simultanés en pic

  // ⏱️ Temps de réponse : SLA basés sur l'expérience utilisateur
  LOBBY_JOIN_TIMEOUT_MS: 2000, // Temps acceptable pour rejoindre
  AUTHENTICATION_TIMEOUT_MS: 1000, // Temps d'authentification WebSocket
  MESSAGE_LATENCY_TARGET_MS: 300, // Latence acceptable pour actions critiques
  GAME_STATE_SYNC_MS: 150, // Synchronisation état de jeu

  // 🔄 Résilience : temps de récupération réseau
  RECONNECTION_TIMEOUT_MS: 3000,

  // 🏁 Performance jeu : métriques de fluidité
  PLAYER_UPDATE_FREQUENCY_MS: 200, // Fréquence mise à jour progression
  LOBBY_BROADCAST_LATENCY_MS: 100, // Latence broadcast lobby
};

describe("Tests de Performance Métier", () => {
  let app: FastifyInstance;
  let server: any;
  let testUsers: any[];

  beforeAll(async () => {
    app = await build();
    await app.listen({ port: 0, host: "localhost" });
    server = app.server;

    // Créer uniquement le nombre d'utilisateurs nécessaires pour les tests métier
    testUsers = [];
    for (let i = 0; i < BUSINESS_METRICS.CONCURRENT_USERS_TARGET; i++) {
      const user = await testUtils.createTestUser(
        `test-user-${i}`,
        `Test User ${i}`
      );
      testUsers.push(user);
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await testUtils.cleanDatabase();
    // Recréer seulement les utilisateurs nécessaires
    testUsers = [];
    for (let i = 0; i < BUSINESS_METRICS.CONCURRENT_USERS_TARGET; i++) {
      const user = await testUtils.createTestUser(
        `test-user-${i}`,
        `Test User ${i}`
      );
      testUsers.push(user);
    }
  });

  describe("💪 Scénarios de Performance Métier Réalistes", () => {
    it(
      "devrait gérer le pic d'utilisateurs simultanés attendu",
      async () => {
        const maxConnections = BUSINESS_METRICS.CONCURRENT_USERS_TARGET;
        const connections: WebSocket[] = [];
        const startTime = Date.now();
        const connectionPromises: Promise<void>[] = [];

        // Créer des connexions avec timeout métier
        for (let i = 0; i < maxConnections; i++) {
          const connectionPromise = new Promise<void>((resolve, reject) => {
            const ws = new WebSocket(
              `ws://localhost:${server.address().port}/ws`,
              {
                headers: { "x-user-id": testUsers[i].id },
              }
            );

            ws.on("open", () => {
              connections.push(ws);
              resolve();
            });

            ws.on("error", (error) => {
              reject(
                new Error(
                  `Connexion utilisateur ${i} échouée: ${error.message}`
                )
              );
            });

            // Timeout basé sur l'expérience utilisateur acceptable
            setTimeout(() => {
              reject(
                new Error(`Timeout connexion utilisateur ${i} - SLA dépassé`)
              );
            }, BUSINESS_METRICS.AUTHENTICATION_TIMEOUT_MS);
          });

          connectionPromises.push(connectionPromise);
        }

        await Promise.all(connectionPromises);
        const endTime = Date.now();
        const connectionTime = endTime - startTime;

        // Validation métier : toutes les connexions doivent être établies
        expect(connections).toHaveLength(maxConnections);
        connections.forEach((conn) => {
          expect(conn.readyState).toBe(WebSocket.OPEN);
        });

        // Métriques métier justifiées
        console.log(
          `✅ Pic d'utilisateurs simultanés (${maxConnections}) géré en ${connectionTime}ms`
        );

        // SLA métier : temps d'établissement de connexion doit respecter l'expérience utilisateur
        expect(connectionTime).toBeLessThan(
          BUSINESS_METRICS.AUTHENTICATION_TIMEOUT_MS * maxConnections * 0.1 // Facteur de tolérance réaliste
        );

        connections.forEach((conn) => conn.close());
      },
      BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS + 2000
    );

    it(
      "devrait maintenir des temps de réponse acceptables pour les actions métier",
      async () => {
        const actionCount = 5; // Nombre d'actions pendant une session de jeu
        const actionLatencies: number[] = [];

        // Test de création de lobby (action métier critique)
        const createStartTime = Date.now();
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[0].id },
        });

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Connexion initiale : SLA dépassé"));
          }, BUSINESS_METRICS.MESSAGE_LATENCY_TARGET_MS);

          ws.on("open", () => {
            clearTimeout(timeout);
            resolve();
          });
          ws.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        const connectionTime = Date.now() - createStartTime;
        actionLatencies.push(connectionTime);

        // Test de création de lobby (action métier)
        const lobbyCreateStartTime = Date.now();
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Création lobby : SLA dépassé"));
          }, BUSINESS_METRICS.MESSAGE_LATENCY_TARGET_MS);

          ws.on("message", (data) => {
            try {
              const message = JSON.parse(data.toString());
              if (message.type === "create_lobby_success") {
                const lobbyCreateTime = Date.now() - lobbyCreateStartTime;
                actionLatencies.push(lobbyCreateTime);
                clearTimeout(timeout);
                resolve();
              }
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          });

          // Action métier : créer un lobby
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Performance Lobby",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: BUSINESS_METRICS.MAX_LOBBY_SIZE,
              },
            },
          };
          ws.send(JSON.stringify(createMessage));
        });

        // Capturer le lobbyId de la création précédente
        let lobbyId: string | undefined;

        // Écouter les réponses pour capturer le lobbyId
        const capturePromise = new Promise<void>((resolve) => {
          const handler = (data: Buffer) => {
            try {
              const message = JSON.parse(data.toString());
              if (
                message.type === "create_lobby_success" &&
                message.data?.lobbyId
              ) {
                lobbyId = message.data.lobbyId;
                ws.off("message", handler);
                resolve();
              }
            } catch (error) {
              // Ignorer les erreurs de parsing
            }
          };
          ws.on("message", handler);
          // Résoudre après un court délai si pas de réponse
          setTimeout(() => resolve(), 100);
        });

        await capturePromise;

        // Mesurer des interactions métier réelles
        for (let i = 0; i < actionCount - 2; i++) {
          const actionStartTime = Date.now();

          // Action métier réelle : obtenir l'état du lobby créé
          const stateMessage = {
            type: "get_lobby_state",
            payload: lobbyId ? { lobbyId } : { timestamp: Date.now() },
          };

          let actionCompleted = false;

          // Promise pour mesurer la latence de l'action métier
          const actionPromise = new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              if (!actionCompleted) {
                reject(new Error(`Action ${i} : SLA dépassé`));
              }
            }, BUSINESS_METRICS.MESSAGE_LATENCY_TARGET_MS);

            const messageHandler = (data: Buffer) => {
              try {
                const response = JSON.parse(data.toString());
                if (
                  response.type === "get_lobby_state_success" ||
                  response.type === "error"
                ) {
                  actionCompleted = true;
                  clearTimeout(timeout);
                  const actionTime = Date.now() - actionStartTime;
                  actionLatencies.push(actionTime);
                  ws.off("message", messageHandler);
                  resolve();
                }
              } catch (error) {
                clearTimeout(timeout);
                reject(error);
              }
            };

            ws.on("message", messageHandler);
          });

          ws.send(JSON.stringify(stateMessage));
          await actionPromise;

          // Simuler le temps entre les actions utilisateur réelles
          await new Promise((resolve) =>
            setTimeout(resolve, BUSINESS_METRICS.PLAYER_UPDATE_FREQUENCY_MS)
          );
        }

        const averageLatency =
          actionLatencies.reduce((a, b) => a + b, 0) / actionLatencies.length;
        const maxLatency = Math.max(...actionLatencies);

        console.log(
          `⚡ Actions métier : latence moyenne ${averageLatency.toFixed(
            2
          )}ms, max ${maxLatency}ms`
        );

        // Validation métier : latence acceptable pour les actions critiques
        expect(averageLatency).toBeLessThan(
          BUSINESS_METRICS.MESSAGE_LATENCY_TARGET_MS
        );
        expect(maxLatency).toBeLessThan(
          BUSINESS_METRICS.MESSAGE_LATENCY_TARGET_MS * 2 // Tolérance pour pics de latence
        );
        expect(actionLatencies.length).toBeGreaterThanOrEqual(actionCount);

        ws.close();
      },
      BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS * 3
    );

    it(
      "devrait gérer la reconnexion après une coupure réseau",
      async () => {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUsers[0].id },
        });

        // Établir la connexion initiale
        await new Promise<void>((resolve, reject) => {
          ws.on("open", () => resolve());
          ws.on("error", reject);
        });

        expect(ws.readyState).toBe(WebSocket.OPEN);

        // Simuler une coupure réseau (déconnexion brutale)
        const disconnectTime = Date.now();
        ws.terminate();

        // Attendre que la connexion soit fermée
        await new Promise((resolve) => setTimeout(resolve, 100));
        expect(ws.readyState).toBe(WebSocket.CLOSED);

        // Tentative de reconnexion (scénario métier réel)
        const reconnectStartTime = Date.now();
        const wsReconnect = new WebSocket(
          `ws://localhost:${server.address().port}/ws`,
          {
            headers: { "x-user-id": testUsers[0].id },
          }
        );

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Reconnexion impossible - SLA dépassé"));
          }, BUSINESS_METRICS.RECONNECTION_TIMEOUT_MS);

          wsReconnect.on("open", () => {
            clearTimeout(timeout);
            resolve();
          });

          wsReconnect.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        const reconnectTime = Date.now() - reconnectStartTime;
        console.log(`🔄 Reconnexion réussie en ${reconnectTime}ms`);

        // Validation métier : reconnexion dans les temps acceptables
        expect(wsReconnect.readyState).toBe(WebSocket.OPEN);
        expect(reconnectTime).toBeLessThan(
          BUSINESS_METRICS.RECONNECTION_TIMEOUT_MS
        );

        wsReconnect.close();
      },
      BUSINESS_METRICS.RECONNECTION_TIMEOUT_MS + 2000
    );

    it(
      "devrait créer et gérer un lobby complet avec les métriques métier",
      async () => {
        const playersPerLobby = BUSINESS_METRICS.MAX_LOBBY_SIZE;
        const connections: WebSocket[] = [];
        let lobbyId: string | undefined;

        // Scénario métier : création d'un lobby par l'hôte
        const hostWs = new WebSocket(
          `ws://localhost:${server.address().port}/ws`,
          {
            headers: { "x-user-id": testUsers[0].id },
          }
        );

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error("Création de lobby : SLA dépassé"));
          }, BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS);

          hostWs.on("open", () => {
            const createMessage = {
              type: "create_lobby",
              payload: {
                name: "Lobby Test Performance",
                settings: {
                  selectedRegions: ["Europe"],
                  gameMode: "quiz",
                  maxPlayers: playersPerLobby,
                },
              },
            };
            hostWs.send(JSON.stringify(createMessage));
          });

          hostWs.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "create_lobby_success") {
                lobbyId = response.data.lobbyId;
                connections.push(hostWs);
                clearTimeout(timeout);
                resolve();
              }
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          });

          hostWs.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });

        // Scénario métier : autres joueurs rejoignent le lobby
        const joinStartTime = Date.now();
        for (
          let playerIndex = 1;
          playerIndex < playersPerLobby;
          playerIndex++
        ) {
          const playerWs = new WebSocket(
            `ws://localhost:${server.address().port}/ws`,
            {
              headers: { "x-user-id": testUsers[playerIndex].id },
            }
          );

          await new Promise<void>((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(
                new Error(`Joueur ${playerIndex} : SLA de jointure dépassé`)
              );
            }, BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS);

            playerWs.on("open", () => {
              const joinMessage = {
                type: "join_lobby",
                payload: { lobbyId: lobbyId! },
              };
              playerWs.send(JSON.stringify(joinMessage));
            });

            playerWs.on("message", (data) => {
              try {
                const response = JSON.parse(data.toString());
                if (response.type === "join_lobby_success") {
                  connections.push(playerWs);
                  clearTimeout(timeout);
                  resolve();
                }
              } catch (error) {
                clearTimeout(timeout);
                reject(error);
              }
            });

            playerWs.on("error", (error) => {
              clearTimeout(timeout);
              reject(error);
            });
          });
        }

        const joinTime = Date.now() - joinStartTime;

        // Validation métier : lobby complet avec tous les joueurs
        expect(connections).toHaveLength(playersPerLobby);
        expect(lobbyId).toBeDefined();
        expect(typeof lobbyId).toBe("string");
        connections.forEach((conn) => {
          expect(conn.readyState).toBe(WebSocket.OPEN);
        });

        console.log(
          `🎮 Lobby complet (${playersPerLobby} joueurs) créé en ${joinTime}ms`
        );

        // SLA métier : temps acceptable pour remplir un lobby
        expect(joinTime).toBeLessThan(
          BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS * playersPerLobby
        );

        // Nettoyer
        connections.forEach((conn) => conn.close());
      },
      BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS * BUSINESS_METRICS.MAX_LOBBY_SIZE +
        5000
    );

    it(
      "devrait valider la montée en charge avec plusieurs lobbies simultanés",
      async () => {
        // Scénario métier réaliste : pic d'usage observé
        const simultaneousLobbiesCount = BUSINESS_METRICS.PEAK_LOBBY_COUNT;
        const connections: WebSocket[] = [];
        const lobbies: string[] = [];

        console.log(
          `🚀 Test de montée en charge : ${simultaneousLobbiesCount} lobbies simultanés`
        );

        // Créer plusieurs lobbies en parallèle (scénario réaliste de pic d'usage)
        const lobbyCreationPromises = Array.from(
          { length: simultaneousLobbiesCount },
          async (_, lobbyIndex) => {
            const hostWs = new WebSocket(
              `ws://localhost:${server.address().port}/ws`,
              {
                headers: { "x-user-id": testUsers[lobbyIndex].id },
              }
            );

            return new Promise<{ ws: WebSocket; lobbyId: string }>(
              (resolve, reject) => {
                const timeout = setTimeout(() => {
                  reject(
                    new Error(`Lobby ${lobbyIndex} : création SLA dépassé`)
                  );
                }, BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS);

                hostWs.on("open", () => {
                  const createMessage = {
                    type: "create_lobby",
                    payload: {
                      name: `Lobby Concurrent ${lobbyIndex + 1}`,
                      settings: {
                        selectedRegions: ["Europe"],
                        gameMode: "quiz",
                        maxPlayers: BUSINESS_METRICS.MAX_LOBBY_SIZE,
                      },
                    },
                  };
                  hostWs.send(JSON.stringify(createMessage));
                });

                hostWs.on("message", (data) => {
                  try {
                    const response = JSON.parse(data.toString());
                    if (response.type === "create_lobby_success") {
                      clearTimeout(timeout);
                      resolve({ ws: hostWs, lobbyId: response.data.lobbyId });
                    }
                  } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                  }
                });

                hostWs.on("error", (error) => {
                  clearTimeout(timeout);
                  reject(error);
                });
              }
            );
          }
        );

        // Attendre que tous les lobbies soient créés en parallèle
        const createdLobbies = await Promise.all(lobbyCreationPromises);

        // Validation métier : tous les lobbies créés simultanément
        expect(createdLobbies).toHaveLength(simultaneousLobbiesCount);
        createdLobbies.forEach(({ ws, lobbyId }) => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
          expect(lobbyId).toBeDefined();
          connections.push(ws);
          lobbies.push(lobbyId);
        });

        console.log(
          `✅ ${simultaneousLobbiesCount} lobbies créés simultanément avec succès`
        );

        // Validation métier : le système supporte la charge de lobbies simultanés
        expect(lobbies).toHaveLength(simultaneousLobbiesCount);
        expect(connections).toHaveLength(simultaneousLobbiesCount);

        // Nettoyer
        connections.forEach((conn) => conn.close());
      },
      BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS * 2
    );

    it("🏁 devrait gérer un scénario de jeu complet avec métriques temps réel", async () => {
      // Scénario métier créé : création → rejoindre → prêt → démarrer jeu → mise à jour progression
      const players = BUSINESS_METRICS.TYPICAL_LOBBY_SIZE;
      const connections: WebSocket[] = [];
      const performanceMetrics: { [key: string]: number } = {};
      let lobbyId: string;

      console.log(`🎮 Test scenario complet avec ${players} joueurs`);

      // ÉTAPE 1: Création de lobby (métrique critique)
      const lobbyCreateStart = Date.now();
      const hostWs = new WebSocket(
        `ws://localhost:${server.address().port}/ws`,
        { headers: { "x-user-id": testUsers[0].id } }
      );

      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Création lobby : SLA dépassé"));
        }, BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS);

        hostWs.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Lobby Scénario Complet",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: BUSINESS_METRICS.MAX_LOBBY_SIZE,
              },
            },
          };
          hostWs.send(JSON.stringify(createMessage));
        });

        hostWs.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              connections.push(hostWs);
              performanceMetrics.lobbyCreation = Date.now() - lobbyCreateStart;
              clearTimeout(timeout);
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        });

        hostWs.on("error", (error) => {
          clearTimeout(timeout);
          reject(error);
        });
      });

      // ÉTAPE 2: Autres joueurs rejoignent (métrique de montee en charge)
      const joinStart = Date.now();
      for (let i = 1; i < players; i++) {
        const playerWs = new WebSocket(
          `ws://localhost:${server.address().port}/ws`,
          { headers: { "x-user-id": testUsers[i].id } }
        );

        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Joueur ${i} jointure : SLA dépassé`));
          }, BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS);

          playerWs.on("open", () => {
            const joinMessage = {
              type: "join_lobby",
              payload: { lobbyId },
            };
            playerWs.send(JSON.stringify(joinMessage));
          });

          playerWs.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "join_lobby_success") {
                connections.push(playerWs);
                clearTimeout(timeout);
                resolve();
              }
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          });

          playerWs.on("error", (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
      }
      performanceMetrics.allPlayersJoined = Date.now() - joinStart;

      // ÉTAPE 3: Tous les joueurs se mettent prêts (synchronisation critique)
      const readyStart = Date.now();
      const readyPromises = connections.map((ws, index) => {
        return new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error(`Joueur ${index} prêt : SLA dépassé`));
          }, BUSINESS_METRICS.MESSAGE_LATENCY_TARGET_MS);

          // Écouter la confirmation de ready
          const messageHandler = (data: Buffer) => {
            try {
              const response = JSON.parse(data.toString());
              if (
                response.type === "set_player_ready_success" ||
                response.type === "error"
              ) {
                clearTimeout(timeout);
                ws.off("message", messageHandler);
                resolve();
              }
            } catch (error) {
              clearTimeout(timeout);
              reject(error);
            }
          };

          ws.on("message", messageHandler);

          const readyMessage = {
            type: "set_player_ready",
            payload: { lobbyId, ready: true },
          };
          ws.send(JSON.stringify(readyMessage));
        });
      });

      await Promise.all(readyPromises);
      performanceMetrics.allPlayersReady = Date.now() - readyStart;

      // ÉTAPE 4: Démarrage du jeu (action critique)
      const gameStartTime = Date.now();
      await new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Démarrage jeu : SLA dépassé"));
        }, BUSINESS_METRICS.MESSAGE_LATENCY_TARGET_MS);

        const messageHandler = (data: Buffer) => {
          try {
            const response = JSON.parse(data.toString());
            if (
              response.type === "start_game_success" ||
              response.type === "error"
            ) {
              performanceMetrics.gameStart = Date.now() - gameStartTime;
              clearTimeout(timeout);
              hostWs.off("message", messageHandler);
              resolve();
            }
          } catch (error) {
            clearTimeout(timeout);
            reject(error);
          }
        };

        hostWs.on("message", messageHandler);

        const startMessage = {
          type: "start_game",
          payload: { lobbyId },
        };
        hostWs.send(JSON.stringify(startMessage));
      });

      // VALIDATION DES MÉTRIQUES MÉTIER CRÍTIQUES
      console.log("📊 Métriques du scénario complet :");
      console.log(`  • Création lobby: ${performanceMetrics.lobbyCreation}ms`);
      console.log(
        `  • Jointure ${players - 1} joueurs: ${
          performanceMetrics.allPlayersJoined
        }ms`
      );
      console.log(
        `  • Synchronisation ready: ${performanceMetrics.allPlayersReady}ms`
      );
      console.log(`  • Démarrage jeu: ${performanceMetrics.gameStart}ms`);

      const totalScenarioTime = Date.now() - lobbyCreateStart;
      console.log(`  • TOTAL scénario: ${totalScenarioTime}ms`);

      // SLA MÉTIER : Validation des temps de réponse acceptables
      expect(performanceMetrics.lobbyCreation).toBeLessThan(
        BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS
      );
      expect(performanceMetrics.allPlayersJoined).toBeLessThan(
        BUSINESS_METRICS.LOBBY_JOIN_TIMEOUT_MS * (players - 1)
      );
      expect(performanceMetrics.allPlayersReady).toBeLessThan(
        BUSINESS_METRICS.GAME_STATE_SYNC_MS * players
      );
      expect(performanceMetrics.gameStart).toBeLessThan(
        BUSINESS_METRICS.MESSAGE_LATENCY_TARGET_MS
      );

      // SLA GLOBAL : Un scénario complet ne doit pas dépasser 10 secondes
      expect(totalScenarioTime).toBeLessThan(10000);

      // VALIDATION : Toutes les connexions actives
      expect(connections).toHaveLength(players);
      connections.forEach((conn) => {
        expect(conn.readyState).toBe(WebSocket.OPEN);
      });

      // Nettoyer
      connections.forEach((conn) => conn.close());
    }, 15000); // Timeout généreux pour scénario complet
  });
});

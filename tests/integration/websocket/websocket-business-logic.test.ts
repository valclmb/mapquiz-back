import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../../src/server.js";
import { testUtils } from "../../setup.js";

/**
 * 🎯 Tests WebSocket - Focus Logique Métier Réelle
 *
 * Tests d'intégration qui valident le comportement réel des WebSockets
 * avec la base de données et la logique métier, sans mocks excessifs.
 *
 * OBJECTIF: Valider que les messages WebSocket produisent les effets
 * attendus dans la base de données et l'état en mémoire.
 */
describe("WebSocket Business Logic Integration", () => {
  let app: FastifyInstance;
  let server: any;
  let testUser1: any;
  let testUser2: any;
  let testUser3: any;

  beforeAll(async () => {
    app = await build();
    await app.listen({ port: 0, host: "localhost" });
    server = app.server;
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await testUtils.cleanDatabase();
    testUser1 = await testUtils.createTestUser("user1", "User One");
    testUser2 = await testUtils.createTestUser("user2", "User Two");
    testUser3 = await testUtils.createTestUser("user3", "User Three");
  });

  describe("📱 Authentification et Restauration d'État", () => {
    it("devrait restaurer les lobbies en attente lors de la reconnexion", async () => {
      // ✅ Test SANS mocks : vérification base de données réelle

      // 1. Créer un lobby en base de données directement
      const testLobby = await testUtils.createTestLobby(
        "lobby-restore-test",
        testUser1.id,
        { selectedRegions: ["Europe"], gameMode: "quiz", maxPlayers: 4 }
      );

      // 2. Connexion WebSocket du joueur
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      try {
        await new Promise<void>((resolve, reject) => {
          let authenticatedReceived = false;
          let lobbyUpdateReceived = false;

          ws.on("open", () => {
            // La connexion déclenche automatiquement l'authentification
          });

          ws.on("message", (data) => {
            const response = JSON.parse(data.toString());

            if (response.type === "authenticated") {
              authenticatedReceived = true;
              expect(response.data.userId).toBe(testUser1.id);
            }

            if (response.type === "lobby_updated") {
              lobbyUpdateReceived = true;
              // ✅ Validation métier : le lobby en base est restauré
              expect(response.data.lobbyId).toBe(testLobby.id);
              expect(response.data.hostId).toBe(testUser1.id);
              expect(response.data.status).toBe("waiting");
            }

            if (authenticatedReceived && lobbyUpdateReceived) {
              resolve();
            }
          });

          ws.on("error", reject);
          setTimeout(() => reject(new Error("Timeout restauration")), 5000);
        });

        // ✅ Vérification supplémentaire : état base de données intact
        const lobbyAfter = await testUtils.findLobbyInDB(testLobby.id);
        expect(lobbyAfter?.status).toBe("waiting");
        expect(lobbyAfter?.hostId).toBe(testUser1.id);
      } finally {
        ws.close();
      }
    });

    it("ne devrait PAS restaurer les lobbies en cours de partie", async () => {
      // ✅ Test de logique métier critique : filtrage par statut

      // 1. Créer un lobby en cours de partie
      const playingLobby = await testUtils.createTestLobby(
        "lobby-playing-test",
        testUser1.id,
        { selectedRegions: ["Europe"], gameMode: "quiz", maxPlayers: 4 }
      );

      // Mettre à jour le statut en "playing" en base
      await testUtils.updateLobbyStatus(playingLobby.id, "playing");

      // 2. Connexion WebSocket
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      try {
        await new Promise<void>((resolve, reject) => {
          let authenticatedReceived = false;

          ws.on("message", (data) => {
            const response = JSON.parse(data.toString());

            if (response.type === "authenticated") {
              authenticatedReceived = true;
              resolve();
            }

            if (response.type === "lobby_updated") {
              // ✅ Ce message ne devrait PAS être reçu pour un lobby "playing"
              reject(new Error("Lobby en cours de partie restauré à tort"));
            }
          });

          ws.on("error", reject);

          // Résolution après délai sans lobby_updated
          setTimeout(() => {
            if (authenticatedReceived) {
              resolve();
            } else {
              reject(new Error("Authentification échouée"));
            }
          }, 2000);
        });
      } finally {
        ws.close();
      }
    });
  });

  describe("🎮 Cycle de Vie des Lobbies", () => {
    it("devrait créer un lobby et le persister en base de données", async () => {
      // ✅ Test end-to-end complet SANS mocks

      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let createdLobbyId: string;

      try {
        await new Promise<void>((resolve, reject) => {
          ws.on("open", () => {
            // Attendre l'authentification avant de créer le lobby
            setTimeout(() => {
              ws.send(
                JSON.stringify({
                  type: "create_lobby",
                  payload: {
                    name: "Real Integration Test Lobby",
                    settings: {
                      selectedRegions: ["Europe", "Asia"],
                      gameMode: "quiz",
                      maxPlayers: 3,
                    },
                  },
                })
              );
            }, 500);
          });

          ws.on("message", async (data) => {
            const response = JSON.parse(data.toString());

            if (response.type === "create_lobby_success") {
              createdLobbyId = response.data.lobbyId;

              // ✅ Validation WebSocket response
              expect(response.data.success).toBe(true);
              expect(response.data.hostId).toBe(testUser1.id);
              expect(response.data.settings.selectedRegions).toEqual([
                "Europe",
                "Asia",
              ]);
              expect(response.data.settings.maxPlayers).toBe(3);

              // ✅ Validation critique : persistence en base de données
              const lobbyInDB = await testUtils.findLobbyInDB(createdLobbyId);
              expect(lobbyInDB).toBeTruthy();
              expect(lobbyInDB?.name).toBe("Real Integration Test Lobby");
              expect(lobbyInDB?.hostId).toBe(testUser1.id);
              expect(lobbyInDB?.status).toBe("waiting");

              // ✅ Validation settings JSON en base
              const settings = lobbyInDB?.gameSettings as any;
              expect(settings?.selectedRegions).toEqual(["Europe", "Asia"]);
              expect(settings?.gameMode).toBe("quiz");
              expect(settings?.maxPlayers).toBe(3);

              resolve();
            }
          });

          ws.on("error", reject);
          setTimeout(() => reject(new Error("Timeout création lobby")), 8000);
        });
      } finally {
        ws.close();
      }
    });

    it("devrait permettre à un joueur de rejoindre et synchroniser l'état", async () => {
      // ✅ Test multi-joueurs RÉEL avec synchronisation

      // 1. Hôte crée le lobby
      const wsHost = new WebSocket(
        `ws://localhost:${server.address().port}/ws`,
        {
          headers: { "x-user-id": testUser1.id },
        }
      );

      let lobbyId: string;

      // Créer le lobby
      await new Promise<void>((resolve, reject) => {
        wsHost.on("open", () => {
          setTimeout(() => {
            wsHost.send(
              JSON.stringify({
                type: "create_lobby",
                payload: {
                  name: "Multi-Player Test",
                  settings: {
                    selectedRegions: ["Europe"],
                    gameMode: "quiz",
                    maxPlayers: 4,
                  },
                },
              })
            );
          }, 500);
        });

        wsHost.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (response.type === "create_lobby_success") {
            lobbyId = response.data.lobbyId;
            resolve();
          }
        });

        wsHost.on("error", reject);
        setTimeout(() => reject(new Error("Timeout création")), 5000);
      });

      // 2. Deuxième joueur rejoint
      const wsPlayer = new WebSocket(
        `ws://localhost:${server.address().port}/ws`,
        {
          headers: { "x-user-id": testUser2.id },
        }
      );

      try {
        await new Promise<void>((resolve, reject) => {
          let hostNotified = false;
          let playerJoined = false;

          // Hôte attend notification de nouveau joueur
          wsHost.on("message", (data) => {
            const response = JSON.parse(data.toString());
            if (
              response.type === "lobby_updated" &&
              response.data.players?.length === 2
            ) {
              hostNotified = true;
              // ✅ Validation côté hôte
              expect(response.data.players).toHaveLength(2);
              const playerIds = response.data.players.map((p: any) => p.id);
              expect(playerIds).toContain(testUser1.id);
              expect(playerIds).toContain(testUser2.id);

              if (playerJoined) resolve();
            }
          });

          wsPlayer.on("open", () => {
            setTimeout(() => {
              wsPlayer.send(
                JSON.stringify({
                  type: "join_lobby",
                  payload: { lobbyId },
                })
              );
            }, 500);
          });

          wsPlayer.on("message", async (data) => {
            const response = JSON.parse(data.toString());
            if (response.type === "join_lobby_success") {
              playerJoined = true;

              // ✅ Validation côté joueur
              expect(response.data.success).toBe(true);
              expect(response.data.lobbyId).toBe(lobbyId);
              expect(response.data.playerId).toBe(testUser2.id);

              // ✅ Validation base de données : joueur ajouté
              const lobbyInDB = await testUtils.findLobbyInDB(lobbyId);
              const players = await testUtils.getLobbyPlayers(lobbyId);
              expect(players).toHaveLength(2);
              expect(players.map((p) => p.userId)).toContain(testUser2.id);

              if (hostNotified) resolve();
            }
          });

          wsPlayer.on("error", reject);
          setTimeout(() => reject(new Error("Timeout jointure")), 8000);
        });
      } finally {
        wsHost.close();
        wsPlayer.close();
      }
    });
  });

  describe("🔄 Gestion des Déconnexions", () => {
    it("devrait mettre à jour le statut du joueur lors de la déconnexion", async () => {
      // ✅ Test de cycle de vie complet avec vérification base de données

      // 1. Créer lobby et ajouter joueur
      const testLobby = await testUtils.createTestLobby(
        "disconnect-test-lobby",
        testUser1.id
      );
      await testUtils.addPlayerToLobby(testLobby.id, testUser2.id);

      // 2. Connexion du joueur
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          setTimeout(() => {
            // ✅ Vérification avant déconnexion : joueur connecté
            testUtils
              .getPlayerStatus(testLobby.id, testUser2.id)
              .then((status) => {
                expect(status).toBe("joined");
                resolve();
              })
              .catch(reject);
          }, 1000);
        });

        ws.on("error", reject);
        setTimeout(() => reject(new Error("Timeout initial")), 3000);
      });

      // 3. Déconnexion brutale
      ws.terminate();

      // 4. Attendre la mise à jour asynchrone
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // ✅ Validation critique : statut mis à jour en base
      const statusAfterDisconnect = await testUtils.getPlayerStatus(
        testLobby.id,
        testUser2.id
      );
      expect(statusAfterDisconnect).toBe("disconnected");

      // ✅ Validation : lobby toujours existant pour permettre reconnexion
      const lobbyAfter = await testUtils.findLobbyInDB(testLobby.id);
      expect(lobbyAfter?.status).toBe("waiting"); // Pas fermé automatiquement
    });

    it("ne devrait pas affecter les lobbies en cours de partie lors de déconnexions", async () => {
      // ✅ Test de logique métier critique : protection des parties en cours

      // 1. Créer lobby en cours de partie
      const playingLobby = await testUtils.createTestLobby(
        "playing-lobby-test",
        testUser1.id
      );
      await testUtils.addPlayerToLobby(playingLobby.id, testUser2.id);
      await testUtils.updateLobbyStatus(playingLobby.id, "playing");

      // 2. Connexion et déconnexion du joueur
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      await new Promise<void>((resolve) => {
        ws.on("open", () => {
          setTimeout(() => {
            ws.terminate(); // Déconnexion brutale
            resolve();
          }, 1000);
        });
      });

      // 3. Attendre traitement asynchrone
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // ✅ Validation critique : lobby en cours pas affecté
      const lobbyAfter = await testUtils.findLobbyInDB(playingLobby.id);
      expect(lobbyAfter?.status).toBe("playing"); // Toujours en cours

      // ✅ Le joueur peut être marqué comme déconnecté mais la partie continue
      const playerStatus = await testUtils.getPlayerStatus(
        playingLobby.id,
        testUser2.id
      );
      // Le statut peut être "disconnected" mais la partie reste active
      expect(["playing", "disconnected"]).toContain(playerStatus);
    });
  });

  describe("🎯 Messages et Validation Métier", () => {
    it("devrait rejeter les actions non autorisées avec des messages d'erreur appropriés", async () => {
      // ✅ Test de sécurité et validation SANS mocks

      // 1. Créer un lobby avec un autre utilisateur comme hôte
      const hostLobby = await testUtils.createTestLobby(
        "security-test-lobby",
        testUser1.id
      );

      // 2. Utilisateur non-hôte essaie de démarrer la partie
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      try {
        await new Promise<void>((resolve, reject) => {
          ws.on("open", () => {
            setTimeout(() => {
              ws.send(
                JSON.stringify({
                  type: "start_game",
                  payload: { lobbyId: hostLobby.id },
                })
              );
            }, 500);
          });

          ws.on("message", (data) => {
            const response = JSON.parse(data.toString());

            if (response.type === "error") {
              // ✅ Validation sécurité : erreur d'autorisation
              expect(response.message).toContain("autorisé");
              expect(response.message).toContain("hôte");
              resolve();
            }

            if (response.type === "game_started") {
              reject(new Error("Action non autorisée acceptée"));
            }
          });

          ws.on("error", reject);
          setTimeout(() => reject(new Error("Timeout sécurité")), 5000);
        });

        // ✅ Vérification base de données : lobby pas affecté
        const lobbyAfter = await testUtils.findLobbyInDB(hostLobby.id);
        expect(lobbyAfter?.status).toBe("waiting"); // Pas démarré
      } finally {
        ws.close();
      }
    });

    it("devrait valider les données de progression de joueur en temps réel", async () => {
      // ✅ Test de validation métier critique avec persistence

      // 1. Créer et démarrer une partie
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      let lobbyId: string;

      try {
        // Créer lobby et ajouter joueur
        await new Promise<void>((resolve, reject) => {
          ws1.on("open", () => {
            setTimeout(() => {
              ws1.send(
                JSON.stringify({
                  type: "create_lobby",
                  payload: {
                    name: "Progress Test Lobby",
                    settings: {
                      selectedRegions: ["Europe"],
                      gameMode: "quiz",
                      maxPlayers: 2,
                    },
                  },
                })
              );
            }, 500);
          });

          ws1.on("message", (data) => {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              lobbyId = response.data.lobbyId;
              resolve();
            }
          });

          ws1.on("error", reject);
          setTimeout(() => reject(new Error("Timeout lobby creation")), 5000);
        });

        // Ajouter deuxième joueur
        await new Promise<void>((resolve, reject) => {
          ws2.on("open", () => {
            setTimeout(() => {
              ws2.send(
                JSON.stringify({
                  type: "join_lobby",
                  payload: { lobbyId },
                })
              );
            }, 500);
          });

          ws2.on("message", (data) => {
            const response = JSON.parse(data.toString());
            if (response.type === "join_lobby_success") {
              resolve();
            }
          });

          ws2.on("error", reject);
          setTimeout(() => reject(new Error("Timeout join")), 5000);
        });

        // Démarrer la partie
        await new Promise<void>((resolve, reject) => {
          ws1.on("message", (data) => {
            const response = JSON.parse(data.toString());
            if (response.type === "game_started") {
              resolve();
            }
          });

          ws1.send(
            JSON.stringify({
              type: "start_game",
              payload: { lobbyId },
            })
          );

          setTimeout(() => reject(new Error("Timeout start game")), 5000);
        });

        // ✅ Test de progression réelle
        await new Promise<void>((resolve, reject) => {
          ws1.on("message", async (data) => {
            const response = JSON.parse(data.toString());
            if (response.type === "player_progress_updated") {
              // ✅ Validation données progression
              expect(response.data.playerId).toBe(testUser1.id);
              expect(response.data.score).toBe(150);
              expect(response.data.progress).toBe(30); // (3/10) * 100

              // ✅ Validation base de données
              const playerData = await testUtils.getPlayerGameData(
                lobbyId,
                testUser1.id
              );
              expect(playerData?.score).toBe(150);
              expect(playerData?.progress).toBe(30);
              expect(playerData?.validatedCountries).toEqual([
                "France",
                "Germany",
                "Spain",
              ]);

              resolve();
            }
          });

          // Envoyer progression réelle
          ws1.send(
            JSON.stringify({
              type: "update_player_progress",
              payload: {
                lobbyId,
                validatedCountries: ["France", "Germany", "Spain"],
                incorrectCountries: [],
                score: 150,
                totalQuestions: 10,
              },
            })
          );

          setTimeout(() => reject(new Error("Timeout progress")), 5000);
        });
      } finally {
        ws1.close();
        ws2.close();
      }
    });
  });
});

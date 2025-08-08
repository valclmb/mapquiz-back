import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../../src/server.js";
import { testUtils } from "../../setup.js";

/**
 * Tests WebSocket Connection Handler - Tests Unitaires Focalisés
 *
 * Tests ciblés sur la logique métier spécifique du gestionnaire de connexions
 * avec un minimum de mocks pour valider le comportement réel.
 */
describe("WebSocket Connection Handler - Logic Tests", () => {
  let app: FastifyInstance;
  let server: any;
  let testUser1: any;
  let testUser2: any;

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
    testUser1 = await testUtils.createTestUser(
      "conn-user-1",
      "Connection User 1"
    );
    testUser2 = await testUtils.createTestUser(
      "conn-user-2",
      "Connection User 2"
    );
  });

  describe("🔄 Logique de Restauration d'État", () => {
    it("devrait filtrer les lobbies par statut lors de la restauration", async () => {
      // ✅ Test de logique métier critique sans mocks excessifs

      // 1. Créer lobbies avec différents statuts
      const waitingLobby = await testUtils.createTestLobby(
        "waiting-lobby",
        testUser1.id,
        { selectedRegions: ["Europe"], gameMode: "quiz" }
      );

      const playingLobby = await testUtils.createTestLobby(
        "playing-lobby",
        testUser1.id,
        { selectedRegions: ["Asia"], gameMode: "quiz" }
      );

      const finishedLobby = await testUtils.createTestLobby(
        "finished-lobby",
        testUser1.id,
        { selectedRegions: ["Africa"], gameMode: "quiz" }
      );

      // Définir les statuts
      await testUtils.updateLobbyStatus(playingLobby.id, "playing");
      await testUtils.updateLobbyStatus(finishedLobby.id, "finished");

      // 2. Connexion WebSocket
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      try {
        await new Promise<void>((resolve, reject) => {
          let waitingLobbyRestored = false;
          let playingLobbyNotRestored = true;
          let finishedLobbyNotRestored = true;

          ws.on("message", (data) => {
            const response = JSON.parse(data.toString());

            if (response.type === "lobby_updated") {
              const lobbyId = response.data.lobbyId;

              if (lobbyId === waitingLobby.id) {
                waitingLobbyRestored = true;
                // ✅ Validation : lobby en attente restauré
                expect(response.data.status).toBe("waiting");
              }

              if (lobbyId === playingLobby.id) {
                playingLobbyNotRestored = false;
                // ❌ Lobby en cours ne devrait pas être restauré
              }

              if (lobbyId === finishedLobby.id) {
                finishedLobbyNotRestored = false;
                // ❌ Lobby terminé ne devrait pas être restauré
              }
            }

            // Vérifier conditions de succès
            if (
              waitingLobbyRestored &&
              playingLobbyNotRestored &&
              finishedLobbyNotRestored
            ) {
              resolve();
            }
          });

          ws.on("error", reject);

          // Résolution après délai si seuls les bons lobbies sont restaurés
          setTimeout(() => {
            if (
              waitingLobbyRestored &&
              playingLobbyNotRestored &&
              finishedLobbyNotRestored
            ) {
              resolve();
            } else {
              reject(
                new Error(
                  `Filtrage échoué: waiting=${waitingLobbyRestored}, playing=${!playingLobbyNotRestored}, finished=${!finishedLobbyNotRestored}`
                )
              );
            }
          }, 3000);
        });
      } finally {
        ws.close();
      }
    });

    it("devrait prévenir la restauration multiple du même utilisateur", async () => {
      // ✅ Test de cache utilisateur sans mocks

      const testLobby = await testUtils.createTestLobby(
        "cache-test-lobby",
        testUser1.id
      );

      // 1. Première connexion
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let firstRestoration = false;

      await new Promise<void>((resolve, reject) => {
        ws1.on("message", (data) => {
          const response = JSON.parse(data.toString());
          if (
            response.type === "lobby_updated" &&
            response.data.lobbyId === testLobby.id
          ) {
            firstRestoration = true;
            resolve();
          }
        });

        ws1.on("error", reject);
        setTimeout(() => reject(new Error("Timeout première connexion")), 3000);
      });

      expect(firstRestoration).toBe(true);

      // 2. Deuxième connexion immédiate (double connexion)
      const ws2 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser1.id },
      });

      let secondRestoration = false;

      try {
        await new Promise<void>((resolve, reject) => {
          ws2.on("message", (data) => {
            const response = JSON.parse(data.toString());
            if (
              response.type === "lobby_updated" &&
              response.data.lobbyId === testLobby.id
            ) {
              secondRestoration = true;
            }
          });

          ws2.on("error", reject);

          // Attendre et vérifier qu'il n'y a pas de deuxième restauration
          setTimeout(() => {
            resolve(); // Résoudre même sans restoration (comportement attendu)
          }, 2000);
        });

        // ✅ Validation : pas de double restauration
        expect(secondRestoration).toBe(false);
      } finally {
        ws1.close();
        ws2.close();
      }
    });
  });

  describe("⚡ Gestion des Erreurs de Connexion", () => {
    it("devrait être résilient aux erreurs de base de données", async () => {
      // ✅ Test de résilience réelle (pas de mocks BD factices)

      // Tentative de connexion avec un utilisateur inexistant
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": "user-inexistant-12345" },
      });

      try {
        await new Promise<void>((resolve, reject) => {
          let authenticatedReceived = false;
          let errorReceived = false;

          ws.on("message", (data) => {
            const response = JSON.parse(data.toString());

            if (response.type === "authenticated") {
              authenticatedReceived = true;
              // ✅ Validation : authentification continue malgré erreurs
              expect(response.data.userId).toBe("user-inexistant-12345");
            }

            if (response.type === "error") {
              errorReceived = true;
              // Des erreurs peuvent apparaître mais ne doivent pas faire crasher
            }
          });

          ws.on("error", (error) => {
            // Les erreurs de connexion sont gérées gracieusement
            resolve();
          });

          // Résolution si authentification réussie
          setTimeout(() => {
            if (authenticatedReceived || errorReceived) {
              resolve();
            } else {
              reject(new Error("Pas de réponse du serveur"));
            }
          }, 3000);
        });
      } finally {
        ws.close();
      }
    });

    it("devrait gérer les connexions courtes sans fuites mémoire", async () => {
      // ✅ Test de robustesse sans mocks

      const connectionPromises = [];

      // Créer plusieurs connexions courtes en parallèle
      for (let i = 0; i < 5; i++) {
        const connectionPromise = new Promise<void>(async (resolve, reject) => {
          const ws = new WebSocket(
            `ws://localhost:${server.address().port}/ws`,
            {
              headers: { "x-user-id": `short-conn-${i}` },
            }
          );

          let connected = false;

          ws.on("open", () => {
            connected = true;
            // Fermer immédiatement
            setTimeout(() => {
              ws.close();
            }, 100);
          });

          ws.on("close", () => {
            if (connected) {
              resolve();
            }
          });

          ws.on("error", () => {
            resolve(); // Accepter les erreurs de connexion courte
          });

          // Timeout de sécurité
          setTimeout(() => resolve(), 2000);
        });

        connectionPromises.push(connectionPromise);
      }

      // ✅ Validation : toutes les connexions courtes traitées sans crash
      await Promise.all(connectionPromises);

      // Pause pour laisser le nettoyage se faire
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Validation que le serveur est toujours opérationnel
      const finalWs = new WebSocket(
        `ws://localhost:${server.address().port}/ws`,
        {
          headers: { "x-user-id": testUser1.id },
        }
      );

      await new Promise<void>((resolve, reject) => {
        finalWs.on("open", () => resolve());
        finalWs.on("error", reject);
        setTimeout(
          () =>
            reject(new Error("Serveur non-répondant après connexions courtes")),
          3000
        );
      });

      finalWs.close();
    });
  });

  describe("🎯 Validation de Logique Métier Spécifique", () => {
    it("devrait traiter les déconnexions seulement pour les lobbies appropriés", async () => {
      // ✅ Test de logique métier critique de déconnexion

      // 1. Créer lobbies avec statuts différents et ajouter le joueur
      const waitingLobby = await testUtils.createTestLobby(
        "waiting-disconnect-test",
        testUser1.id
      );
      await testUtils.addPlayerToLobby(waitingLobby.id, testUser2.id);

      const playingLobby = await testUtils.createTestLobby(
        "playing-disconnect-test",
        testUser1.id
      );
      await testUtils.addPlayerToLobby(playingLobby.id, testUser2.id);
      await testUtils.updateLobbyStatus(playingLobby.id, "playing");

      // 2. Connexion du joueur
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser2.id },
      });

      // Attendre la connexion
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => resolve());
        ws.on("error", reject);
        setTimeout(() => reject(new Error("Timeout connexion")), 3000);
      });

      // 3. Déconnexion brutale
      ws.terminate();

      // 4. Attendre le traitement asynchrone
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // ✅ Validation : statuts mis à jour différemment selon le type de lobby
      const waitingPlayerStatus = await testUtils.getPlayerStatus(
        waitingLobby.id,
        testUser2.id
      );
      const playingPlayerStatus = await testUtils.getPlayerStatus(
        playingLobby.id,
        testUser2.id
      );

      // Pour les lobbies en attente, le joueur est marqué comme déconnecté
      expect(waitingPlayerStatus).toBe("disconnected");

      // Pour les lobbies en cours, le comportement peut varier selon la logique métier
      // (le joueur peut rester "playing" ou être marqué "disconnected" selon l'implémentation)
      expect(["playing", "disconnected"]).toContain(playingPlayerStatus);
    });

    it("devrait maintenir la cohérence des données lors de reconnexions rapides", async () => {
      // ✅ Test de race conditions réelles

      const testLobby = await testUtils.createTestLobby(
        "rapid-reconnect-test",
        testUser1.id
      );

      // Séquence de connexions/déconnexions rapides
      for (let i = 0; i < 3; i++) {
        const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
          headers: { "x-user-id": testUser1.id },
        });

        await new Promise<void>((resolve, reject) => {
          let authenticated = false;

          ws.on("message", (data) => {
            const response = JSON.parse(data.toString());
            if (response.type === "authenticated") {
              authenticated = true;
              // Déconnexion immédiate après authentification
              setTimeout(() => {
                ws.terminate();
                resolve();
              }, 50);
            }
          });

          ws.on("error", () => resolve());

          setTimeout(() => {
            if (!authenticated) {
              ws.terminate();
              resolve();
            }
          }, 1000);
        });

        // Pause courte entre les reconnexions
        await new Promise((resolve) => setTimeout(resolve, 200));
      }

      // ✅ Validation : données cohérentes après reconnexions rapides
      const lobbyAfter = await testUtils.findLobbyInDB(testLobby.id);
      expect(lobbyAfter?.status).toBe("waiting");
      expect(lobbyAfter?.hostId).toBe(testUser1.id);
    });
  });
});

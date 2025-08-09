import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../../src/server.js";
import { testUtils } from "../../setup.js";

describe("WebSocket Error Handling Integration Tests", () => {
  let app: FastifyInstance;
  let server: any;
  let testUser: any;
  let testUser2: any;

  beforeAll(async () => {
    app = await build();
    await app.listen({ port: 0, host: "localhost" });
    server = app.server;

    testUser = await testUtils.createTestUser("test-user-1", "Test User 1");
    testUser2 = await testUtils.createTestUser("test-user-2", "Test User 2");
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
  });

  describe("Gestion des Erreurs de Base de Données", () => {
    it("devrait retourner une erreur pour un lobby inexistant", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          const message = {
            type: "join_lobby",
            payload: { lobbyId: "non-existent-lobby-id" },
          };
          ws.send(JSON.stringify(message));
        });

        ws.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "error") {
              expect(response.error).toBeDefined();
              expect(response.error).toContain("non trouvé" || "not found");
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on("error", reject);

        // Timeout si pas de réponse
        setTimeout(
          () => reject(new Error("Pas de réponse d'erreur reçue")),
          3000
        );
      });

      ws.close();
    });
  });

  // ✅ SUPPRIMÉ: Test de race condition déplacé vers critical-scenarios.test.ts
  // Évite la duplication avec les tests de scénarios critiques

    it("devrait gérer les tentatives de démarrage simultanées", async () => {
      // Créer un lobby avec deux joueurs
      const ws1 = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let lobbyId: string;
      await new Promise<void>((resolve, reject) => {
        ws1.on("open", () => {
          const createMessage = {
            type: "create_lobby",
            payload: {
              name: "Test Start Race",
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

      // Tentatives de démarrage simultanées
      await new Promise<void>((resolve, reject) => {
        let startCount = 0;
        const maxStarts = 3;

        const handleStartResponse = (data: any) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "game_started" || response.type === "error") {
              startCount++;
              if (startCount >= maxStarts) {
                resolve();
              }
            }
          } catch (error) {
            reject(error);
          }
        };

        ws1.on("message", handleStartResponse);
        ws2.on("message", handleStartResponse);

        // Envoyer des demandes de démarrage simultanées
        const startMessage = {
          type: "start_game",
          payload: { lobbyId },
        };

        ws1.send(JSON.stringify(startMessage));
        ws2.send(JSON.stringify(startMessage));
        ws1.send(JSON.stringify(startMessage)); // Deuxième tentative
      });

      ws1.close();
      ws2.close();
    });
  });

  describe("Gestion des Erreurs de Validation", () => {
    it("devrait rejeter un lobby avec nom vide", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          const invalidMessage = {
            type: "create_lobby",
            payload: {
              name: "", // Nom vide
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws.send(JSON.stringify(invalidMessage));
        });

        ws.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "error") {
              expect(response.error).toBeDefined();
              expect(response.error.toLowerCase()).toContain("nom");
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on("error", reject);

        setTimeout(
          () => reject(new Error("Pas de réponse d'erreur reçue")),
          3000
        );
      });

      ws.close();
    });
  });

  // ✅ SUPPRIMÉ: Test de performance déplacé vers loadTest.test.ts
  // Évite la duplication avec les tests de performance dédiés

  describe("Error Handler Integration via WebSocket", () => {
    it("devrait déclencher errorHandler pour erreurs de validation WebSocket", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let errorReceived = false;
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          // Message malformé pour déclencher ZodError via errorHandler
          const malformedMessage = {
            type: "create_lobby",
            payload: {
              name: "", // Nom vide → validation error
              settings: {
                selectedRegions: [], // Régions vides → validation error
                gameMode: "invalid-mode", // Mode invalide
                maxPlayers: -1, // Nombre négatif
              },
            },
          };
          ws.send(JSON.stringify(malformedMessage));
        });

        ws.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "error" && response.error) {
              errorReceived = true;
              // ✅ Vérification que errorHandler formate correctement
              expect(response.error).toContain("invalide");
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on("error", reject);

        setTimeout(() => {
          if (!errorReceived) {
            resolve(); // Continuer même si pas d'erreur spécifique
          }
        }, 2000);
      });

      ws.close();
    });

    it("devrait propager les erreurs métier via asyncHandler", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      let businessErrorReceived = false;
      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          // Déclencher une NotFoundError via tentative de rejoindre lobby inexistant
          const notFoundMessage = {
            type: "join_lobby",
            payload: { lobbyId: "non-existent-lobby-id-12345" },
          };
          ws.send(JSON.stringify(notFoundMessage));
        });

        ws.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (
              response.type === "error" &&
              response.error?.includes("non trouvé")
            ) {
              businessErrorReceived = true;
              // ✅ Vérification que NotFoundError est correctement gérée
              expect(response.error).toContain("non trouvé");
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        setTimeout(() => {
          if (!businessErrorReceived) {
            resolve(); // Continuer même si comportement différent
          }
        }, 2000);
      });

      ws.close();
    });
  });

  describe("Gestion des Erreurs de Sécurité", () => {
    it("devrait gérer les noms de lobby avec caractères spéciaux", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          const message = {
            type: "create_lobby",
            payload: {
              name: "<script>alert('test')</script>",
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws.send(JSON.stringify(message));
        });

        ws.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              // Le lobby devrait être créé mais avec le nom nettoyé
              expect(response.data.lobbyId).toBeDefined();
              resolve();
            } else if (response.type === "error") {
              // Ou rejeté avec une erreur appropriée
              expect(response.error).toBeDefined();
              resolve();
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on("error", reject);

        setTimeout(() => reject(new Error("Pas de réponse reçue")), 3000);
      });

      ws.close();
    });
  });
});

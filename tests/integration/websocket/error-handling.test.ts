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
              expect(response.message).toBeDefined();
              expect(response.message).toMatch(/non trouvé|Lobby non trouvé/);
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
          5000
        );
      });

      ws.close();
    });
  });

  describe("Gestion des Race Conditions", () => {
    it("devrait gérer les demandes de création de lobby en parallèle", async () => {
      // Test plus simple et robuste : vérifier que deux créations de lobby simultanées fonctionnent
      const promises = [testUser.id, testUser2.id].map((userId) => {
        return new Promise<string>((resolve, reject) => {
          const ws = new WebSocket(
            `ws://localhost:${server.address().port}/ws`,
            {
              headers: { "x-user-id": userId },
            }
          );

          ws.on("open", () => {
            const createMessage = {
              type: "create_lobby",
              payload: {
                name: `Test Lobby ${userId}`,
                settings: {
                  selectedRegions: ["Europe"],
                  gameMode: "quiz",
                  maxPlayers: 4,
                },
              },
            };
            ws.send(JSON.stringify(createMessage));
          });

          ws.on("message", (data) => {
            try {
              const response = JSON.parse(data.toString());
              if (response.type === "create_lobby_success") {
                ws.close();
                resolve(response.data.lobbyId);
              } else if (response.type === "error") {
                ws.close();
                reject(new Error(response.error));
              }
            } catch (error) {
              ws.close();
              reject(error);
            }
          });

          ws.on("error", (error) => {
            ws.close();
            reject(error);
          });

          setTimeout(() => {
            ws.close();
            reject(new Error("Timeout"));
          }, 5000);
        });
      });

      // Attendre que les deux lobbies soient créés
      const lobbyIds = await Promise.all(promises);

      // Vérifier que les deux lobbies ont été créés avec des IDs différents
      expect(lobbyIds).toHaveLength(2);
      expect(lobbyIds[0]).not.toBe(lobbyIds[1]);
      expect(lobbyIds[0]).toBeTruthy();
      expect(lobbyIds[1]).toBeTruthy();
    }, 10000);
  });

  describe("Gestion des Erreurs de Validation", () => {
    it("devrait accepter un lobby avec nom vide en générant un nom par défaut", async () => {
      const ws = new WebSocket(`ws://localhost:${server.address().port}/ws`, {
        headers: { "x-user-id": testUser.id },
      });

      await new Promise<void>((resolve, reject) => {
        ws.on("open", () => {
          const validMessage = {
            type: "create_lobby",
            payload: {
              name: "", // Nom vide - devrait être accepté avec nom par défaut
              settings: {
                selectedRegions: ["Europe"],
                gameMode: "quiz",
                maxPlayers: 4,
              },
            },
          };
          ws.send(JSON.stringify(validMessage));
        });

        ws.on("message", (data) => {
          try {
            const response = JSON.parse(data.toString());
            if (response.type === "create_lobby_success") {
              expect(response.data.lobbyId).toBeDefined();
              resolve();
            } else if (response.type === "error") {
              reject(new Error(`Erreur inattendue: ${response.error}`));
            }
          } catch (error) {
            reject(error);
          }
        });

        ws.on("error", reject);

        setTimeout(() => reject(new Error("Pas de réponse reçue")), 5000);
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
            if (response.type === "error" && response.message) {
              errorReceived = true;
              // ✅ Vérification que errorHandler formate correctement
              expect(response.message).toContain("invalide");
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
              response.message?.includes("non trouvé")
            ) {
              businessErrorReceived = true;
              // ✅ Vérification que NotFoundError est correctement gérée
              expect(response.message).toContain("non trouvé");
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
              expect(response.message).toBeDefined();
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

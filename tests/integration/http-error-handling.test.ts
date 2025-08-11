import { FastifyInstance } from "fastify";
import { build } from "../../src/server.js";
import { testUtils } from "../setup.js";

describe("HTTP Error Handling Integration Tests", () => {
  let app: FastifyInstance;
  let testUser: any;

  beforeAll(async () => {
    app = await build();
    await app.listen({ port: 0, host: "localhost" });
    testUser = await testUtils.createTestUser("test-user-1", "Test User 1");
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await testUtils.cleanDatabase();
    testUser = await testUtils.createTestUser("test-user-1", "Test User 1");
  });

  describe("Validation Errors (400)", () => {
    it("devrait rejeter les requêtes avec données JSON invalides", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/scores",
        headers: {
          authorization: `Bearer ${testUser.id}`,
          "content-type": "application/json",
        },
        payload: "{ invalid json syntax", // JSON malformé
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });
  });

  describe("Not Found Errors (404)", () => {
    it("devrait retourner 404 pour route inexistante", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/non-existent-endpoint",
      });

      expect(response.statusCode).toBe(404);
    });

    it("devrait retourner les scores d'un utilisateur authentifié ou tableau vide", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/scores/history",
        headers: {
          "x-user-id": testUser.id,
        },
      });

      // Test spécifique : utilisateur authentifié doit recevoir ses scores (même si vide)
      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(Array.isArray(body) || body.scores).toBeTruthy();
    });

    it("devrait gérer les endpoints malformés", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api///malformed//path",
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe("Error Handler Integration", () => {
    it("devrait gérer les erreurs d'authentification", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/scores/history", // Route nécessitant auth
        headers: {
          authorization: "Bearer invalid-token",
        },
      });

      // ✅ Test réaliste : erreur d'auth
      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
    });

    it("devrait maintenir la cohérence des réponses sur requêtes parallèles", async () => {
      // Déclencher plusieurs requêtes simultanées pour tester la robustesse
      const promises = Array.from({ length: 10 }, () =>
        app.inject({
          method: "GET",
          url: "/api/scores/history",
          headers: {
            "x-user-id": testUser.id,
          },
        })
      );

      const responses = await Promise.all(promises);

      // Toutes les réponses doivent être cohérentes (même utilisateur = même résultat)
      const statuses = responses.map((r) => r.statusCode);
      const firstStatus = statuses[0];

      expect(statuses.every((status) => status === firstStatus)).toBe(true);
      expect(firstStatus).toBe(200); // Utilisateur authentifié valide
    });
  });

  describe("Security Error Handling", () => {
    it("devrait rejeter les tokens d'authentification malformés", async () => {
      const response = await app.inject({
        method: "GET",
        url: "/api/scores/history",
        headers: {
          authorization: "Bearer <script>alert('xss')</script>",
        },
      });

      // Token malformé doit être rejeté avec 401
      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      // Vérification que les scripts ne sont pas reflétés dans la réponse
      expect(JSON.stringify(body)).not.toContain("<script>");
    });
  });

  describe("Production vs Development Error Handling", () => {
    it("devrait maintenir la performance malgré les erreurs fréquentes", async () => {
      const startTime = Date.now();

      // Générer plusieurs erreurs rapidement pour tester errorHandler
      const errorPromises = Array.from({ length: 20 }, () =>
        app.inject({
          method: "GET",
          url: "/api/non-existent-endpoint",
        })
      );

      await Promise.all(errorPromises);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // ✅ Le traitement des erreurs ne doit pas être trop lent
      expect(duration).toBeLessThan(3000); // < 3 secondes pour 20 erreurs
    });

    it("devrait traiter les erreurs d'authentification de manière cohérente", async () => {
      const response = await app.inject({
        method: "POST",
        url: "/api/scores",
        headers: {
          authorization: "Bearer invalid-token",
        },
        payload: {
          score: 100,
          totalQuestions: 10,
          selectedRegions: ["Europe"],
          gameMode: "quiz",
        },
      });

      // Token invalide doit toujours donner 401
      expect(response.statusCode).toBe(401);

      const body = JSON.parse(response.body);
      expect(body.error).toBeDefined();
      expect(body.error).toContain("autorisé"); // Message en français cohérent
    });
  });
});

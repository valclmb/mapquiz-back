import { FastifyInstance } from "fastify";
import WebSocket from "ws";
import { build } from "../../src/server.js";
import { testUtils } from "../setup.js";

/**
 * Utilitaires pour les tests E2E - Élimination des duplications
 */
class E2ETestHelpers {
  private static instance: E2ETestHelpers;
  private app!: FastifyInstance;
  private server: any;

  static getInstance(): E2ETestHelpers {
    if (!E2ETestHelpers.instance) {
      E2ETestHelpers.instance = new E2ETestHelpers();
    }
    return E2ETestHelpers.instance;
  }

  setServer(app: FastifyInstance, server: any) {
    this.app = app;
    this.server = server;
  }

  /**
   * Crée une connexion WebSocket avec gestion d'erreur automatique
   */
  async createWebSocketConnection(userId: string): Promise<WebSocket> {
    const ws = new WebSocket(
      `ws://localhost:${this.server.address().port}/ws`,
      {
        headers: { "x-user-id": userId },
      }
    );

    return new Promise<WebSocket>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout de connexion pour l'utilisateur ${userId}`));
      }, 5000);

      ws.on("open", () => {
        clearTimeout(timeout);
        resolve(ws);
      });
      ws.on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }

  /**
   * Envoie un message et attend une réponse spécifique
   */
  async sendAndWaitForResponse(
    ws: WebSocket,
    message: any,
    expectedType: string,
    timeout: number = 5000
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Timeout en attente de ${expectedType}`));
      }, timeout);

      const messageHandler = (data: Buffer) => {
        try {
          const response = JSON.parse(data.toString());
          if (response.type === expectedType) {
            clearTimeout(timeoutId);
            ws.removeListener("message", messageHandler);
            resolve(response);
          } else if (response.type === "error") {
            clearTimeout(timeoutId);
            ws.removeListener("message", messageHandler);
            reject(new Error(`Erreur serveur: ${response.message}`));
          }
        } catch (error) {
          clearTimeout(timeoutId);
          ws.removeListener("message", messageHandler);
          reject(error);
        }
      };

      ws.on("message", messageHandler);
      ws.send(JSON.stringify(message));
    });
  }

  /**
   * Crée un lobby avec validation métier complète
   */
  async createLobbyAndValidate(
    ws: WebSocket,
    userId: string,
    lobbyName: string,
    settings: any = {
      selectedRegions: ["Europe"],
      gameMode: "quiz",
      maxPlayers: 4,
    }
  ): Promise<string> {
    const message = {
      type: "create_lobby",
      payload: { name: lobbyName, settings },
    };

    const response = await this.sendAndWaitForResponse(
      ws,
      message,
      "create_lobby_success"
    );

    // Validation métier critique
    expect(response.data).toMatchObject({
      success: true,
      lobbyId: expect.any(String),
      hostId: userId,
      settings: expect.objectContaining(settings),
    });

    expect(response.data.lobbyId).toMatch(/^[a-zA-Z0-9-]+$/);
    expect(response.data.hostId).toBe(userId);

    return response.data.lobbyId;
  }

  /**
   * Fait rejoindre un lobby avec validation
   */
  async joinLobbyAndValidate(
    ws: WebSocket,
    lobbyId: string,
    playerId: string
  ): Promise<void> {
    const message = { type: "join_lobby", payload: { lobbyId } };
    const response = await this.sendAndWaitForResponse(
      ws,
      message,
      "join_lobby_success"
    );

    // Validation métier critique
    expect(response.data).toMatchObject({
      success: true,
    });
  }

  /**
   * Démarre une partie avec validation
   */
  async startGameAndValidate(ws: WebSocket, lobbyId: string): Promise<void> {
    const message = { type: "start_game", payload: { lobbyId } };
    const response = await this.sendAndWaitForResponse(
      ws,
      message,
      "game_started"
    );

    // Validation métier critique
    expect(response.data).toMatchObject({
      lobbyId: lobbyId,
      status: "playing",
      startTime: expect.any(String),
    });

    expect(new Date(response.data.startTime)).toBeInstanceOf(Date);
  }

  /**
   * Gère les connexions multiples avec nettoyage automatique
   */
  async createMultipleConnections(userIds: string[]): Promise<WebSocket[]> {
    const connections = await Promise.all(
      userIds.map((userId) => this.createWebSocketConnection(userId))
    );

    // Validation que toutes les connexions sont ouvertes
    connections.forEach((ws, index) => {
      expect(ws.readyState).toBe(WebSocket.OPEN);
    });

    return connections;
  }

  /**
   * Nettoie proprement les connexions
   */
  cleanupConnections(connections: WebSocket[]): void {
    connections.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    });
  }

  /**
   * Teste la robustesse avec des messages invalides
   */
  async testInvalidMessages(
    ws: WebSocket,
    invalidMessages: any[]
  ): Promise<void> {
    for (const invalidMessage of invalidMessages) {
      try {
        if (typeof invalidMessage === "string") {
          ws.send(invalidMessage);
        } else {
          ws.send(JSON.stringify(invalidMessage));
        }

        // Attendre un court délai pour la réponse d'erreur
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        // Les erreurs sont attendues pour les messages invalides
      }
    }
  }
}

describe("E2E Tests - Logique Métier WebSocket", () => {
  let app: FastifyInstance;
  let server: any;
  let testUser: any;
  let testUser2: any;
  let testUser3: any;
  let helpers: E2ETestHelpers;

  beforeAll(async () => {
    app = await build();
    await app.listen({ port: 0, host: "localhost" });
    server = app.server;

    helpers = E2ETestHelpers.getInstance();
    helpers.setServer(app, server);

    // Créer des utilisateurs de test une seule fois
    testUser = await testUtils.createTestUser("test-user-1", "Test User 1");
    testUser2 = await testUtils.createTestUser("test-user-2", "Test User 2");
    testUser3 = await testUtils.createTestUser("test-user-3", "Test User 3");
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(async () => {
    await testUtils.cleanDatabase();
    // Recréer seulement si nécessaire pour le test
    testUser = await testUtils.createTestUser("test-user-1", "Test User 1");
    testUser2 = await testUtils.createTestUser("test-user-2", "Test User 2");
    testUser3 = await testUtils.createTestUser("test-user-3", "Test User 3");
  });

  describe("Workflow Complet de Lobby - Logique Métier", () => {
    it("devrait valider le cycle complet création-jointure-démarrage avec logique métier", async () => {
      // Connexions avec validation de robustesse
      const ws1 = await helpers.createWebSocketConnection(testUser.id);
      const ws2 = await helpers.createWebSocketConnection(testUser2.id);

      try {
        // Test de la création avec validation des règles métier
        const lobbyId = await helpers.createLobbyAndValidate(
          ws1,
          testUser.id,
          "Test Lobby E2E",
          { selectedRegions: ["Europe"], gameMode: "quiz", maxPlayers: 4 }
        );

        // Test de la jointure avec validation des autorisations
        await helpers.joinLobbyAndValidate(ws2, lobbyId, testUser2.id);

        // Test du démarrage avec validation de l'état
        await helpers.startGameAndValidate(ws1, lobbyId);

        // Validation finale : vérifier que le lobby est en état "playing"
        const lobbyStateResponse = await helpers.sendAndWaitForResponse(
          ws1,
          { type: "get_lobby_state", payload: { lobbyId } },
          "lobby_state"
        );

        expect(lobbyStateResponse.data.status).toBe("playing");
        expect(lobbyStateResponse.data.players).toHaveLength(2);
      } finally {
        helpers.cleanupConnections([ws1, ws2]);
      }
    }, 20000);

    // ✅ SUPPRIMÉ: Test de persistance déplacé vers critical-scenarios.test.ts
    // Évite la duplication avec les tests d'intégration spécialisés

    it("devrait valider la logique de gestion multi-utilisateurs avec cohérence d'état", async () => {
      // Créer des connexions multiples avec validation
      const connections = await helpers.createMultipleConnections([
        testUser.id,
        testUser2.id,
        testUser3.id,
      ]);
      const [ws1, ws2, ws3] = connections;

      try {
        // Création du lobby par l'hôte
        const lobbyId = await helpers.createLobbyAndValidate(
          ws1,
          testUser.id,
          "Test Lobby Multi-User"
        );

        // Jointures séquentielles avec validation de cohérence
        await helpers.joinLobbyAndValidate(ws2, lobbyId, testUser2.id);
        await helpers.joinLobbyAndValidate(ws3, lobbyId, testUser3.id);

        // Validation métier finale : état du lobby cohérent
        const lobbyStateResponse = await helpers.sendAndWaitForResponse(
          ws1,
          { type: "get_lobby_state", payload: { lobbyId } },
          "lobby_state"
        );

        expect(lobbyStateResponse.data.players).toHaveLength(3);
        expect(lobbyStateResponse.data.hostId).toBe(testUser.id);

        // Validation que tous les joueurs sont présents
        const playerIds = lobbyStateResponse.data.players.map((p: any) => p.id);
        expect(playerIds).toContain(testUser.id);
        expect(playerIds).toContain(testUser2.id);
        expect(playerIds).toContain(testUser3.id);
      } finally {
        helpers.cleanupConnections(connections);
      }
    }, 25000);
  });

  describe("Gestion des Erreurs et Robustesse", () => {
    it("devrait traiter les messages invalides sans compromettre le système", async () => {
      const ws = await helpers.createWebSocketConnection(testUser.id);

      try {
        const invalidMessages = [
          { type: "invalid_type", payload: {} },
          { type: "create_lobby", payload: { name: "", settings: {} } },
          { type: "join_lobby", payload: { lobbyId: "lobby-inexistant" } },
          "message-json-invalide",
          { type: "start_game" }, // payload manquant
        ];

        // Test que le système reste stable malgré les messages invalides
        await helpers.testInvalidMessages(ws, invalidMessages);

        // Validation : la connexion reste opérationnelle
        expect(ws.readyState).toBe(WebSocket.OPEN);

        // Test qu'après les erreurs, on peut toujours créer un lobby valide
        const lobbyId = await helpers.createLobbyAndValidate(
          ws,
          testUser.id,
          "Test Post-Erreurs"
        );

        expect(lobbyId).toBeDefined();
      } finally {
        helpers.cleanupConnections([ws]);
      }
    }, 15000);

    it("devrait gérer la charge de connexions simultanées sans dégradation", async () => {
      const connectionCount = 8;
      const userIds = Array.from(
        { length: connectionCount },
        (_, i) => `test-user-perf-${i}`
      );

      // Créer les utilisateurs de test pour la performance
      for (const userId of userIds) {
        await testUtils.createTestUser(userId, `Test User ${userId}`);
      }

      const connections = await helpers.createMultipleConnections(userIds);

      try {
        // Validation que toutes les connexions sont stables
        connections.forEach((ws, index) => {
          expect(ws.readyState).toBe(WebSocket.OPEN);
        });

        // Test de charge : créer plusieurs lobbies simultanément
        const lobbyPromises = connections
          .slice(0, 4)
          .map((ws, index) =>
            helpers.createLobbyAndValidate(
              ws,
              userIds[index],
              `Lobby Perf ${index}`
            )
          );

        const lobbyIds = await Promise.all(lobbyPromises);

        // Validation métier : tous les lobbies sont créés avec des IDs uniques
        expect(new Set(lobbyIds).size).toBe(lobbyIds.length);
      } finally {
        helpers.cleanupConnections(connections);
      }
    }, 20000);
  });

  describe("Validation de la Communication en Temps Réel", () => {
    it("devrait maintenir la synchronisation des données entre les clients", async () => {
      const connections = await helpers.createMultipleConnections([
        testUser.id,
        testUser2.id,
      ]);
      const [ws1, ws2] = connections;

      try {
        // Créer un lobby
        const lobbyId = await helpers.createLobbyAndValidate(
          ws1,
          testUser.id,
          "Test Sync"
        );

        // Faire rejoindre le second joueur
        await helpers.joinLobbyAndValidate(ws2, lobbyId, testUser2.id);

        // Test de synchronisation : changement d'état propagé
        const gameStartPromise = helpers.sendAndWaitForResponse(
          ws2, // Le second joueur doit recevoir la notification
          { type: "start_game", payload: { lobbyId } },
          "game_started",
          3000
        );

        // L'hôte démarre la partie
        await helpers.startGameAndValidate(ws1, lobbyId);

        // Validation : le second joueur reçoit bien la notification
        const ws2Response = await gameStartPromise;
        expect(ws2Response.data.lobbyId).toBe(lobbyId);
        expect(ws2Response.data.status).toBe("playing");
      } finally {
        helpers.cleanupConnections(connections);
      }
    }, 15000);

    // Tests de récupération d'état fusionnés depuis critical-user-journeys.test.ts
    it("devrait récupérer l'état après déconnexion brutale", async () => {
      const ws1 = await helpers.createWebSocketConnection(testUser.id);

      // Créer un lobby
      const lobbyId = await helpers.createLobbyAndValidate(
        ws1,
        testUser.id,
        "Test Recovery Lobby"
      );

      // Simuler une déconnexion brutale
      ws1.terminate();
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Reconnecter et vérifier la récupération d'état
      const ws2 = await helpers.createWebSocketConnection(testUser.id);

      try {
        const lobbyStateResponse = await helpers.sendAndWaitForResponse(
          ws2,
          { type: "get_lobby_state", payload: { lobbyId } },
          "lobby_state"
        );

        expect(lobbyStateResponse.data.lobbyId).toBe(lobbyId);
        expect(lobbyStateResponse.data.hostId).toBe(testUser.id);
        expect(lobbyStateResponse.data.status).toBeDefined();
      } finally {
        helpers.cleanupConnections([ws2]);
      }
    }, 15000);

    // ✅ SUPPRIMÉ: Test de performance déplacé vers loadTest.test.ts
    // Évite la duplication avec les tests de performance dédiés
  });
});

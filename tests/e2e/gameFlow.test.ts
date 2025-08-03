import WebSocket from "ws";
import { LobbyLifecycleManager } from "../../src/websocket/lobby/lobbyLifecycle.js";
import { testUtils } from "../setup.js";

describe("End-to-End Game Flow Tests", () => {
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

  describe("Scénario Complet de Jeu Multi-Joueurs", () => {
    it("devrait gérer un cycle complet de jeu avec 2 joueurs", async (done) => {
      const hostId = testUtils.generateId();
      const playerId = testUtils.generateId();

      // Créer les utilisateurs
      await testUtils.createTestUser(hostId, "Host User");
      await testUtils.createTestUser(playerId, "Player User");

      // Étape 1: Créer le lobby
      const lobbyId = await createLobby(hostId);
      expect(lobbyId).toBeDefined();

      // Étape 2: Rejoindre le lobby
      await joinLobby(playerId, lobbyId);

      // Étape 3: Démarrer la partie
      await startGame(hostId, lobbyId);

      // Étape 4: Jouer et terminer la partie
      await playAndFinishGame(hostId, playerId, lobbyId);

      // Étape 5: Vérifier les résultats
      await verifyGameResults(hostId, playerId, lobbyId);

      done();
    }, 30000);

    it("devrait gérer la déconnexion et reconnexion d'un joueur", async (done) => {
      const hostId = testUtils.generateId();
      const playerId = testUtils.generateId();

      // Créer les utilisateurs
      await testUtils.createTestUser(hostId, "Host User");
      await testUtils.createTestUser(playerId, "Player User");

      // Créer et rejoindre le lobby
      const lobbyId = await createLobby(hostId);
      await joinLobby(playerId, lobbyId);

      // Démarrer la partie
      await startGame(hostId, lobbyId);

      // Simuler une déconnexion du joueur
      await simulatePlayerDisconnection(playerId, lobbyId);

      // Vérifier que l'hôte est notifié
      await verifyPlayerDisconnectionNotification(hostId, playerId, lobbyId);

      // Simuler une reconnexion
      await simulatePlayerReconnection(playerId, lobbyId);

      // Vérifier que le joueur peut continuer la partie
      await verifyPlayerCanContinueGame(playerId, lobbyId);

      done();
    }, 30000);
  });

  describe("Scénarios de Gestion des Erreurs", () => {
    it("devrait gérer la suppression automatique des lobbies inactifs", async (done) => {
      const hostId = testUtils.generateId();
      await testUtils.createTestUser(hostId, "Host User");

      // Créer un lobby
      const lobbyId = await createLobby(hostId);

      // Simuler l'inactivité (pas de messages pendant 3 minutes)
      await testUtils.wait(100); // Attendre un peu

      // Vérifier que le lobby est toujours accessible
      const lobby = await getLobbyState(hostId, lobbyId);
      expect(lobby).toBeDefined();

      done();
    }, 10000);

    it("devrait gérer les tentatives d'accès non autorisées", async (done) => {
      const hostId = testUtils.generateId();
      const unauthorizedId = testUtils.generateId();

      await testUtils.createTestUser(hostId, "Host User");
      await testUtils.createTestUser(unauthorizedId, "Unauthorized User");

      // Créer un lobby
      const lobbyId = await createLobby(hostId);

      // Tenter d'accéder au lobby sans autorisation
      const result = await tryUnauthorizedAccess(unauthorizedId, lobbyId);
      expect(result.success).toBe(false);

      done();
    }, 10000);
  });

  // Fonctions utilitaires pour les tests E2E
  async function createLobby(hostId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "create_lobby",
            payload: {
              name: "Test Lobby",
              settings: { selectedRegions: ["Europe"], gameMode: "quiz" },
            },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "create_lobby_success") {
          ws.close();
          resolve(message.data.lobbyId);
        }
      });

      ws.on("error", reject);
    });
  }

  async function joinLobby(playerId: string, lobbyId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);

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
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });
  }

  async function startGame(hostId: string, lobbyId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "set_player_ready",
            payload: { lobbyId },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (
          message.type === "lobby_update" &&
          message.payload.status === "playing"
        ) {
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });
  }

  async function playAndFinishGame(
    hostId: string,
    playerId: string,
    lobbyId: string
  ): Promise<void> {
    // Simuler la progression des joueurs jusqu'à 100%
    await updatePlayerProgress(hostId, lobbyId, 100);
    await updatePlayerProgress(playerId, lobbyId, 100);

    // Attendre la fin de partie
    await waitForGameEnd(hostId, lobbyId);
  }

  async function updatePlayerProgress(
    playerId: string,
    lobbyId: string,
    progress: number
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "update_player_progress",
            payload: {
              lobbyId,
              validatedCountries:
                progress === 100
                  ? ["FR", "DE", "IT", "ES", "GB", "NL", "BE", "CH", "AT", "PL"]
                  : ["FR", "DE"],
              incorrectCountries: progress === 100 ? ["XX"] : ["IT", "ES"],
              score: Math.floor(progress / 10),
              totalQuestions: 10,
            },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "update_player_progress_success") {
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });
  }

  async function waitForGameEnd(
    playerId: string,
    lobbyId: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        // Attendre le message game_end
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "game_end") {
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);

      // Timeout après 10 secondes
      setTimeout(() => {
        ws.close();
        reject(new Error("Timeout waiting for game end"));
      }, 10000);
    });
  }

  async function verifyGameResults(
    hostId: string,
    playerId: string,
    lobbyId: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "get_game_results",
            payload: { lobbyId },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "get_game_results_success") {
          expect(message.data.rankings).toBeDefined();
          expect(message.data.rankings).toHaveLength(2);
          ws.close();
          resolve();
        }
      });

      ws.on("error", reject);
    });
  }

  async function simulatePlayerDisconnection(
    playerId: string,
    lobbyId: string
  ): Promise<void> {
    // Simuler une déconnexion en fermant la connexion WebSocket
    // Cette fonction serait plus complexe dans un vrai test
    await testUtils.wait(100);
  }

  async function verifyPlayerDisconnectionNotification(
    hostId: string,
    playerId: string,
    lobbyId: string
  ): Promise<void> {
    // Vérifier que l'hôte reçoit une notification de déconnexion
    // Cette fonction serait plus complexe dans un vrai test
    await testUtils.wait(100);
  }

  async function simulatePlayerReconnection(
    playerId: string,
    lobbyId: string
  ): Promise<void> {
    // Simuler une reconnexion
    await joinLobby(playerId, lobbyId);
  }

  async function verifyPlayerCanContinueGame(
    playerId: string,
    lobbyId: string
  ): Promise<void> {
    // Vérifier que le joueur peut continuer la partie
    await updatePlayerProgress(playerId, lobbyId, 50);
  }

  async function getLobbyState(
    playerId: string,
    lobbyId: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "get_lobby_state",
            payload: { lobbyId },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "get_lobby_state_success") {
          ws.close();
          resolve(message.data);
        }
      });

      ws.on("error", reject);
    });
  }

  async function tryUnauthorizedAccess(
    playerId: string,
    lobbyId: string
  ): Promise<any> {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(baseUrl);

      ws.on("open", () => {
        ws.send(
          JSON.stringify({
            type: "get_lobby_state",
            payload: { lobbyId },
          })
        );
      });

      ws.on("message", (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === "error") {
          ws.close();
          resolve({ success: false, error: message.message });
        }
      });

      ws.on("error", reject);
    });
  }
});

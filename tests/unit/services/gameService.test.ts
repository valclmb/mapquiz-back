import { GameService } from "../../../src/services/gameService";
import { LobbyLifecycleManager } from "../../../src/websocket/lobby/lobbyLifecycle";
import { testUtils } from "../../setup";

describe("GameService", () => {
  beforeEach(() => {
    // Nettoyer les lobbies en mémoire avant chaque test
    const activeLobbies = LobbyLifecycleManager.getAllActiveLobbies();
    activeLobbies.clear();
  });

  describe("startGame", () => {
    it("devrait démarrer une partie avec succès", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer l'utilisateur et le lobby
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      const result = await GameService.startGame(lobbyId);

      expect(result).toBe(true);

      // Vérifier que le lobby est en mode "playing"
      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(lobby?.status).toBe("playing");
    });

    it("devrait échouer si le lobby n'existe pas en mémoire", async () => {
      const lobbyId = "non-existent-lobby";

      await expect(GameService.startGame(lobbyId)).rejects.toThrow();
    });

    it("devrait échouer si le lobby n'existe pas en base de données", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer seulement en mémoire, pas en DB
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      await expect(GameService.startGame(lobbyId)).rejects.toThrow();
    });
  });

  describe("updatePlayerScore", () => {
    it("devrait mettre à jour le score d'un joueur", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      const result = await GameService.updatePlayerScore(
        lobbyId,
        hostId,
        15,
        75
      );

      expect(result).toBe(true);
    });

    it("devrait déclencher checkGameCompletion si progress >= 100", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      const result = await GameService.updatePlayerScore(
        lobbyId,
        hostId,
        15,
        100
      );

      expect(result).toBe(true);

      // Vérifier que le joueur est marqué comme "finished"
      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      const player = lobby?.players.get(hostId);
      expect(player?.status).toBe("finished");
    });
  });

  describe("updatePlayerProgress", () => {
    it("devrait mettre à jour la progression d'un joueur", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      const result = await GameService.updatePlayerProgress(
        lobbyId,
        hostId,
        ["FR", "DE"],
        ["IT", "ES"],
        15,
        20
      );

      expect(result).toBe(true);
    });

    it("devrait déclencher checkGameCompletion si progress >= 100", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });

      const result = await GameService.updatePlayerProgress(
        lobbyId,
        hostId,
        ["FR", "DE", "IT", "ES", "GB", "NL", "BE", "CH", "AT", "PL"],
        ["XX"],
        15,
        10
      );

      expect(result).toBe(true);

      // Vérifier que le joueur est marqué comme "finished"
      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      const player = lobby?.players.get(hostId);
      expect(player?.status).toBe("finished");
    });
  });

  describe("restartLobby", () => {
    it("devrait redémarrer un lobby avec succès", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire avec un statut "finished"
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });
      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      if (lobby) {
        lobby.status = "finished";
      }

      const result = await GameService.restartLobby(lobbyId);

      expect(result).toBe(true);

      // Vérifier que le lobby est revenu en mode "waiting"
      const updatedLobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(updatedLobby?.status).toBe("waiting");
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const lobbyId = "non-existent-lobby";

      const result = await GameService.restartLobby(lobbyId);

      expect(result).toBe(false);
    });
  });

  describe("checkGameCompletion", () => {
    it("devrait terminer la partie si tous les joueurs sont finished", async () => {
      const hostId = testUtils.generateId();
      const playerId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestUser(playerId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire avec deux joueurs
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });
      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      if (lobby) {
        lobby.players.set(playerId, {
          status: "joined",
          score: 0,
          progress: 0,
          name: "Test Player",
          validatedCountries: [],
          incorrectCountries: [],
        });
        lobby.status = "playing";
      }

      // Marquer les deux joueurs comme finished
      await GameService.updatePlayerProgress(
        lobbyId,
        hostId,
        ["FR", "DE", "IT", "ES", "GB", "NL", "BE", "CH", "AT", "PL"],
        ["XX"],
        15,
        10
      );

      await GameService.updatePlayerProgress(
        lobbyId,
        playerId,
        ["FR", "DE", "IT", "ES", "GB", "NL", "BE", "CH", "AT", "PL"],
        ["XX"],
        12,
        10
      );

      // Vérifier que la partie est terminée
      const updatedLobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(updatedLobby?.status).toBe("finished");
    });

    it("ne devrait pas terminer la partie si un joueur n'est pas finished", async () => {
      const hostId = testUtils.generateId();
      const playerId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestUser(playerId);
      await testUtils.createTestLobby(lobbyId, hostId);

      // Créer le lobby en mémoire avec deux joueurs
      LobbyLifecycleManager.createLobby(lobbyId, hostId, "Test Host", {
        selectedRegions: ["Europe"],
        gameMode: "quiz",
      });
      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      if (lobby) {
        lobby.players.set(playerId, {
          status: "joined",
          score: 0,
          progress: 0,
          name: "Test Player",
          validatedCountries: [],
          incorrectCountries: [],
        });
        lobby.status = "playing";
      }

      // Marquer seulement l'hôte comme finished
      await GameService.updatePlayerProgress(
        lobbyId,
        hostId,
        ["FR", "DE", "IT", "ES", "GB", "NL", "BE", "CH", "AT", "PL"],
        ["XX"],
        15,
        10
      );

      // Vérifier que la partie n'est pas terminée
      const updatedLobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(updatedLobby?.status).toBe("playing");
    });
  });
});

import { LobbyService } from "../../../src/services/lobbyService";
import { testUtils } from "../../setup";

describe("LobbyService", () => {
  describe("createLobby", () => {
    it("devrait créer un lobby avec succès", async () => {
      const hostId = testUtils.generateId();
      const hostName = "Test Host";
      const settings = { selectedRegions: ["Europe"], gameMode: "quiz" };

      const result = await LobbyService.createLobby(hostId, hostName, settings);

      expect(result.success).toBe(true);
      expect(result.lobbyId).toBeDefined();
      expect(result.hostId).toBe(hostId);
      expect(result.settings).toEqual(settings);
    });

    it("devrait créer un lobby avec des paramètres par défaut", async () => {
      const hostId = testUtils.generateId();
      const hostName = "Test Host";

      const result = await LobbyService.createLobby(hostId, hostName);

      expect(result.success).toBe(true);
      expect(result.settings).toBeDefined();
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      const hostId = "non-existent-user";
      const hostName = "Test Host";

      await expect(LobbyService.createLobby(hostId, hostName)).rejects.toThrow(
        "Utilisateur non trouvé"
      );
    });
  });

  describe("startGame", () => {
    it("devrait démarrer une partie avec succès", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer l'utilisateur et le lobby
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      const result = await LobbyService.startGame(lobbyId);

      expect(result).toBe(true);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const lobbyId = "non-existent-lobby";

      await expect(LobbyService.startGame(lobbyId)).rejects.toThrow();
    });
  });

  describe("updatePlayerScore", () => {
    it("devrait mettre à jour le score d'un joueur", async () => {
      const userId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(userId);
      await testUtils.createTestLobby(lobbyId, userId);

      const result = await LobbyService.updatePlayerScore(
        lobbyId,
        userId,
        15,
        75,
        ["FR", "DE"],
        ["IT", "ES"]
      );

      expect(result).toBe(true);
    });
  });

  describe("updatePlayerProgress", () => {
    it("devrait mettre à jour la progression d'un joueur", async () => {
      const userId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(userId);
      await testUtils.createTestLobby(lobbyId, userId);

      const result = await LobbyService.updatePlayerProgress(
        lobbyId,
        userId,
        ["FR", "DE"],
        ["IT", "ES"],
        15,
        20
      );

      expect(result).toBe(true);
    });
  });

  describe("updatePlayerStatus", () => {
    it("devrait mettre à jour le statut d'un joueur", async () => {
      const userId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(userId);
      await testUtils.createTestLobby(lobbyId, userId);

      const result = await LobbyService.updatePlayerStatus(
        lobbyId,
        userId,
        "ready"
      );

      expect(result).toBe(true);
    });
  });

  describe("updateLobbyStatus", () => {
    it("devrait mettre à jour le statut d'un lobby", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      const result = await LobbyService.updateLobbyStatus(lobbyId, "playing");

      expect(result).toBe(true);
    });
  });

  describe("areAllPlayersReady", () => {
    it("devrait retourner true si tous les joueurs sont prêts", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);
      await LobbyService.updatePlayerStatus(lobbyId, hostId, "ready");

      const result = await LobbyService.areAllPlayersReady(lobbyId, hostId);

      expect(result).toBe(true);
    });

    it("devrait retourner false si un joueur n'est pas prêt", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);
      // Ne pas marquer le joueur comme prêt

      const result = await LobbyService.areAllPlayersReady(lobbyId, hostId);

      expect(result).toBe(false);
    });
  });

  describe("getLobby", () => {
    it("devrait récupérer un lobby existant", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      const lobby = await LobbyService.getLobby(lobbyId);

      expect(lobby).toBeDefined();
      expect(lobby?.id).toBe(lobbyId);
      expect(lobby?.hostId).toBe(hostId);
    });

    it("devrait retourner null pour un lobby inexistant", async () => {
      const lobbyId = "non-existent-lobby";

      const lobby = await LobbyService.getLobby(lobbyId);

      expect(lobby).toBeNull();
    });
  });

  describe("deleteLobby", () => {
    it("devrait supprimer un lobby existant", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      const result = await LobbyService.deleteLobby(lobbyId);

      expect(result).toBe(true);

      // Vérifier que le lobby a été supprimé
      const lobby = await LobbyService.getLobby(lobbyId);
      expect(lobby).toBeNull();
    });
  });

  describe("updateLobbySettings", () => {
    it("devrait mettre à jour les paramètres d'un lobby", async () => {
      const hostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();
      const newSettings = { selectedRegions: ["Asia"], gameMode: "challenge" };

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      const result = await LobbyService.updateLobbySettings(
        hostId,
        lobbyId,
        newSettings
      );

      expect(result).toBe(true);
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      const hostId = testUtils.generateId();
      const nonHostId = testUtils.generateId();
      const lobbyId = testUtils.generateId();
      const newSettings = { selectedRegions: ["Asia"] };

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestUser(nonHostId);
      await testUtils.createTestLobby(lobbyId, hostId);

      const result = await LobbyService.updateLobbySettings(
        nonHostId,
        lobbyId,
        newSettings
      );

      expect(result).toBe(false);
    });
  });

  describe("inviteToLobby", () => {
    it("devrait inviter un ami dans un lobby", async () => {
      const hostId = testUtils.generateId();
      const friendId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestUser(friendId);
      await testUtils.createTestLobby(lobbyId, hostId);

      const result = await LobbyService.inviteToLobby(
        hostId,
        lobbyId,
        friendId
      );

      expect(result.success).toBe(true);
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      const hostId = testUtils.generateId();
      const nonHostId = testUtils.generateId();
      const friendId = testUtils.generateId();
      const lobbyId = testUtils.generateId();

      // Créer les données de test
      await testUtils.createTestUser(hostId);
      await testUtils.createTestUser(nonHostId);
      await testUtils.createTestUser(friendId);
      await testUtils.createTestLobby(lobbyId, hostId);

      await expect(
        LobbyService.inviteToLobby(nonHostId, lobbyId, friendId)
      ).rejects.toThrow("Non autorisé à inviter des joueurs dans ce lobby");
    });
  });
});

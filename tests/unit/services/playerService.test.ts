import { prisma } from "../../../src/lib/database";
import { PlayerService } from "../../../src/services/playerService";
import { testUtils } from "../../setup";

describe("PlayerService", () => {
  beforeEach(async () => {
    await testUtils.wait(100);
  });

  describe("addPlayerToLobby", () => {
    it("devrait ajouter un joueur au lobby", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const lobby = await testUtils.createTestLobby("test-lobby", user.id);

      // Act
      const result = await PlayerService.addPlayerToLobby(lobby.id, user.id);

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Joueur ajouté au lobby");

      // Vérifier en base
      const updatedLobby = await prisma.gameLobby.findUnique({
        where: { id: lobby.id },
      });
      expect(updatedLobby?.authorizedPlayers).toContain(user.id);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await PlayerService.addPlayerToLobby(
        "inexistant-lobby",
        user.id
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Lobby non trouvé");
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      // Arrange
      const host = await testUtils.createTestUser("host", "Host");
      const lobby = await testUtils.createTestLobby("test-lobby", host.id);

      // Act
      const result = await PlayerService.addPlayerToLobby(
        lobby.id,
        "inexistant-user"
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Utilisateur non trouvé");
    });

    it("devrait échouer si le joueur est déjà dans le lobby", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const lobby = await testUtils.createTestLobby("test-lobby", user.id, {
        authorizedPlayers: [user.id],
      });

      // Act
      const result = await PlayerService.addPlayerToLobby(lobby.id, user.id);

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Joueur déjà dans le lobby");
    });
  });

  describe("removePlayerFromLobby", () => {
    it("devrait retirer un joueur du lobby", async () => {
      // Arrange
      const host = await testUtils.createTestUser("host", "Host");
      const player = await testUtils.createTestUser("player", "Player");
      const lobby = await testUtils.createTestLobby("test-lobby", host.id, {
        authorizedPlayers: [host.id, player.id],
      });

      // Act
      const result = await PlayerService.removePlayerFromLobby(
        lobby.id,
        player.id
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Joueur retiré du lobby");

      // Vérifier en base
      const updatedLobby = await prisma.gameLobby.findUnique({
        where: { id: lobby.id },
      });
      expect(updatedLobby?.authorizedPlayers).not.toContain(player.id);
      expect(updatedLobby?.authorizedPlayers).toContain(host.id);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await PlayerService.removePlayerFromLobby(
        "inexistant-lobby",
        user.id
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Lobby non trouvé");
    });

    it("devrait échouer si le joueur n'est pas dans le lobby", async () => {
      // Arrange
      const host = await testUtils.createTestUser("host", "Host");
      const player = await testUtils.createTestUser("player", "Player");
      const lobby = await testUtils.createTestLobby("test-lobby", host.id, {
        authorizedPlayers: [host.id],
      });

      // Act
      const result = await PlayerService.removePlayerFromLobby(
        lobby.id,
        player.id
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Joueur non trouvé dans le lobby");
    });

    it("devrait empêcher de retirer l'hôte du lobby", async () => {
      // Arrange
      const host = await testUtils.createTestUser("host", "Host");
      const lobby = await testUtils.createTestLobby("test-lobby", host.id, {
        authorizedPlayers: [host.id],
      });

      // Act
      const result = await PlayerService.removePlayerFromLobby(
        lobby.id,
        host.id
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Impossible de retirer l'hôte du lobby");
    });
  });

  describe("getLobbyPlayers", () => {
    it("devrait retourner la liste des joueurs du lobby", async () => {
      // Arrange
      const host = await testUtils.createTestUser("host", "Host");
      const player1 = await testUtils.createTestUser("player1", "Player 1");
      const player2 = await testUtils.createTestUser("player2", "Player 2");

      const lobby = await testUtils.createTestLobby("test-lobby", host.id, {
        authorizedPlayers: [host.id, player1.id, player2.id],
      });

      // Act
      const result = await PlayerService.getLobbyPlayers(lobby.id);

      // Assert
      expect(result).toBeDefined();
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(3);
      expect(result.some((p: any) => p.id === host.id)).toBe(true);
      expect(result.some((p: any) => p.id === player1.id)).toBe(true);
      expect(result.some((p: any) => p.id === player2.id)).toBe(true);
    });

    it("devrait retourner un tableau vide si le lobby n'existe pas", async () => {
      // Act
      const result = await PlayerService.getLobbyPlayers("inexistant-lobby");

      // Assert
      expect(result).toEqual([]);
    });

    it("devrait retourner un tableau vide si aucun joueur", async () => {
      // Arrange
      const host = await testUtils.createTestUser("host", "Host");
      const lobby = await testUtils.createTestLobby("test-lobby", host.id, {
        authorizedPlayers: [],
      });

      // Act
      const result = await PlayerService.getLobbyPlayers(lobby.id);

      // Assert
      expect(result).toEqual([]);
    });
  });

  describe("isPlayerInLobby", () => {
    it("devrait retourner true si le joueur est dans le lobby", async () => {
      // Arrange
      const host = await testUtils.createTestUser("host", "Host");
      const player = await testUtils.createTestUser("player", "Player");
      const lobby = await testUtils.createTestLobby("test-lobby", host.id, {
        authorizedPlayers: [host.id, player.id],
      });

      // Act
      const result = await PlayerService.isPlayerInLobby(lobby.id, player.id);

      // Assert
      expect(result).toBe(true);
    });

    it("devrait retourner false si le joueur n'est pas dans le lobby", async () => {
      // Arrange
      const host = await testUtils.createTestUser("host", "Host");
      const player = await testUtils.createTestUser("player", "Player");
      const lobby = await testUtils.createTestLobby("test-lobby", host.id, {
        authorizedPlayers: [host.id],
      });

      // Act
      const result = await PlayerService.isPlayerInLobby(lobby.id, player.id);

      // Assert
      expect(result).toBe(false);
    });

    it("devrait retourner false si le lobby n'existe pas", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await PlayerService.isPlayerInLobby(
        "inexistant-lobby",
        user.id
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("getPlayerGameState", () => {
    it("devrait retourner l'état de jeu d'un joueur", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const lobby = await testUtils.createTestLobby("test-lobby", user.id, {
        status: "playing",
      });

      // Créer un état de jeu pour le joueur
      await prisma.gameState.create({
        data: {
          lobbyId: lobby.id,
          userId: user.id,
          currentQuestion: 5,
          score: 80,
          totalQuestions: 20,
          status: "playing",
          progress: 25,
        },
      });

      // Act
      const result = await PlayerService.getPlayerGameState(lobby.id, user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result?.currentQuestion).toBe(5);
      expect(result?.score).toBe(80);
      expect(result?.status).toBe("playing");
    });

    it("devrait retourner null si aucun état de jeu", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const lobby = await testUtils.createTestLobby("test-lobby", user.id);

      // Act
      const result = await PlayerService.getPlayerGameState(lobby.id, user.id);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("updatePlayerGameState", () => {
    it("devrait mettre à jour l'état de jeu d'un joueur", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const lobby = await testUtils.createTestLobby("test-lobby", user.id);

      const gameState = await prisma.gameState.create({
        data: {
          lobbyId: lobby.id,
          userId: user.id,
          currentQuestion: 1,
          score: 0,
          totalQuestions: 20,
          status: "playing",
          progress: 5,
        },
      });

      const updates = {
        currentQuestion: 10,
        score: 85,
        progress: 50,
      };

      // Act
      const result = await PlayerService.updatePlayerGameState(
        lobby.id,
        user.id,
        updates
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("État de jeu mis à jour");

      // Vérifier en base
      const updatedState = await prisma.gameState.findUnique({
        where: { id: gameState.id },
      });
      expect(updatedState?.currentQuestion).toBe(updates.currentQuestion);
      expect(updatedState?.score).toBe(updates.score);
      expect(updatedState?.progress).toBe(updates.progress);
    });

    it("devrait créer un nouvel état si il n'existe pas", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const lobby = await testUtils.createTestLobby("test-lobby", user.id);

      const updates = {
        currentQuestion: 1,
        score: 0,
        progress: 5,
      };

      // Act
      const result = await PlayerService.updatePlayerGameState(
        lobby.id,
        user.id,
        updates
      );

      // Assert
      expect(result.success).toBe(true);

      // Vérifier en base
      const newState = await prisma.gameState.findFirst({
        where: {
          lobbyId: lobby.id,
          userId: user.id,
        },
      });
      expect(newState).toBeDefined();
      expect(newState?.currentQuestion).toBe(updates.currentQuestion);
      expect(newState?.score).toBe(updates.score);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await PlayerService.updatePlayerGameState(
        "inexistant-lobby",
        user.id,
        {
          currentQuestion: 1,
        }
      );

      // Assert
      expect(result.success).toBe(false);
      expect(result.message).toContain("Lobby non trouvé");
    });
  });

  describe("setPlayerReady", () => {
    it("devrait marquer un joueur comme prêt", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const lobby = await testUtils.createTestLobby("test-lobby", user.id);

      // Act
      const result = await PlayerService.setPlayerReady(
        lobby.id,
        user.id,
        true
      );

      // Assert
      expect(result.success).toBe(true);
      expect(result.message).toContain("Statut de préparation mis à jour");

      // Vérifier en base
      const gameState = await prisma.gameState.findFirst({
        where: {
          lobbyId: lobby.id,
          userId: user.id,
        },
      });
      expect(gameState?.isReady).toBe(true);
    });

    it("devrait marquer un joueur comme non prêt", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");
      const lobby = await testUtils.createTestLobby("test-lobby", user.id);

      // Créer un état avec le joueur prêt
      await prisma.gameState.create({
        data: {
          lobbyId: lobby.id,
          userId: user.id,
          isReady: true,
          status: "waiting",
        },
      });

      // Act
      const result = await PlayerService.setPlayerReady(
        lobby.id,
        user.id,
        false
      );

      // Assert
      expect(result.success).toBe(true);

      // Vérifier en base
      const gameState = await prisma.gameState.findFirst({
        where: {
          lobbyId: lobby.id,
          userId: user.id,
        },
      });
      expect(gameState?.isReady).toBe(false);
    });
  });

  describe("getPlayerStats", () => {
    it("devrait retourner les statistiques d'un joueur", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Créer des scores pour le joueur
      await prisma.gameScore.createMany({
        data: [
          {
            userId: user.id,
            score: 80,
            totalQuestions: 20,
            selectedRegions: ["Europe"],
            gameMode: "quiz",
            duration: 300,
          },
          {
            userId: user.id,
            score: 90,
            totalQuestions: 20,
            selectedRegions: ["Asia"],
            gameMode: "quiz",
            duration: 250,
          },
        ],
      });

      // Act
      const result = await PlayerService.getPlayerStats(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.totalGames).toBe(2);
      expect(result.averageScore).toBe(85);
      expect(result.bestScore).toBe(90);
      expect(result.totalQuestions).toBe(40);
    });

    it("devrait retourner des statistiques par défaut si aucun score", async () => {
      // Arrange
      const user = await testUtils.createTestUser("user", "User");

      // Act
      const result = await PlayerService.getPlayerStats(user.id);

      // Assert
      expect(result).toBeDefined();
      expect(result.totalGames).toBe(0);
      expect(result.averageScore).toBe(0);
      expect(result.bestScore).toBe(0);
      expect(result.totalQuestions).toBe(0);
    });
  });
});

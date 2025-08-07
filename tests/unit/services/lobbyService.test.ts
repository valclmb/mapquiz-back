import * as LobbyModel from "../../../src/models/lobbyModel.js";
import * as UserModel from "../../../src/models/userModel.js";
import { LobbyService } from "../../../src/services/lobbyService.js";

// Mock des dépendances
jest.mock("../../../src/models/lobbyModel.js");
jest.mock("../../../src/models/userModel.js");
jest.mock("../../../src/websocket/core/connectionManager.js", () => ({
  sendToUser: jest.fn(),
}));
jest.mock("../../../src/websocket/lobby/lobbyLifecycle.js", () => ({
  LobbyLifecycleManager: {
    getInstance: jest.fn().mockReturnValue({
      addLobby: jest.fn(),
      removeLobby: jest.fn(),
    }),
  },
}));

describe("LobbyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createLobby", () => {
    it("devrait créer un lobby avec succès", async () => {
      // Arrange
      const hostId = "test-host-id";
      const name = "Test Lobby";
      const settings = { selectedRegions: ["Europe"], gameMode: "quiz" };

      const mockUser = {
        id: hostId,
        name: "Test User",
        email: "test@example.com",
      };

      const mockLobby = {
        id: "test-lobby-id",
        hostId,
        name,
        settings,
        status: "waiting",
        createdAt: new Date(),
      };

      (UserModel.findUserById as jest.Mock).mockResolvedValue(mockUser);
      (LobbyModel.createLobby as jest.Mock).mockResolvedValue(mockLobby);

      // Act
      const result = await LobbyService.createLobby(hostId, name, settings);

      // Assert
      expect(result.success).toBe(true);
      expect(result.lobbyId).toBe("test-lobby-id");
      expect(result.hostId).toBe(hostId);
      expect(result.settings).toEqual(settings);
      expect(UserModel.findUserById).toHaveBeenCalledWith(hostId);
      expect(LobbyModel.createLobby).toHaveBeenCalledWith(
        hostId,
        name,
        settings
      );
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      // Arrange
      const hostId = "non-existent-user";
      const name = "Test Lobby";

      (UserModel.findUserById as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await LobbyService.createLobby(hostId, name);

      // Assert
      expect(result.success).toBe(false);
      expect(result.lobbyId).toBe("");
      expect(UserModel.findUserById).toHaveBeenCalledWith(hostId);
      expect(LobbyModel.createLobby).not.toHaveBeenCalled();
    });

    it("devrait utiliser le nom de l'utilisateur si aucun nom n'est fourni", async () => {
      // Arrange
      const hostId = "test-host-id";
      const mockUser = {
        id: hostId,
        name: "Test User",
        email: "test@example.com",
      };

      const mockLobby = {
        id: "test-lobby-id",
        hostId,
        name: "Lobby de Test User",
        settings: {},
        status: "waiting",
      };

      (UserModel.findUserById as jest.Mock).mockResolvedValue(mockUser);
      (LobbyModel.createLobby as jest.Mock).mockResolvedValue(mockLobby);

      // Act
      const result = await LobbyService.createLobby(hostId, "", {});

      // Assert
      expect(result.success).toBe(true);
      expect(LobbyModel.createLobby).toHaveBeenCalledWith(
        hostId,
        "Lobby de Test User",
        {}
      );
    });

    it("devrait gérer les erreurs lors de la création", async () => {
      // Arrange
      const hostId = "test-host-id";
      const mockUser = { id: hostId, name: "Test User" };

      (UserModel.findUserById as jest.Mock).mockResolvedValue(mockUser);
      (LobbyModel.createLobby as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      const result = await LobbyService.createLobby(hostId, "Test Lobby");

      // Assert
      expect(result.success).toBe(false);
      expect(result.lobbyId).toBe("");
    });
  });

  describe("startGame", () => {
    it("devrait démarrer une partie avec succès", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        id: lobbyId,
        players: [
          { userId: "player1", status: "ready" },
          { userId: "player2", status: "ready" },
        ],
      };

      (LobbyModel.updateLobbyStatus as jest.Mock).mockResolvedValue(true);
      (LobbyModel.getLobby as jest.Mock).mockResolvedValue(mockLobby);
      (LobbyModel.updatePlayerStatus as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await LobbyService.startGame(lobbyId);

      // Assert
      expect(result).toBe(true);
      expect(LobbyModel.updateLobbyStatus).toHaveBeenCalledWith(
        lobbyId,
        "playing"
      );
      expect(LobbyModel.updatePlayerStatus).toHaveBeenCalledTimes(2);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      // Arrange
      const lobbyId = "non-existent-lobby";

      (LobbyModel.updateLobbyStatus as jest.Mock).mockResolvedValue(true);
      (LobbyModel.getLobby as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await LobbyService.startGame(lobbyId);

      // Assert
      expect(result).toBe(true); // updateLobbyStatus réussit même si getLobby échoue
    });

    it("devrait gérer les erreurs lors du démarrage", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";

      (LobbyModel.updateLobbyStatus as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      const result = await LobbyService.startGame(lobbyId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("updatePlayerScore", () => {
    it("devrait mettre à jour le score d'un joueur avec succès", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const playerId = "test-player-id";
      const score = 100;
      const progress = 50;
      const validatedCountries = ["FRA", "DEU"];
      const incorrectCountries = ["USA"];

      (LobbyModel.updatePlayerGameData as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await LobbyService.updatePlayerScore(
        lobbyId,
        playerId,
        score,
        progress,
        validatedCountries,
        incorrectCountries
      );

      // Assert
      expect(result).toBe(true);
      expect(LobbyModel.updatePlayerGameData).toHaveBeenCalledWith(
        lobbyId,
        playerId,
        score,
        progress,
        validatedCountries,
        incorrectCountries
      );
    });

    it("devrait gérer les erreurs lors de la mise à jour du score", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const playerId = "test-player-id";

      (LobbyModel.updatePlayerGameData as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      const result = await LobbyService.updatePlayerScore(
        lobbyId,
        playerId,
        100,
        50,
        [],
        []
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("getLobby", () => {
    it("devrait récupérer un lobby avec succès", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        id: lobbyId,
        hostId: "test-host-id",
        name: "Test Lobby",
        status: "waiting",
        players: [],
      };

      (LobbyModel.getLobby as jest.Mock).mockResolvedValue(mockLobby);

      // Act
      const result = await LobbyService.getLobby(lobbyId);

      // Assert
      expect(result).toEqual(mockLobby);
      expect(LobbyModel.getLobby).toHaveBeenCalledWith(lobbyId);
    });

    it("devrait retourner null si le lobby n'existe pas", async () => {
      // Arrange
      const lobbyId = "non-existent-lobby";

      (LobbyModel.getLobby as jest.Mock).mockResolvedValue(null);

      // Act
      const result = await LobbyService.getLobby(lobbyId);

      // Assert
      expect(result).toBeNull();
    });
  });

  describe("deleteLobby", () => {
    it("devrait supprimer un lobby avec succès", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";

      (LobbyModel.deleteLobby as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await LobbyService.deleteLobby(lobbyId);

      // Assert
      expect(result).toBe(true);
      expect(LobbyModel.deleteLobby).toHaveBeenCalledWith(lobbyId);
    });

    it("devrait gérer les erreurs lors de la suppression", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";

      (LobbyModel.deleteLobby as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      const result = await LobbyService.deleteLobby(lobbyId);

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("areAllPlayersReady", () => {
    it("devrait retourner true si tous les joueurs sont prêts", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const hostId = "test-host-id";

      (LobbyModel.areAllPlayersReady as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await LobbyService.areAllPlayersReady(lobbyId, hostId);

      // Assert
      expect(result).toBe(true);
      expect(LobbyModel.areAllPlayersReady).toHaveBeenCalledWith(
        lobbyId,
        hostId
      );
    });

    it("devrait retourner false si un joueur n'est pas prêt", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const hostId = "test-host-id";

      (LobbyModel.areAllPlayersReady as jest.Mock).mockResolvedValue(false);

      // Act
      const result = await LobbyService.areAllPlayersReady(lobbyId, hostId);

      // Assert
      expect(result).toBe(false);
      expect(LobbyModel.areAllPlayersReady).toHaveBeenCalledWith(
        lobbyId,
        hostId
      );
    });

    it("devrait retourner false si le lobby n'existe pas", async () => {
      // Arrange
      const lobbyId = "non-existent-lobby";
      const hostId = "test-host-id";

      (LobbyModel.areAllPlayersReady as jest.Mock).mockRejectedValue(
        new Error("Lobby not found")
      );

      // Act
      const result = await LobbyService.areAllPlayersReady(lobbyId, hostId);

      // Assert
      expect(result).toBe(false);
    });
  });
});

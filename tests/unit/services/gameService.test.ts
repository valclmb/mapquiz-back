import { GameService } from "../../../src/services/gameService.js";
import { LobbyService } from "../../../src/services/lobbyService.js";
import { PlayerService } from "../../../src/services/playerService.js";
import { BroadcastManager } from "../../../src/websocket/lobby/broadcastManager.js";
import { LobbyLifecycleManager } from "../../../src/websocket/lobby/lobbyLifecycle.js";

// Mock des dépendances
jest.mock("../../../src/websocket/lobby/lobbyLifecycle.js");
jest.mock("../../../src/services/playerService.js");
jest.mock("../../../src/services/lobbyService.js");
jest.mock("../../../src/websocket/lobby/broadcastManager.js");

describe("GameService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("startGame", () => {
    it("devrait démarrer une partie avec succès", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        id: lobbyId,
        status: "waiting",
        settings: { gameMode: "quiz" },
        players: new Map([
          ["player1", { id: "player1", status: "ready" }],
          ["player2", { id: "player2", status: "ready" }],
        ]),
        gameState: undefined,
      };

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        mockLobby
      );
      (LobbyService.startGame as jest.Mock).mockResolvedValue(true);
      (LobbyService.updatePlayerStatus as jest.Mock).mockResolvedValue(true);
      (LobbyService.saveGameState as jest.Mock).mockResolvedValue(true);
      (PlayerService.updatePlayerStatus as jest.Mock).mockReturnValue({
        id: "player1",
        status: "playing",
      });

      // Act
      const result = await GameService.startGame(lobbyId);

      // Assert
      expect(result).toBe(true);
      expect(mockLobby.status).toBe("playing");
      expect(mockLobby.gameState).toBeDefined();
      expect(LobbyService.startGame).toHaveBeenCalledWith(lobbyId);
      expect(BroadcastManager.broadcastGameStart).toHaveBeenCalledWith(
        lobbyId,
        mockLobby
      );
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      // Arrange
      const lobbyId = "non-existent-lobby";

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        null
      );

      // Act
      const result = await GameService.startGame(lobbyId);

      // Assert
      expect(result).toBe(false);
      expect(LobbyService.startGame).not.toHaveBeenCalled();
    });

    it("devrait gérer les erreurs lors du démarrage", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        id: lobbyId,
        status: "waiting",
        settings: { gameMode: "quiz" },
        players: new Map([["player1", { id: "player1", status: "ready" }]]),
      };

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        mockLobby
      );
      (LobbyService.startGame as jest.Mock).mockRejectedValue(
        new Error("Start failed")
      );
      (PlayerService.updatePlayerStatus as jest.Mock).mockReturnValue({
        id: "player1",
        status: "playing",
      });

      // Act
      const result = await GameService.startGame(lobbyId);

      // Assert
      expect(result).toBe(true); // Le service continue même si la DB échoue
    });
  });

  describe("updatePlayerScore", () => {
    it("devrait mettre à jour le score d'un joueur avec succès", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const playerId = "test-player-id";
      const score = 100;
      const progress = 50;

      const mockLobby = {
        id: lobbyId,
        players: new Map([[playerId, { id: playerId, score: 0, progress: 0 }]]),
      };

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        mockLobby
      );
      (PlayerService.updatePlayerScore as jest.Mock).mockReturnValue({
        id: playerId,
        score,
        progress,
      });

      // Act
      const result = await GameService.updatePlayerScore(
        lobbyId,
        playerId,
        score,
        progress
      );

      // Assert
      expect(result).toBe(true);
      expect(PlayerService.updatePlayerScore).toHaveBeenCalledWith(
        { id: playerId, score: 0, progress: 0 },
        score,
        progress,
        undefined,
        undefined
      );
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      // Arrange
      const lobbyId = "non-existent-lobby";
      const playerId = "test-player-id";

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        null
      );

      // Act
      const result = await GameService.updatePlayerScore(
        lobbyId,
        playerId,
        100,
        50
      );

      // Assert
      expect(result).toBe(false);
    });

    it("devrait échouer si le joueur n'existe pas", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const playerId = "non-existent-player";

      const mockLobby = {
        id: lobbyId,
        players: new Map([
          ["other-player", { id: "other-player", score: 0, progress: 0 }],
        ]),
      };

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        mockLobby
      );

      // Act
      const result = await GameService.updatePlayerScore(
        lobbyId,
        playerId,
        100,
        50
      );

      // Assert
      expect(result).toBe(false);
    });
  });

  describe("updatePlayerProgress", () => {
    it("devrait mettre à jour le progrès d'un joueur avec succès", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const playerId = "test-player-id";
      const validatedCountries = ["FRA", "DEU"];
      const incorrectCountries = ["USA"];
      const score = 100;
      const totalQuestions = 10;

      const mockLobby = {
        id: lobbyId,
        players: new Map([[playerId, { id: playerId, score: 0, progress: 0 }]]),
      };

      const updatedPlayer = {
        id: playerId,
        score,
        progress: 50,
        validatedCountries,
        incorrectCountries,
      };

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        mockLobby
      );
      (PlayerService.updatePlayerProgress as jest.Mock).mockReturnValue(
        updatedPlayer
      );
      (LobbyService.updatePlayerProgress as jest.Mock).mockResolvedValue(true);

      // Act
      const result = await GameService.updatePlayerProgress(
        lobbyId,
        playerId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions
      );

      // Assert
      expect(result).toBe(true);
      expect(PlayerService.updatePlayerProgress).toHaveBeenCalledWith(
        { id: playerId, score: 0, progress: 0 },
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions
      );
      expect(LobbyService.updatePlayerProgress).toHaveBeenCalledWith(
        lobbyId,
        playerId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions
      );
    });

    it("devrait gérer les erreurs lors de la mise à jour", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const playerId = "test-player-id";

      const mockLobby = {
        id: lobbyId,
        players: new Map([[playerId, { id: playerId, score: 0, progress: 0 }]]),
      };

      const updatedPlayer = {
        id: playerId,
        score: 0,
        progress: 0,
        validatedCountries: [],
        incorrectCountries: [],
      };

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        mockLobby
      );
      (PlayerService.updatePlayerProgress as jest.Mock).mockReturnValue(
        updatedPlayer
      );
      (LobbyService.updatePlayerProgress as jest.Mock).mockRejectedValue(
        new Error("Update failed")
      );

      // Act
      const result = await GameService.updatePlayerProgress(
        lobbyId,
        playerId,
        [],
        [],
        0,
        0
      );

      // Assert
      expect(result).toBe(true); // Le service continue même si la DB échoue
    });
  });

  describe("restartLobby", () => {
    it("devrait redémarrer un lobby avec succès", async () => {
      // Arrange
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        id: lobbyId,
        status: "finished",
        players: new Map([["player1", { id: "player1", status: "finished" }]]),
        gameState: { startTime: Date.now() },
      };

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        mockLobby
      );
      (LobbyService.updateLobbyStatus as jest.Mock).mockResolvedValue(true);
      (LobbyService.updatePlayerStatus as jest.Mock).mockResolvedValue(true);
      (LobbyService.updatePlayerScore as jest.Mock).mockResolvedValue(true);
      (PlayerService.resetPlayersForNewGame as jest.Mock).mockReturnValue(
        new Map([["player1", { id: "player1", status: "joined" }]])
      );

      // Act
      const result = await GameService.restartLobby(lobbyId);

      // Assert
      expect(result).toBe(true);
      expect(mockLobby.status).toBe("waiting");
      expect(mockLobby.gameState).toBeNull();
      expect(LobbyService.updateLobbyStatus).toHaveBeenCalledWith(
        lobbyId,
        "waiting"
      );
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      // Arrange
      const lobbyId = "non-existent-lobby";

      (LobbyLifecycleManager.getLobbyInMemory as jest.Mock).mockReturnValue(
        null
      );

      // Act
      const result = await GameService.restartLobby(lobbyId);

      // Assert
      expect(result).toBe(false);
    });
  });
});

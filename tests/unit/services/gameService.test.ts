import { GameService } from "../../../src/services/gameService.js";
import { LobbyService } from "../../../src/services/lobbyService.js";
import {
  PlayerService,
  type PlayerProgress,
} from "../../../src/services/playerService.js";
import { BroadcastManager } from "../../../src/websocket/lobby/broadcastManager.js";
import { LobbyLifecycleManager } from "../../../src/websocket/lobby/lobbyLifecycle.js";

// Mock des dépendances
jest.mock("../../../src/websocket/lobby/lobbyLifecycle.js");
jest.mock("../../../src/services/lobbyService.js");
jest.mock("../../../src/services/playerService.js");
jest.mock("../../../src/websocket/lobby/broadcastManager.js");
jest.mock("../../../src/models/lobbyModel.js", () => ({
  updateLobbyStatus: jest.fn(),
  saveGameState: jest.fn(),
  updatePlayerGameData: jest.fn(),
}));

const mockLobbyLifecycleManager = LobbyLifecycleManager as jest.Mocked<
  typeof LobbyLifecycleManager
>;
const mockLobbyService = LobbyService as jest.Mocked<typeof LobbyService>;
const mockPlayerService = PlayerService as jest.Mocked<typeof PlayerService>;
const mockBroadcastManager = BroadcastManager as jest.Mocked<
  typeof BroadcastManager
>;

describe("GameService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("startGame", () => {
    it("devrait démarrer une partie avec succès", async () => {
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        id: lobbyId,
        status: "waiting",
        settings: { totalQuestions: 10 },
        players: new Map<string, PlayerProgress>([
          [
            "player1",
            {
              status: "ready",
              score: 0,
              progress: 0,
              name: "Player 1",
              validatedCountries: [],
              incorrectCountries: [],
            },
          ],
        ]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updateLobbyStatus.mockResolvedValue(true);

      const result = await GameService.startGame(lobbyId);

      expect(result).toBe(true);
      expect(mockLobby.status).toBe("playing");
      // Le test vérifie que updateLobbyStatus est appelé via LobbyModel, pas LobbyService
      expect(mockLobbyService.updateLobbyStatus).not.toHaveBeenCalled();
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const lobbyId = "non-existent-lobby";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await GameService.startGame(lobbyId);

      expect(result).toBe(false);
    });

    it("devrait gérer les erreurs lors du démarrage", async () => {
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        id: lobbyId,
        status: "waiting",
        settings: { totalQuestions: 10 },
        players: new Map<string, PlayerProgress>(),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      // Mock LobbyModel.updateLobbyStatus pour qu'il lance une erreur
      const {
        updateLobbyStatus,
      } = require("../../../src/models/lobbyModel.js");
      updateLobbyStatus.mockRejectedValue(new Error("Database error"));

      const result = await GameService.startGame(lobbyId);

      expect(result).toBe(false);
    });
  });

  describe("updatePlayerProgress", () => {
    it("devrait mettre à jour la progression d'un joueur avec succès", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "test-user-id";
      const validatedCountries: string[] = ["France", "Germany"];
      const incorrectCountries: string[] = ["Spain"];
      const score = 100;
      const totalQuestions = 10;

      const mockPlayer: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test User",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const mockLobby = {
        id: lobbyId,
        players: new Map<string, PlayerProgress>([[userId, mockPlayer]]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await GameService.updatePlayerProgress(
        lobbyId,
        userId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions
      );

      expect(result).toBe(true);
      expect(mockPlayer.score).toBe(100);
      expect(mockPlayer.progress).toBe(30); // (3/10) * 100 = 30
      expect(mockPlayer.validatedCountries).toEqual(validatedCountries);
      expect(mockPlayer.incorrectCountries).toEqual(incorrectCountries);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const lobbyId = "non-existent-lobby";
      const userId = "test-user-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await GameService.updatePlayerProgress(
        lobbyId,
        userId,
        [],
        [],
        0,
        0
      );

      expect(result).toBe(false);
    });

    it("devrait échouer si le joueur n'existe pas", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "non-existent-user";

      const mockLobby = {
        id: lobbyId,
        players: new Map<string, PlayerProgress>(),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await GameService.updatePlayerProgress(
        lobbyId,
        userId,
        [],
        [],
        0,
        0
      );

      expect(result).toBe(false);
    });

    it("devrait traiter les données supplémentaires si fournies", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "test-user-id";
      const validatedCountries: string[] = ["France"];
      const incorrectCountries: string[] = [];
      const score = 100;
      const totalQuestions = 10;
      const answerTime = 5000;
      const isConsecutiveCorrect = true;

      const mockPlayer: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test User",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const mockLobby = {
        id: lobbyId,
        players: new Map<string, PlayerProgress>([[userId, mockPlayer]]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockPlayerService.updatePlayerScore.mockReturnValue({
        ...mockPlayer,
        score: 100,
        progress: 10,
      });

      const result = await GameService.updatePlayerProgress(
        lobbyId,
        userId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions,
        answerTime,
        isConsecutiveCorrect
      );

      expect(result).toBe(true);
      expect(mockPlayerService.updatePlayerScore).toHaveBeenCalledWith(
        mockPlayer,
        score,
        10, // progress calculé: (1/10) * 100 = 10
        answerTime,
        isConsecutiveCorrect
      );
    });

    it("devrait vérifier la fin de partie si le joueur a terminé", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "test-user-id";
      const validatedCountries: string[] = ["France"];
      const incorrectCountries: string[] = [];
      const score = 100;
      const totalQuestions = 1; // Pour que progress = 100

      const mockPlayer: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test User",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const mockLobby = {
        id: lobbyId,
        players: new Map<string, PlayerProgress>([[userId, mockPlayer]]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await GameService.updatePlayerProgress(
        lobbyId,
        userId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions
      );

      expect(result).toBe(true);
      expect(mockPlayer.progress).toBe(100);
    });
  });

  describe("checkGameCompletion", () => {
    it("ne devrait pas terminer la partie si un joueur n'a pas fini", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "test-user-id";

      const mockLobby = {
        id: lobbyId,
        players: new Map<string, PlayerProgress>([
          [
            userId,
            {
              status: "playing",
              score: 100,
              progress: 100,
              name: "Test User",
              validatedCountries: [],
              incorrectCountries: [],
            },
          ],
          [
            "player2",
            {
              status: "playing",
              score: 80,
              progress: 50,
              name: "Player 2",
              validatedCountries: [],
              incorrectCountries: [],
            },
          ],
        ]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const endGameSpy = jest
        .spyOn(GameService as any, "endGame")
        .mockResolvedValue(undefined);

      const checkGameCompletion = (GameService as any).checkGameCompletion;
      checkGameCompletion(lobbyId, userId);

      expect(endGameSpy).not.toHaveBeenCalled();
      endGameSpy.mockRestore();
    });

    it("ne devrait rien faire si le lobby n'existe pas", async () => {
      const lobbyId = "non-existent-lobby";
      const userId = "test-user-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const endGameSpy = jest
        .spyOn(GameService as any, "endGame")
        .mockResolvedValue(undefined);

      const checkGameCompletion = (GameService as any).checkGameCompletion;
      checkGameCompletion(lobbyId, userId);

      expect(endGameSpy).not.toHaveBeenCalled();
      endGameSpy.mockRestore();
    });
  });

  describe("endGame", () => {
    it("devrait terminer la partie avec succès", async () => {
      const lobbyId = "test-lobby-id";

      const mockLobby = {
        id: lobbyId,
        status: "playing",
        players: new Map<string, PlayerProgress>(),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updateLobbyStatus.mockResolvedValue(true);
      mockBroadcastManager.broadcastLobbyUpdate.mockResolvedValue(undefined);

      const endGame = (GameService as any).endGame;
      await endGame(lobbyId);

      expect(mockLobby.status).toBe("finished");
      expect(mockLobbyService.updateLobbyStatus).toHaveBeenCalledWith(
        lobbyId,
        "finished"
      );
      expect(mockBroadcastManager.broadcastLobbyUpdate).toHaveBeenCalledWith(
        lobbyId,
        mockLobby
      );
      expect(mockBroadcastManager.broadcastGameEnd).toHaveBeenCalledWith(
        lobbyId
      );
    });

    it("ne devrait rien faire si le lobby n'existe pas", async () => {
      const lobbyId = "non-existent-lobby";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const endGame = (GameService as any).endGame;
      await endGame(lobbyId);

      expect(mockLobbyService.updateLobbyStatus).not.toHaveBeenCalled();
      expect(mockBroadcastManager.broadcastLobbyUpdate).not.toHaveBeenCalled();
      expect(mockBroadcastManager.broadcastGameEnd).not.toHaveBeenCalled();
    });
  });

  describe("restartLobby", () => {
    it("devrait redémarrer un lobby avec succès", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "test-user-id";

      const mockLobby = {
        id: lobbyId,
        status: "finished",
        gameState: { some: "state" },
        players: new Map<string, PlayerProgress>([
          [
            userId,
            {
              status: "finished",
              score: 100,
              progress: 100,
              name: "Test User",
              validatedCountries: [],
              incorrectCountries: [],
            },
          ],
        ]),
      };

      const resetPlayers = new Map<string, PlayerProgress>([
        [
          userId,
          {
            status: "joined",
            score: 0,
            progress: 0,
            name: "Test User",
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
      ]);

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updateLobbyStatus.mockResolvedValue(true);
      mockPlayerService.resetPlayersForNewGame.mockReturnValue(resetPlayers);
      mockLobbyService.updatePlayerScore.mockResolvedValue(true);
      mockLobbyService.updatePlayerStatus.mockResolvedValue(true);

      const result = await GameService.restartLobby(lobbyId);

      expect(result).toBe(true);
      expect(mockLobby.status).toBe("waiting");
      expect(mockLobby.gameState).toBeNull();
      expect(mockLobbyService.updateLobbyStatus).toHaveBeenCalledWith(
        lobbyId,
        "waiting"
      );
      expect(mockPlayerService.resetPlayersForNewGame).toHaveBeenCalled();
      expect(mockLobbyService.updatePlayerScore).toHaveBeenCalledWith(
        lobbyId,
        userId,
        0,
        0,
        [],
        []
      );
      expect(mockLobbyService.updatePlayerStatus).toHaveBeenCalledWith(
        lobbyId,
        userId,
        "joined"
      );
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const lobbyId = "non-existent-lobby";
      const consoleLogSpy = jest.spyOn(console, "log").mockImplementation();

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await GameService.restartLobby(lobbyId);

      expect(result).toBe(false);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        `Lobby ${lobbyId} non trouvé en mémoire`
      );

      consoleLogSpy.mockRestore();
    });
  });
});

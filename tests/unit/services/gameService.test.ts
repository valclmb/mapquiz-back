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
    it("devrait démarrer une partie avec validation complète de l'état", async () => {
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
          [
            "player2",
            {
              status: "ready",
              score: 0,
              progress: 0,
              name: "Player 2",
              validatedCountries: [],
              incorrectCountries: [],
            },
          ],
        ]),
        gameState: null,
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updateLobbyStatus.mockResolvedValue(true);

      const result = await GameService.startGame(lobbyId);

      // Validation métier complète
      expect(result).toBe(true);
      expect(mockLobby.status).toBe("playing");
      expect(mockLobby.gameState).toBeDefined();
      expect(mockLobby.gameState).toHaveProperty("startTime");
      expect(mockLobby.gameState).toHaveProperty("totalQuestions", 10);
      expect(mockLobby.gameState).toHaveProperty("currentQuestion", 0);
      expect(mockBroadcastManager.broadcastGameStart).toHaveBeenCalledWith(
        lobbyId,
        mockLobby
      );
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await GameService.startGame("non-existent-lobby");

      expect(result).toBe(false);
      expect(mockLobbyService.updateLobbyStatus).not.toHaveBeenCalled();
      expect(mockBroadcastManager.broadcastGameStart).not.toHaveBeenCalled();
    });

    it("devrait échouer en cas d'erreur de base de données", async () => {
      const mockLobby = {
        id: "test-lobby-id",
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
        gameState: null,
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      // Simuler une erreur de base de données
      jest
        .spyOn(
          require("../../../src/models/lobbyModel.js"),
          "updateLobbyStatus"
        )
        .mockRejectedValue(new Error("Database error"));

      const result = await GameService.startGame("test-lobby-id");

      expect(result).toBe(false);
      expect(mockLobby.status).toBe("waiting"); // État inchangé
    });
  });

  describe("updatePlayerProgress", () => {
    it("devrait calculer correctement la progression avec validation métier", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "test-user-id";
      const validatedCountries: string[] = ["France", "Germany"];
      const incorrectCountries: string[] = ["Spain"];
      const score = 150;
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

      // Validation métier spécifique
      expect(result).toBe(true);
      expect(mockPlayer.score).toBe(150);
      expect(mockPlayer.progress).toBe(30); // (3/10) * 100 = 30%
      expect(mockPlayer.validatedCountries).toEqual(validatedCountries);
      expect(mockPlayer.incorrectCountries).toEqual(incorrectCountries);
    });

    it("devrait traiter les données supplémentaires avec bonus", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "test-user-id";
      const validatedCountries: string[] = ["France"];
      const incorrectCountries: string[] = [];
      const score = 100;
      const totalQuestions = 10;
      const answerTime = 3000;
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
        score: 120, // Bonus appliqué
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
      expect(mockPlayer.score).toBe(120); // Score avec bonus
    });

    it("devrait détecter la fin de partie quand le joueur a terminé", async () => {
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
      // Le statut ne change pas dans updatePlayerProgress, seulement dans checkGameCompletion
      expect(mockPlayer.status).toBe("playing");
    });

    it("devrait échouer si le lobby ou le joueur n'existe pas", async () => {
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await GameService.updatePlayerProgress(
        "non-existent-lobby",
        "test-user-id",
        [],
        [],
        0,
        10
      );

      expect(result).toBe(false);
    });

    it("devrait échouer en cas d'erreur de base de données", async () => {
      const mockPlayer: PlayerProgress = {
        status: "playing",
        score: 0,
        progress: 0,
        name: "Test User",
        validatedCountries: [],
        incorrectCountries: [],
      };

      const mockLobby = {
        id: "test-lobby-id",
        players: new Map<string, PlayerProgress>([
          ["test-user-id", mockPlayer],
        ]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      // Simuler une erreur de base de données
      jest
        .spyOn(
          require("../../../src/models/lobbyModel.js"),
          "updatePlayerGameData"
        )
        .mockRejectedValue(new Error("Database error"));

      const result = await GameService.updatePlayerProgress(
        "test-lobby-id",
        "test-user-id",
        ["France"],
        [],
        100,
        10
      );

      expect(result).toBe(false);
    });
  });

  describe("checkGameCompletion", () => {
    it("devrait terminer la partie si tous les joueurs ont fini", async () => {
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
              progress: 100,
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
      // Bind le contexte pour que this.endGame fonctionne
      checkGameCompletion.call(GameService, lobbyId, userId);

      expect(mockLobby.players.get(userId)?.status).toBe("finished");
      expect(endGameSpy).toHaveBeenCalledWith(lobbyId);

      endGameSpy.mockRestore();
    });

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
  });

  describe("endGame", () => {
    it("devrait terminer la partie avec mise à jour complète de l'état", async () => {
      const lobbyId = "test-lobby-id";

      const mockLobby = {
        id: lobbyId,
        status: "playing",
        players: new Map<string, PlayerProgress>([
          [
            "player1",
            {
              status: "finished",
              score: 100,
              progress: 100,
              name: "Player 1",
              validatedCountries: [],
              incorrectCountries: [],
            },
          ],
        ]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updateLobbyStatus.mockResolvedValue(true);

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
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const endGame = (GameService as any).endGame;
      await endGame("non-existent-lobby");

      expect(mockLobbyService.updateLobbyStatus).not.toHaveBeenCalled();
      expect(mockBroadcastManager.broadcastLobbyUpdate).not.toHaveBeenCalled();
      expect(mockBroadcastManager.broadcastGameEnd).not.toHaveBeenCalled();
    });
  });

  describe("restartLobby", () => {
    it("devrait redémarrer un lobby avec réinitialisation complète", async () => {
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
              validatedCountries: ["France"],
              incorrectCountries: ["Spain"],
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
      expect(mockLobby.players.get(userId)?.status).toBe("joined");
      expect(mockLobby.players.get(userId)?.score).toBe(0);
      expect(mockLobby.players.get(userId)?.progress).toBe(0);
      expect(mockLobby.players.get(userId)?.validatedCountries).toEqual([]);
      expect(mockLobby.players.get(userId)?.incorrectCountries).toEqual([]);
      expect(mockLobbyService.updateLobbyStatus).toHaveBeenCalledWith(
        lobbyId,
        "waiting"
      );
      expect(mockPlayerService.resetPlayersForNewGame).toHaveBeenCalled();
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await GameService.restartLobby("non-existent-lobby");

      expect(result).toBe(false);
      expect(mockLobbyService.updateLobbyStatus).not.toHaveBeenCalled();
      expect(mockPlayerService.resetPlayersForNewGame).not.toHaveBeenCalled();
    });
  });
});

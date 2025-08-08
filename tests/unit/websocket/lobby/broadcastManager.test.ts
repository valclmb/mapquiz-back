import { sendToUser } from "../../../../src/websocket/core/connectionManager.js";
import { BroadcastManager } from "../../../../src/websocket/lobby/broadcastManager.js";
import { LobbyLifecycleManager } from "../../../../src/websocket/lobby/lobbyLifecycle.js";

// Mock des dépendances
jest.mock("../../../../src/websocket/core/connectionManager.js");
jest.mock("../../../../src/websocket/lobby/lobbyLifecycle.js");
jest.mock("../../../../src/lib/database.js", () => ({
  prisma: {
    lobbyPlayer: {
      findMany: jest.fn(),
    },
  },
}));

const mockSendToUser = sendToUser as jest.MockedFunction<typeof sendToUser>;
const mockLobbyLifecycleManager = LobbyLifecycleManager as jest.Mocked<
  typeof LobbyLifecycleManager
>;
const mockPrisma = require("../../../../src/lib/database.js").prisma;

describe("BroadcastManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("broadcastLobbyUpdate", () => {
    it("devrait diffuser une mise à jour du lobby à tous les joueurs", async () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map([["player1", { status: "ready", score: 100 }]]),
        hostId: "player1",
        settings: { totalQuestions: 10 },
        status: "waiting",
      };

      const mockPlayers = [
        {
          user: { id: "player1", name: "Player 1" },
          status: "ready",
          score: 100,
          progress: 50,
          validatedCountries: ["France"],
          incorrectCountries: [],
        },
      ];

      mockPrisma.lobbyPlayer.findMany.mockResolvedValue(mockPlayers);

      await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobbyData);

      expect(mockPrisma.lobbyPlayer.findMany).toHaveBeenCalledWith({
        where: { lobbyId },
        include: {
          user: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "lobby_update",
        payload: {
          lobbyId,
          players: [
            {
              id: "player1",
              name: "Player 1",
              status: "ready",
              score: 100,
              progress: 50,
              validatedCountries: ["France"],
              incorrectCountries: [],
            },
          ],
          hostId: "player1",
          settings: { totalQuestions: 10 },
          status: "waiting",
        },
      });
    });

    it("devrait gérer les joueurs sans données en mémoire", async () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map(),
        hostId: "player1",
        settings: { totalQuestions: 10 },
        status: "waiting",
      };

      const mockPlayers = [
        {
          user: { id: "player1", name: "Player 1" },
          status: "ready",
          score: null,
          progress: null,
          validatedCountries: null,
          incorrectCountries: null,
        },
      ];

      mockPrisma.lobbyPlayer.findMany.mockResolvedValue(mockPlayers);

      await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobbyData);

      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "lobby_update",
        payload: {
          lobbyId,
          players: [
            {
              id: "player1",
              name: "Player 1",
              status: "ready",
              score: 0,
              progress: 0,
              validatedCountries: [],
              incorrectCountries: [],
            },
          ],
          hostId: "player1",
          settings: { totalQuestions: 10 },
          status: "waiting",
        },
      });
    });

    it("devrait gérer les erreurs de base de données", async () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map(),
        hostId: "player1",
        settings: { totalQuestions: 10 },
        status: "waiting",
      };

      mockPrisma.lobbyPlayer.findMany.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        BroadcastManager.broadcastLobbyUpdate(lobbyId, lobbyData)
      ).rejects.toThrow("Database error");
    });
  });

  describe("broadcastGameStart", () => {
    it("devrait diffuser le début d'une partie", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map([["player1", { status: "ready" }]]),
        gameState: {
          startTime: "2024-01-01T00:00:00.000Z",
          countries: ["France", "Germany"],
          settings: { totalQuestions: 10 },
        },
        settings: { totalQuestions: 10 },
      };

      BroadcastManager.broadcastGameStart(lobbyId, lobbyData);

      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "game_start",
        data: {
          lobbyId,
          startTime: "2024-01-01T00:00:00.000Z",
          totalQuestions: 10,
          settings: { totalQuestions: 10 },
          gameState: {
            startTime: "2024-01-01T00:00:00.000Z",
            settings: { totalQuestions: 10 },
          },
        },
      });
    });

    it("devrait utiliser les valeurs par défaut si gameState n'existe pas", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map([["player1", { status: "ready" }]]),
        settings: { totalQuestions: 15 },
      };

      BroadcastManager.broadcastGameStart(lobbyId, lobbyData);

      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "game_start",
        data: {
          lobbyId,
          startTime: expect.any(String),
          totalQuestions: 15,
          settings: { totalQuestions: 15 },
          gameState: {},
        },
      });
    });

    it("devrait gérer les cas où settings n'existe pas", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map([["player1", { status: "ready" }]]),
      };

      BroadcastManager.broadcastGameStart(lobbyId, lobbyData);

      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "game_start",
        data: {
          lobbyId,
          startTime: expect.any(String),
          totalQuestions: 10,
          settings: {},
          gameState: {},
        },
      });
    });
  });

  describe("broadcastPlayerProgressUpdate", () => {
    it("devrait diffuser une mise à jour de progression", async () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map([
          ["player1", { name: "Player 1", score: 100, progress: 50 }],
        ]),
      };

      const mockPlayers = [
        {
          user: { id: "player1", name: "Player 1" },
        },
      ];

      mockPrisma.lobbyPlayer.findMany.mockResolvedValue(mockPlayers);

      await BroadcastManager.broadcastPlayerProgressUpdate(lobbyId, lobbyData);

      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "update_player_progress",
        payload: {
          lobbyId,
          players: [
            {
              id: "player1",
              name: "Player 1",
              score: 100,
              progress: 50,
              validatedCountries: [],
              incorrectCountries: [],
            },
          ],
        },
      });
    });

    it("devrait gérer les erreurs de base de données", async () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map([["player1", { name: "Player 1" }]]),
      };

      mockPrisma.lobbyPlayer.findMany.mockRejectedValue(
        new Error("Database error")
      );

      await expect(
        BroadcastManager.broadcastPlayerProgressUpdate(lobbyId, lobbyData)
      ).rejects.toThrow("Database error");
    });
  });

  describe("broadcastGameEnd", () => {
    it("devrait diffuser la fin d'une partie", () => {
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        players: new Map([["player1", { status: "ready" }]]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      BroadcastManager.broadcastGameEnd(lobbyId);

      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "game_end",
        payload: { lobbyId },
      });
    });

    it("ne devrait rien faire si le lobby n'existe pas", () => {
      const lobbyId = "test-lobby-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      BroadcastManager.broadcastGameEnd(lobbyId);

      expect(mockSendToUser).not.toHaveBeenCalled();
    });
  });

  describe("broadcastScoreUpdate", () => {
    it("devrait diffuser une mise à jour de score", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map([
          ["player1", { name: "Player 1", score: 100, progress: 50 }],
          ["player2", { name: "Player 2", score: 80, progress: 30 }],
        ]),
      };
      const updatedPlayerId = "player1";

      BroadcastManager.broadcastScoreUpdate(
        lobbyId,
        lobbyData,
        updatedPlayerId
      );

      expect(mockSendToUser).toHaveBeenCalledTimes(2);
      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "update_player_progress",
        payload: {
          lobbyId,
          players: [
            { id: "player1", name: "Player 1", score: 100, progress: 50 },
            { id: "player2", name: "Player 2", score: 80, progress: 30 },
          ],
          updatedPlayerId,
        },
      });
    });

    it("devrait gérer les joueurs sans progression", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        players: new Map([["player1", { name: "Player 1", score: 100 }]]),
      };
      const updatedPlayerId = "player1";

      BroadcastManager.broadcastScoreUpdate(
        lobbyId,
        lobbyData,
        updatedPlayerId
      );

      expect(mockSendToUser).toHaveBeenCalledWith("player1", {
        type: "update_player_progress",
        payload: {
          lobbyId,
          players: [
            {
              id: "player1",
              name: "Player 1",
              score: 100,
              progress: undefined,
            },
          ],
          updatedPlayerId,
        },
      });
    });
  });

  describe("broadcastPlayerLeftGame", () => {
    it("devrait diffuser qu'un joueur a quitté la partie", () => {
      const lobbyId = "test-lobby-id";
      const playerId = "player1";
      const playerName = "Player 1";
      const mockLobby = {
        players: new Map([
          ["player1", { status: "ready" }],
          ["player2", { status: "ready" }],
        ]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      BroadcastManager.broadcastPlayerLeftGame(lobbyId, playerId, playerName);

      expect(mockSendToUser).toHaveBeenCalledWith("player2", {
        type: "player_left_game",
        payload: {
          lobbyId,
          playerId,
          playerName,
          timestamp: expect.any(Number),
        },
      });
    });

    it("ne devrait rien faire si le lobby n'existe pas", () => {
      const lobbyId = "test-lobby-id";
      const playerId = "player1";
      const playerName = "Player 1";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      BroadcastManager.broadcastPlayerLeftGame(lobbyId, playerId, playerName);

      expect(mockSendToUser).not.toHaveBeenCalled();
    });

    it("ne devrait pas envoyer de message au joueur qui quitte", () => {
      const lobbyId = "test-lobby-id";
      const playerId = "player1";
      const playerName = "Player 1";
      const mockLobby = {
        players: new Map([["player1", { status: "ready" }]]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      BroadcastManager.broadcastPlayerLeftGame(lobbyId, playerId, playerName);

      expect(mockSendToUser).not.toHaveBeenCalled();
    });
  });
});

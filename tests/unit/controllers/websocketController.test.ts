import {
  handleCreateLobby,
  handleGetGameResults,
  handleGetGameState,
  handleGetLobbyState,
  handleInviteToLobby,
  handleJoinLobby,
  handleLeaveGame,
  handleLeaveLobby,
  handleRemovePlayer,
  handleRespondFriendRequest,
  handleRestartGame,
  handleSendFriendRequest,
  handleSetPlayerReady,
  handleStartGame,
  handleUpdateLobbySettings,
  handleUpdatePlayerProgress,
  handleUpdatePlayerStatus,
} from "../../../src/controllers/websocketController.js";
import * as LobbyModel from "../../../src/models/lobbyModel.js";
import * as UserModel from "../../../src/models/userModel.js";
import { FriendService } from "../../../src/services/friendService.js";
import { GameService } from "../../../src/services/gameService.js";
import { LobbyService } from "../../../src/services/lobbyService.js";
import { PlayerService } from "../../../src/services/playerService.js";
import { sendToUser } from "../../../src/websocket/core/connectionManager.js";
import { BroadcastManager } from "../../../src/websocket/lobby/broadcastManager.js";
import { LobbyLifecycleManager } from "../../../src/websocket/lobby/lobbyLifecycle.js";

// Mock des services
jest.mock("../../../src/services/friendService.js");
jest.mock("../../../src/services/gameService.js");
jest.mock("../../../src/services/lobbyService.js");
jest.mock("../../../src/services/playerService.js");
jest.mock("../../../src/models/lobbyModel.js");
jest.mock("../../../src/models/userModel.js");
jest.mock("../../../src/websocket/core/connectionManager.js");
jest.mock("../../../src/websocket/lobby/broadcastManager.js");
jest.mock("../../../src/websocket/lobby/lobbyLifecycle.js");

const mockFriendService = FriendService as jest.Mocked<typeof FriendService>;
const mockGameService = GameService as jest.Mocked<typeof GameService>;
const mockLobbyService = LobbyService as jest.Mocked<typeof LobbyService>;
const mockPlayerService = PlayerService as jest.Mocked<typeof PlayerService>;
const mockLobbyModel = LobbyModel as jest.Mocked<typeof LobbyModel>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockSendToUser = sendToUser as jest.MockedFunction<typeof sendToUser>;
const mockBroadcastManager = BroadcastManager as jest.Mocked<
  typeof BroadcastManager
>;
const mockLobbyLifecycleManager = LobbyLifecycleManager as jest.Mocked<
  typeof LobbyLifecycleManager
>;

describe("WebSocketController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("handleSendFriendRequest", () => {
    it("devrait envoyer une demande d'ami avec succès", async () => {
      const payload = { receiverTag: "friend-tag" };
      const userId = "user-id";
      const mockResult = {
        success: true,
        message: "Demande envoyée",
        receiverId: "friend-id",
      };
      mockFriendService.sendFriendRequest.mockResolvedValue(mockResult);

      const result = await handleSendFriendRequest(payload, userId);

      expect(mockFriendService.sendFriendRequest).toHaveBeenCalledWith(
        userId,
        "friend-tag"
      );
      expect(result).toEqual(mockResult);
    });

    it("devrait échouer si receiverTag est manquant", async () => {
      const payload = {};
      const userId = "user-id";

      await expect(handleSendFriendRequest(payload, userId)).rejects.toThrow(
        "receiverTag requis"
      );
    });
  });

  describe("handleRespondFriendRequest", () => {
    it("devrait répondre à une demande d'ami avec succès", async () => {
      const payload = { requestId: "req-id", action: "accept" };
      const userId = "user-id";
      const mockResult = { success: true, message: "Demande acceptée" };
      mockFriendService.respondToFriendRequest.mockResolvedValue(mockResult);

      const result = await handleRespondFriendRequest(payload, userId);

      expect(mockFriendService.respondToFriendRequest).toHaveBeenCalledWith(
        "req-id",
        "accept",
        userId
      );
      expect(result).toEqual(mockResult);
    });

    it("devrait échouer si requestId ou action est manquant", async () => {
      const payload = { requestId: "req-id" };
      const userId = "user-id";

      await expect(handleRespondFriendRequest(payload, userId)).rejects.toThrow(
        "requestId et action requis"
      );
    });
  });

  describe("handleCreateLobby", () => {
    it("devrait créer un lobby avec succès", async () => {
      const payload = { name: "Test Lobby", settings: { maxPlayers: 4 } };
      const userId = "user-id";
      const mockResult = {
        success: true,
        lobbyId: "lobby-id",
        hostId: userId,
        settings: { maxPlayers: 4 },
        players: [{ name: "Test User" }],
      };
      mockLobbyService.createLobby.mockResolvedValue(mockResult);

      const result = await handleCreateLobby(payload, userId);

      expect(mockLobbyService.createLobby).toHaveBeenCalledWith(
        userId,
        "Test Lobby",
        { maxPlayers: 4 }
      );
      expect(mockLobbyLifecycleManager.createLobby).toHaveBeenCalledWith(
        "lobby-id",
        userId,
        "Test User",
        { maxPlayers: 4 }
      );
      expect(result).toEqual(mockResult);
    });

    it("devrait gérer les erreurs lors de la création", async () => {
      const payload = { name: "Test Lobby", settings: { maxPlayers: 4 } };
      const userId = "user-id";
      mockLobbyService.createLobby.mockRejectedValue(
        new Error("Erreur de création")
      );

      const result = await handleCreateLobby(payload, userId);

      expect(result.success).toBe(false);
      expect(result.message).toBe("Erreur de création");
    });
  });

  describe("handleInviteToLobby", () => {
    it("devrait inviter un ami au lobby", async () => {
      const payload = { lobbyId: "lobby-id", friendId: "friend-id" };
      const userId = "user-id";
      const mockResult = { success: true, message: "Invitation envoyée" };
      mockLobbyService.inviteToLobby.mockResolvedValue(mockResult);

      const result = await handleInviteToLobby(payload, userId);

      expect(mockLobbyService.inviteToLobby).toHaveBeenCalledWith(
        userId,
        "lobby-id",
        "friend-id"
      );
      expect(result).toEqual(mockResult);
    });
  });

  describe("handleJoinLobby", () => {
    it("devrait rejoindre un lobby existant en mémoire", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map(),
        addPlayer: jest.fn(),
      };
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await handleJoinLobby(payload, userId);

      expect(mockLobbyLifecycleManager.getLobbyInMemory).toHaveBeenCalledWith(
        "lobby-id"
      );
      expect(result.success).toBe(true);
    });

    it("devrait restaurer un lobby depuis la DB si pas en mémoire", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobbyFromDB = {
        id: "lobby-id",
        name: "Test Lobby",
        hostId: "host-id",
        status: "waiting",
        settings: {},
        authorizedPlayers: [],
        gameState: null,
        host: {
          id: "host-id",
          name: "Host",
          tag: "host-tag",
        },
        players: [],
      } as any;
      const mockLobby = {
        id: "lobby-id",
        players: new Map(),
        addPlayer: jest.fn(),
      };

      mockLobbyLifecycleManager.getLobbyInMemory
        .mockReturnValueOnce(null)
        .mockReturnValueOnce(mockLobby);
      mockLobbyService.getLobby.mockResolvedValue(mockLobbyFromDB);

      const result = await handleJoinLobby(payload, userId);

      expect(mockLobbyService.getLobby).toHaveBeenCalledWith("lobby-id");
      expect(
        mockLobbyLifecycleManager.restoreLobbyFromDatabase
      ).toHaveBeenCalledWith("lobby-id", mockLobbyFromDB);
      expect(result.success).toBe(true);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const payload = { lobbyId: "invalid-lobby" };
      const userId = "user-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);
      mockLobbyService.getLobby.mockResolvedValue(null);

      const result = await handleJoinLobby(payload, userId);

      expect(result.success).toBe(false);
    });
  });

  describe("handleLeaveLobby", () => {
    it("devrait quitter un lobby avec succès", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: "host-id",
        players: new Map([[userId, { status: "joined" }]]),
        removePlayer: jest.fn(),
        getPlayerCount: jest.fn().mockReturnValue(0),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockUserModel.findUserById.mockResolvedValue({
        name: "Test User",
      } as any);
      mockLobbyModel.removePlayerFromLobby.mockResolvedValue({} as any);

      const result = await handleLeaveLobby(payload, userId);

      expect(mockLobbyModel.removePlayerFromLobby).toHaveBeenCalledWith(
        "lobby-id",
        userId
      );
      expect(result.success).toBe(true);
    });

    it("devrait échouer si lobbyId est manquant", async () => {
      const payload = {};
      const userId = "user-id";

      await expect(handleLeaveLobby(payload, userId)).rejects.toThrow(
        "lobbyId requis"
      );
    });

    it("devrait gérer le cas où l'utilisateur n'existe pas", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: "host-id",
        players: new Map([[userId, { status: "joined" }]]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockUserModel.findUserById.mockResolvedValue(null);
      mockLobbyModel.removePlayerFromLobby.mockResolvedValue({} as any);

      const result = await handleLeaveLobby(payload, userId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Lobby quitté");
    });

    it("devrait gérer le cas où le lobby n'est pas en mémoire", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);
      mockUserModel.findUserById.mockResolvedValue({
        name: "Test User",
      } as any);
      mockLobbyModel.removePlayerFromLobby.mockResolvedValue({} as any);

      const result = await handleLeaveLobby(payload, userId);

      expect(result.success).toBe(true);
      expect(result.message).toBe("Lobby quitté");
    });

    it("devrait transférer l'hôte si l'hôte quitte le lobby", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "host-id";
      const otherUserId = "other-user-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
        players: new Map([
          [userId, { status: "joined" }],
          [otherUserId, { status: "joined" }],
        ]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockUserModel.findUserById.mockResolvedValue({
        name: "Host User",
      } as any);
      mockLobbyModel.removePlayerFromLobby.mockResolvedValue({} as any);
      mockLobbyModel.updateLobbyHost.mockResolvedValue({} as any);

      const result = await handleLeaveLobby(payload, userId);

      expect(mockLobbyModel.updateLobbyHost).toHaveBeenCalledWith(
        "lobby-id",
        otherUserId
      );
      expect(result.success).toBe(true);
    });

    it("devrait supprimer le lobby si plus de joueurs", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
        players: new Map([[userId, { status: "joined" }]]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockUserModel.findUserById.mockResolvedValue({
        name: "Test User",
      } as any);
      mockLobbyModel.removePlayerFromLobby.mockResolvedValue({} as any);

      const result = await handleLeaveLobby(payload, userId);

      expect(
        mockLobbyLifecycleManager.scheduleLobbyDeletion
      ).toHaveBeenCalledWith("lobby-id");
      expect(result.success).toBe(true);
    });

    it("devrait gérer les erreurs lors de la sortie du lobby", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyModel.removePlayerFromLobby.mockRejectedValue(
        new Error("Erreur de base de données")
      );

      await expect(handleLeaveLobby(payload, userId)).rejects.toThrow(
        "Impossible de quitter le lobby: Erreur de base de données"
      );
    });
  });

  describe("handleUpdateLobbySettings", () => {
    it("devrait mettre à jour les paramètres du lobby", async () => {
      const payload = { lobbyId: "lobby-id", settings: { maxPlayers: 6 } };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
        updateSettings: jest.fn(),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updateLobbySettings.mockResolvedValue(true);

      const result = await handleUpdateLobbySettings(payload, userId);

      expect(mockLobbyService.updateLobbySettings).toHaveBeenCalledWith(
        userId,
        "lobby-id",
        { maxPlayers: 6 }
      );
      expect(result.success).toBe(true);
    });

    it("devrait gérer le cas où la mise à jour échoue", async () => {
      const payload = { lobbyId: "lobby-id", settings: { maxPlayers: 6 } };
      const userId = "user-id";

      mockLobbyService.updateLobbySettings.mockResolvedValue(false);

      const result = await handleUpdateLobbySettings(payload, userId);

      expect(result.success).toBe(false);
    });

    it("devrait gérer le cas où le lobby n'est pas en mémoire", async () => {
      const payload = { lobbyId: "lobby-id", settings: { maxPlayers: 6 } };
      const userId = "user-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);
      mockLobbyService.updateLobbySettings.mockResolvedValue(true);

      const result = await handleUpdateLobbySettings(payload, userId);

      expect(result.success).toBe(true);
    });
  });

  describe("handleSetPlayerReady", () => {
    it("devrait définir un joueur comme prêt", async () => {
      const payload = { lobbyId: "lobby-id", ready: true };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map([[userId, { status: "joined" }]]),
        updatePlayerStatus: jest.fn(),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updatePlayerStatus.mockResolvedValue(true);

      const result = await handleSetPlayerReady(payload, userId);

      expect(mockLobbyService.updatePlayerStatus).toHaveBeenCalledWith(
        "lobby-id",
        userId,
        "ready"
      );
      expect(result.success).toBe(true);
    });

    it("devrait définir un joueur comme non prêt", async () => {
      const payload = { lobbyId: "lobby-id", ready: false };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map([[userId, { status: "ready" }]]),
        updatePlayerStatus: jest.fn(),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updatePlayerStatus.mockResolvedValue(true);

      const result = await handleSetPlayerReady(payload, userId);

      expect(mockLobbyService.updatePlayerStatus).toHaveBeenCalledWith(
        "lobby-id",
        userId,
        "joined"
      );
      expect(result.success).toBe(true);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const payload = { lobbyId: "lobby-id", ready: true };
      const userId = "user-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await handleSetPlayerReady(payload, userId);

      expect(result.success).toBe(false);
    });

    it("devrait échouer si le joueur n'est pas dans le lobby", async () => {
      const payload = { lobbyId: "lobby-id", ready: true };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map(), // Joueur pas dans le lobby
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await handleSetPlayerReady(payload, userId);

      expect(result.success).toBe(false);
    });
  });

  describe("handleStartGame", () => {
    it("devrait démarrer une partie", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockGameService.startGame.mockResolvedValue(true);

      const result = await handleStartGame(payload, userId);

      expect(mockGameService.startGame).toHaveBeenCalledWith("lobby-id");
      expect(result.success).toBe(true);
    });

    it("devrait gérer l'échec du démarrage de partie", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockGameService.startGame.mockResolvedValue(false);

      const result = await handleStartGame(payload, userId);

      expect(result.success).toBe(false);
    });
  });

  describe("handleUpdatePlayerProgress", () => {
    it("devrait mettre à jour le progrès d'un joueur", async () => {
      const payload = {
        lobbyId: "lobby-id",
        score: 100,
        progress: 50,
        validatedCountries: ["France"],
        incorrectCountries: ["Spain"],
        totalQuestions: 10,
      };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map([[userId, { status: "playing" }]]),
      };

      mockGameService.updatePlayerProgress.mockResolvedValue(true);
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await handleUpdatePlayerProgress(payload, userId);

      expect(mockGameService.updatePlayerProgress).toHaveBeenCalledWith(
        "lobby-id",
        userId,
        ["France"],
        ["Spain"],
        100,
        10
      );
      expect(result.success).toBe(true);
    });

    it("devrait gérer l'échec de la mise à jour du progrès", async () => {
      const payload = {
        lobbyId: "lobby-id",
        score: 100,
        progress: 50,
        validatedCountries: ["France"],
        incorrectCountries: ["Spain"],
        totalQuestions: 10,
      };
      const userId = "user-id";

      mockGameService.updatePlayerProgress.mockResolvedValue(false);

      const result = await handleUpdatePlayerProgress(payload, userId);

      expect(result.success).toBe(false);
    });

    it("devrait gérer le cas où le lobby n'est pas en mémoire", async () => {
      const payload = {
        lobbyId: "lobby-id",
        score: 100,
        progress: 50,
        validatedCountries: ["France"],
        incorrectCountries: ["Spain"],
        totalQuestions: 10,
      };
      const userId = "user-id";

      mockGameService.updatePlayerProgress.mockResolvedValue(true);
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await handleUpdatePlayerProgress(payload, userId);

      expect(result.success).toBe(true);
    });
  });

  describe("handleRestartGame", () => {
    it("devrait redémarrer une partie", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "host-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
        players: new Map([
          [userId, { status: "playing" }],
          ["other-user", { status: "playing" }],
        ]),
      };

      mockLobbyService.getLobby.mockResolvedValue(mockLobby as any);
      mockGameService.restartLobby.mockResolvedValue(true);
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await handleRestartGame(payload, userId);

      expect(mockLobbyService.getLobby).toHaveBeenCalledWith("lobby-id");
      expect(mockGameService.restartLobby).toHaveBeenCalledWith("lobby-id");
      expect(result.success).toBe(true);
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: "host-id", // Différent de userId
      };

      mockLobbyService.getLobby.mockResolvedValue(mockLobby as any);

      await expect(handleRestartGame(payload, userId)).rejects.toThrow(
        "Seul l'hôte peut redémarrer la partie"
      );
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyService.getLobby.mockResolvedValue(null);

      await expect(handleRestartGame(payload, userId)).rejects.toThrow(
        "Seul l'hôte peut redémarrer la partie"
      );
    });

    it("devrait gérer l'échec du redémarrage", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "host-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
      };

      mockLobbyService.getLobby.mockResolvedValue(mockLobby as any);
      mockGameService.restartLobby.mockResolvedValue(false);

      const result = await handleRestartGame(payload, userId);

      expect(result.success).toBe(false);
    });
  });

  describe("handleLeaveGame", () => {
    it("devrait quitter une partie", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map([[userId, { status: "playing" }]]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await handleLeaveGame(payload, userId);

      expect(result.success).toBe(true);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await handleLeaveGame(payload, userId);

      expect(result.success).toBe(false);
    });
  });

  describe("handleRemovePlayer", () => {
    it("devrait supprimer un joueur du lobby", async () => {
      const payload = { lobbyId: "lobby-id", playerId: "player-id" };
      const userId = "host-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
        players: new Map([
          [userId, { status: "playing" }],
          ["player-id", { status: "playing" }],
        ]),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.getLobby.mockResolvedValue(mockLobby as any);
      mockLobbyModel.removePlayerFromLobby.mockResolvedValue({} as any);
      mockLobbyModel.updateLobbyAuthorizedPlayers.mockResolvedValue({} as any);

      const result = await handleRemovePlayer(payload, userId);

      expect(mockLobbyModel.removePlayerFromLobby).toHaveBeenCalledWith(
        "lobby-id",
        "player-id"
      );
      expect(result.lobbyId).toBe("lobby-id");
      expect(result.playerId).toBe("player-id");
      expect(result.message).toBe("Joueur supprimé avec succès");
    });

    it("devrait échouer si lobbyId est manquant", async () => {
      const payload = { playerId: "player-id" };
      const userId = "user-id";

      await expect(handleRemovePlayer(payload, userId)).rejects.toThrow(
        "lobbyId requis"
      );
    });

    it("devrait échouer si playerId est manquant", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      await expect(handleRemovePlayer(payload, userId)).rejects.toThrow(
        "playerId requis"
      );
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const payload = { lobbyId: "lobby-id", playerId: "player-id" };
      const userId = "host-id";

      mockLobbyService.getLobby.mockResolvedValue(null);

      await expect(handleRemovePlayer(payload, userId)).rejects.toThrow(
        "Lobby non trouvé"
      );
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      const payload = { lobbyId: "lobby-id", playerId: "player-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: "host-id", // Différent de userId
      };

      mockLobbyService.getLobby.mockResolvedValue(mockLobby as any);

      await expect(handleRemovePlayer(payload, userId)).rejects.toThrow(
        "Seul l'hôte peut supprimer des joueurs"
      );
    });

    it("devrait échouer si l'hôte essaie de se supprimer lui-même", async () => {
      const payload = { lobbyId: "lobby-id", playerId: "host-id" };
      const userId = "host-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
      };

      mockLobbyService.getLobby.mockResolvedValue(mockLobby as any);

      await expect(handleRemovePlayer(payload, userId)).rejects.toThrow(
        "L'hôte ne peut pas se supprimer lui-même"
      );
    });

    it("devrait gérer les erreurs lors de la suppression", async () => {
      const payload = { lobbyId: "lobby-id", playerId: "player-id" };
      const userId = "host-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
      };

      mockLobbyService.getLobby.mockResolvedValue(mockLobby as any);
      mockLobbyModel.removePlayerFromLobby.mockRejectedValue(
        new Error("Erreur de base de données")
      );

      await expect(handleRemovePlayer(payload, userId)).rejects.toThrow(
        "Impossible de supprimer le joueur: Erreur de base de données"
      );
    });
  });

  describe("handleUpdatePlayerStatus", () => {
    it("devrait mettre à jour le statut d'un joueur", async () => {
      const payload = {
        lobbyId: "lobby-id",
        playerId: "player-id",
        status: "ready",
      };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        hostId: userId,
        players: new Map([[userId, { status: "joined" }]]),
        updatePlayerStatus: jest.fn(),
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.updatePlayerStatus.mockResolvedValue(true);

      const result = await handleUpdatePlayerStatus(payload, userId);

      expect(mockLobbyService.updatePlayerStatus).toHaveBeenCalledWith(
        "lobby-id",
        userId,
        "ready"
      );
      expect(result.success).toBe(true);
    });
  });

  describe("handleGetLobbyState", () => {
    it("devrait récupérer l'état du lobby", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobbyState = {
        id: "lobby-id",
        players: [],
        host: { id: "host-id", name: "Host" },
      } as any;

      mockLobbyService.getLobby.mockResolvedValue(mockLobbyState);

      const result = await handleGetLobbyState(payload, userId);

      expect(mockLobbyService.getLobby).toHaveBeenCalledWith("lobby-id");
      expect(result.lobbyState).toEqual(mockLobbyState);
    });

    it("devrait échouer si lobbyId est manquant", async () => {
      const payload = {};
      const userId = "user-id";

      await expect(handleGetLobbyState(payload, userId)).rejects.toThrow(
        "lobbyId requis"
      );
    });

    it("devrait gérer les erreurs de récupération du lobby", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyService.getLobby.mockRejectedValue(
        new Error("Lobby non trouvé")
      );

      await expect(handleGetLobbyState(payload, userId)).rejects.toThrow(
        "Lobby non trouvé"
      );
    });

    it("devrait gérer les erreurs d'autorisation", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyService.getLobby.mockRejectedValue(
        new Error("Vous n'êtes pas autorisé à accéder à ce lobby")
      );

      await expect(handleGetLobbyState(payload, userId)).rejects.toThrow(
        "Vous n'êtes pas autorisé à accéder à ce lobby"
      );
    });

    it("devrait gérer les erreurs génériques", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyService.getLobby.mockRejectedValue(
        new Error("Erreur de base de données")
      );

      await expect(handleGetLobbyState(payload, userId)).rejects.toThrow(
        "Erreur de base de données"
      );
    });
  });

  describe("handleGetGameResults", () => {
    it("devrait récupérer les résultats du jeu", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockResults = [
        { id: "player1", name: "Player 1", score: 100, rank: 1 },
        { id: "player2", name: "Player 2", score: 80, rank: 2 },
      ];

      mockLobbyService.getGameResults.mockResolvedValue({
        rankings: mockResults,
        hostId: "host-id",
      });

      const result = await handleGetGameResults(payload, userId);

      expect(mockLobbyService.getGameResults).toHaveBeenCalledWith(
        "lobby-id",
        userId
      );
      expect(result.rankings).toEqual(mockResults);
      expect(result.hostId).toBe("host-id");
    });

    it("devrait échouer si lobbyId est manquant", async () => {
      const payload = {};
      const userId = "user-id";

      await expect(handleGetGameResults(payload, userId)).rejects.toThrow(
        "lobbyId requis"
      );
    });

    it("devrait gérer les erreurs de récupération des résultats", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyService.getGameResults.mockRejectedValue(
        new Error("Erreur de base de données")
      );

      await expect(handleGetGameResults(payload, userId)).rejects.toThrow(
        "Impossible de récupérer les résultats: Erreur de base de données"
      );
    });

    it("devrait gérer les erreurs non-Error", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyService.getGameResults.mockRejectedValue("Erreur string");

      await expect(handleGetGameResults(payload, userId)).rejects.toThrow(
        "Impossible de récupérer les résultats: Erreur inconnue"
      );
    });
  });

  describe("handleGetGameState", () => {
    it("devrait récupérer l'état du jeu", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        gameState: { currentQuestion: 1, startTime: "2023-01-01" },
        players: new Map([[userId, { status: "playing" }]]),
        hostId: "host-id",
        status: "playing",
        settings: {},
        getGameState: jest
          .fn()
          .mockReturnValue({ currentQuestion: 1, startTime: "2023-01-01" }),
      };

      const mockLobbyFromDB = {
        id: "lobby-id",
        players: [
          {
            userId: userId,
            user: { name: "Test User" },
            status: "playing",
            score: 0,
            progress: 0,
            validatedCountries: [],
            incorrectCountries: [],
          },
        ],
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.getLobby.mockResolvedValue(mockLobbyFromDB as any);

      const result = await handleGetGameState(payload, userId);

      expect(result.gameState).toBeDefined();
      expect(result.gameState.lobbyId).toBe("lobby-id");
      expect(result.gameState.players).toBeDefined();
    });

    it("devrait gérer le cas où le lobby n'est pas en mémoire", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      const result = await handleGetGameState(payload, userId);

      expect(result.gameState).toBeNull();
    });

    it("devrait gérer le cas où l'utilisateur n'est pas dans le lobby", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map(), // Utilisateur pas dans le lobby
        hostId: "host-id",
        status: "playing",
        settings: {},
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);

      const result = await handleGetGameState(payload, userId);

      expect(result.gameState).toBeNull();
    });

    it("devrait gérer le cas où le lobby n'existe pas en base de données", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map([[userId, { status: "playing" }]]),
        hostId: "host-id",
        status: "playing",
        settings: {},
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.getLobby.mockResolvedValue(null);

      const result = await handleGetGameState(payload, userId);

      expect(result.gameState).toBeNull();
    });

    it("devrait fusionner correctement les données mémoire et base de données", async () => {
      const payload = { lobbyId: "lobby-id" };
      const userId = "user-id";
      const mockLobby = {
        id: "lobby-id",
        players: new Map([
          [
            userId,
            {
              status: "playing",
              score: 100,
              progress: 50,
            },
          ],
        ]),
        hostId: "host-id",
        status: "playing",
        settings: { gameMode: "quiz" },
        gameState: { startTime: "2023-01-01" },
      };

      const mockLobbyFromDB = {
        id: "lobby-id",
        players: [
          {
            userId: userId,
            user: { name: "Test User" },
            status: "ready",
            score: 0,
            progress: 0,
            validatedCountries: ["FR", "DE"],
            incorrectCountries: ["IT"],
          },
        ],
      };

      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(mockLobby);
      mockLobbyService.getLobby.mockResolvedValue(mockLobbyFromDB as any);

      const result = await handleGetGameState(payload, userId);

      expect(result.gameState).toBeDefined();
      expect(result.gameState.players).toHaveLength(1);
      expect(result.gameState.players[0].id).toBe(userId);
      expect(result.gameState.players[0].name).toBe("Test User");
      expect(result.gameState.players[0].status).toBe("playing"); // Status de la mémoire
      expect(result.gameState.players[0].score).toBe(0); // Score de la DB
      expect(result.gameState.players[0].progress).toBe(0); // Progress de la DB
      expect(result.gameState.players[0].validatedCountries).toEqual([
        "FR",
        "DE",
      ]);
      expect(result.gameState.players[0].incorrectCountries).toEqual(["IT"]);
    });
  });
});

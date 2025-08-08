import * as LobbyModel from "../../../src/models/lobbyModel.js";
import * as UserModel from "../../../src/models/userModel.js";
import { LobbyService } from "../../../src/services/lobbyService.js";
import { sendToUser } from "../../../src/websocket/core/connectionManager.js";
import { LobbyLifecycleManager } from "../../../src/websocket/lobby/lobbyLifecycle.js";

// Mock des modules
jest.mock("../../../src/models/lobbyModel.js");
jest.mock("../../../src/models/userModel.js");
jest.mock("../../../src/websocket/core/connectionManager.js");
jest.mock("../../../src/websocket/lobby/lobbyLifecycle.js");

const mockLobbyModel = LobbyModel as jest.Mocked<typeof LobbyModel>;
const mockUserModel = UserModel as jest.Mocked<typeof UserModel>;
const mockSendToUser = sendToUser as jest.MockedFunction<typeof sendToUser>;
const mockLobbyLifecycleManager = LobbyLifecycleManager as jest.Mocked<
  typeof LobbyLifecycleManager
>;

// Données de test communes
const createMockUser = (id: string, name: string) => ({
  id,
  name,
  image: null,
  tag: `${name}-tag`,
  isOnline: true,
  lastSeen: new Date(),
  createdAt: new Date(),
  updatedAt: new Date(),
  email: `${name}@example.com`,
  emailVerified: false,
});

const createMockLobby = (id: string, hostId: string, name: string) => ({
  id,
  name,
  hostId,
  gameSettings: { maxPlayers: 4 },
  host: createMockUser(hostId, "Test User"),
  players: [],
  createdAt: new Date(),
  updatedAt: new Date(),
  status: "waiting",
  gameState: null,
  authorizedPlayers: [],
});

describe("LobbyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createLobby", () => {
    it("devrait créer un lobby avec validation complète de la logique métier", async () => {
      const hostId = "test-host-id";
      const lobbyName = "Test Lobby";
      const settings = { maxPlayers: 4 };

      const mockUser = createMockUser(hostId, "Test User");
      const mockLobby = createMockLobby("test-lobby-id", hostId, lobbyName);

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockLobbyModel.createLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.createLobby(
        hostId,
        lobbyName,
        settings
      );

      // Validation métier complète
      expect(result.success).toBe(true);
      expect(result.lobbyId).toBe("test-lobby-id");
      expect(result.hostId).toBe(hostId);
      expect(result.settings).toEqual(settings);
      expect(result.lobby).toEqual(mockLobby);
      expect(result.players).toEqual([
        {
          id: hostId,
          name: "Test User",
          status: "joined",
        },
      ]);
      expect(mockLobbyModel.createLobby).toHaveBeenCalledWith(
        hostId,
        lobbyName,
        settings
      );
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      const result = await LobbyService.createLobby(
        "non-existent-user",
        "Test Lobby"
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Utilisateur non trouvé");
      expect(result.lobbyId).toBe("");
      expect(result.hostId).toBe("");
      expect(mockLobbyModel.createLobby).not.toHaveBeenCalled();
    });

    it("devrait utiliser le nom de l'utilisateur si aucun nom n'est fourni", async () => {
      const hostId = "test-host-id";
      const mockUser = createMockUser(hostId, "Test User");
      const mockLobby = createMockLobby(
        "test-lobby-id",
        hostId,
        "Lobby de Test User"
      );

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockLobbyModel.createLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.createLobby(hostId, "", {
        maxPlayers: 4,
      });

      expect(result.success).toBe(true);
      expect(mockLobbyModel.createLobby).toHaveBeenCalledWith(
        hostId,
        "Lobby de Test User",
        { maxPlayers: 4 }
      );
    });

    it("devrait gérer les erreurs de base de données", async () => {
      const mockUser = createMockUser("test-host-id", "Test User");
      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockLobbyModel.createLobby.mockRejectedValue(new Error("Database error"));

      const result = await LobbyService.createLobby(
        "test-host-id",
        "Test Lobby"
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Database error");
    });
  });

  describe("getLobby", () => {
    it("devrait récupérer un lobby existant", async () => {
      const mockLobby = createMockLobby(
        "test-lobby-id",
        "test-host-id",
        "Test Lobby"
      );
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.getLobby("test-lobby-id");

      expect(mockLobbyModel.getLobby).toHaveBeenCalledWith("test-lobby-id");
      expect(result).toEqual(mockLobby);
    });

    it("devrait retourner null si le lobby n'existe pas", async () => {
      mockLobbyModel.getLobby.mockResolvedValue(null);

      const result = await LobbyService.getLobby("non-existent-lobby");

      expect(result).toBeNull();
    });
  });

  describe("inviteToLobby", () => {
    it("devrait inviter un ami au lobby avec notification", async () => {
      const lobbyId = "test-lobby-id";
      const hostId = "host-id";
      const friendId = "friend-id";

      const mockLobby = createMockLobby(lobbyId, hostId, "Test Lobby");

      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);
      mockLobbyModel.getPlayerInLobby.mockResolvedValue(null);
      mockLobbyModel.addAuthorizedPlayer.mockResolvedValue({} as any);

      const result = await LobbyService.inviteToLobby(
        hostId,
        lobbyId,
        friendId
      );

      // Validation métier complète
      expect(result.success).toBe(true);
      expect(result.message).toBe("Invitation envoyée");
      expect(mockLobbyModel.getLobby).toHaveBeenCalledWith(lobbyId);
      expect(mockLobbyModel.getPlayerInLobby).toHaveBeenCalledWith(
        lobbyId,
        friendId
      );
      expect(mockLobbyModel.addAuthorizedPlayer).toHaveBeenCalledWith(
        lobbyId,
        friendId
      );
      expect(mockSendToUser).toHaveBeenCalledWith(friendId, {
        type: "lobby_invitation",
        payload: {
          lobbyId,
          hostId,
          hostName: mockLobby.host.name,
          lobbyName: mockLobby.name,
        },
      });
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      const mockLobby = createMockLobby(
        "test-lobby-id",
        "other-user-id",
        "Test Lobby"
      );
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      await expect(
        LobbyService.inviteToLobby("user-id", "test-lobby-id", "friend-id")
      ).rejects.toThrow("Non autorisé à inviter des joueurs dans ce lobby");
    });

    it("devrait gérer le cas où le joueur est déjà dans le lobby", async () => {
      const lobbyId = "test-lobby-id";
      const hostId = "host-id";
      const friendId = "friend-id";

      const mockLobby = createMockLobby(lobbyId, hostId, "Test Lobby");

      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);
      mockLobbyModel.getPlayerInLobby.mockResolvedValue({
        userId: friendId,
        status: "joined",
      } as any);

      const result = await LobbyService.inviteToLobby(
        hostId,
        lobbyId,
        friendId
      );

      expect(result.success).toBe(true);
      expect(result.message).toBe("Joueur déjà dans le lobby");
      expect(mockLobbyModel.addAuthorizedPlayer).not.toHaveBeenCalled();
      expect(mockSendToUser).not.toHaveBeenCalled();
    });
  });

  describe("updatePlayerProgress", () => {
    it("devrait calculer correctement la progression avec validation métier", async () => {
      const lobbyId = "test-lobby-id";
      const playerId = "player-id";
      const validatedCountries = ["France", "Germany"];
      const incorrectCountries = ["Spain"];
      const score = 150;
      const totalQuestions = 10;

      mockLobbyModel.updatePlayerGameData.mockResolvedValue({} as any);

      const result = await LobbyService.updatePlayerProgress(
        lobbyId,
        playerId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions
      );

      // Validation métier : calcul de progression
      const expectedProgress =
        ((validatedCountries.length + incorrectCountries.length) /
          totalQuestions) *
        100;
      expect(result).toBe(true);
      expect(mockLobbyModel.updatePlayerGameData).toHaveBeenCalledWith(
        lobbyId,
        playerId,
        score,
        Math.min(expectedProgress, 100),
        validatedCountries,
        incorrectCountries
      );
    });

    it("devrait gérer le cas où totalQuestions est 0", async () => {
      const lobbyId = "test-lobby-id";
      const playerId = "player-id";

      mockLobbyModel.updatePlayerGameData.mockResolvedValue({} as any);

      const result = await LobbyService.updatePlayerProgress(
        lobbyId,
        playerId,
        ["France"],
        [],
        100,
        0
      );

      expect(result).toBe(true);
      expect(mockLobbyModel.updatePlayerGameData).toHaveBeenCalledWith(
        lobbyId,
        playerId,
        100,
        0, // Progression = 0 quand totalQuestions = 0
        ["France"],
        []
      );
    });

    it("devrait limiter la progression à 100%", async () => {
      const lobbyId = "test-lobby-id";
      const playerId = "player-id";
      const validatedCountries = ["France", "Germany", "Italy"];
      const incorrectCountries = ["Spain"];
      const score = 200;
      const totalQuestions = 2; // Progression > 100%

      mockLobbyModel.updatePlayerGameData.mockResolvedValue({} as any);

      const result = await LobbyService.updatePlayerProgress(
        lobbyId,
        playerId,
        validatedCountries,
        incorrectCountries,
        score,
        totalQuestions
      );

      expect(result).toBe(true);
      expect(mockLobbyModel.updatePlayerGameData).toHaveBeenCalledWith(
        lobbyId,
        playerId,
        score,
        100, // Limité à 100%
        validatedCountries,
        incorrectCountries
      );
    });

    it("devrait gérer les erreurs de base de données", async () => {
      mockLobbyModel.updatePlayerGameData.mockRejectedValue(
        new Error("Database error")
      );

      const result = await LobbyService.updatePlayerProgress(
        "test-lobby-id",
        "player-id",
        ["France"],
        [],
        100,
        10
      );

      expect(result).toBe(false);
    });
  });

  describe("getGameResults", () => {
    it("devrait récupérer et calculer les résultats avec classement", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "player1";

      const mockPlayer = {
        userId: "player1",
        status: "finished",
        score: 100,
        user: { name: "Player 1" },
      } as any;

      const mockLobby = {
        id: lobbyId,
        hostId: "host-id",
        status: "finished",
        players: [
          { userId: "player1", score: 100, user: { name: "Player 1" } },
          { userId: "player2", score: 150, user: { name: "Player 2" } },
          { userId: "player3", score: 80, user: { name: "Player 3" } },
        ],
      } as any;

      mockLobbyModel.getPlayerInLobby.mockResolvedValue(mockPlayer);
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.getGameResults(lobbyId, userId);

      // Validation métier : vérifier le classement
      expect(result.rankings).toEqual([
        { id: "player2", name: "Player 2", score: 150, rank: 1 },
        { id: "player1", name: "Player 1", score: 100, rank: 2 },
        { id: "player3", name: "Player 3", score: 80, rank: 3 },
      ]);
      expect(result.hostId).toBe("host-id");
    });

    it("devrait échouer si le joueur n'est pas dans le lobby", async () => {
      mockLobbyModel.getPlayerInLobby.mockResolvedValue(null);

      await expect(
        LobbyService.getGameResults("test-lobby-id", "player-id")
      ).rejects.toThrow("Vous n'êtes pas dans ce lobby");
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      const mockPlayer = { userId: "player1", status: "finished" } as any;
      mockLobbyModel.getPlayerInLobby.mockResolvedValue(mockPlayer);
      mockLobbyModel.getLobby.mockResolvedValue(null);

      await expect(
        LobbyService.getGameResults("test-lobby-id", "player-id")
      ).rejects.toThrow("Lobby non trouvé");
    });

    it("devrait échouer si la partie n'est pas terminée", async () => {
      const mockPlayer = { userId: "player1", status: "playing" } as any;
      const mockLobby = {
        id: "test-lobby-id",
        status: "playing",
        players: [],
      } as any;

      mockLobbyModel.getPlayerInLobby.mockResolvedValue(mockPlayer);
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      await expect(
        LobbyService.getGameResults("test-lobby-id", "player-id")
      ).rejects.toThrow("La partie n'est pas encore terminée");
    });
  });

  describe("updateLobbySettings", () => {
    it("devrait mettre à jour les paramètres avec validation d'autorisation", async () => {
      const userId = "host-id";
      const lobbyId = "test-lobby-id";
      const newSettings = { maxPlayers: 6, totalQuestions: 15 };

      const mockLobby = createMockLobby(lobbyId, userId, "Test Lobby");
      const mockLobbyInMemory = { settings: { maxPlayers: 4 } };

      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);
      mockLobbyModel.updateLobbySettings.mockResolvedValue({} as any);
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(
        mockLobbyInMemory
      );

      const result = await LobbyService.updateLobbySettings(
        userId,
        lobbyId,
        newSettings
      );

      expect(result).toBe(true);
      expect(mockLobbyModel.updateLobbySettings).toHaveBeenCalledWith(
        lobbyId,
        newSettings
      );
      expect(mockLobbyInMemory.settings).toEqual(newSettings);
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      const mockLobby = createMockLobby(
        "test-lobby-id",
        "other-host-id",
        "Test Lobby"
      );
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.updateLobbySettings(
        "user-id",
        "test-lobby-id",
        { maxPlayers: 6 }
      );

      expect(result).toBe(false);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      mockLobbyModel.getLobby.mockResolvedValue(null);

      const result = await LobbyService.updateLobbySettings(
        "user-id",
        "test-lobby-id",
        { maxPlayers: 6 }
      );

      expect(result).toBe(false);
    });
  });

  describe("Méthodes utilitaires", () => {
    it("devrait démarrer une partie avec mise à jour des statuts", async () => {
      const lobbyId = "test-lobby-id";
      const mockLobby = {
        id: lobbyId,
        players: [{ userId: "player1" }, { userId: "player2" }],
      } as any;

      mockLobbyModel.updateLobbyStatus.mockResolvedValue({} as any);
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);
      mockLobbyModel.updatePlayerStatus.mockResolvedValue({} as any);

      const result = await LobbyService.startGame(lobbyId);

      expect(result).toBe(true);
      expect(mockLobbyModel.updateLobbyStatus).toHaveBeenCalledWith(
        lobbyId,
        "playing"
      );
      expect(mockLobbyModel.updatePlayerStatus).toHaveBeenCalledWith(
        lobbyId,
        "player1",
        "playing"
      );
      expect(mockLobbyModel.updatePlayerStatus).toHaveBeenCalledWith(
        lobbyId,
        "player2",
        "playing"
      );
    });

    it("devrait ajouter un joueur au lobby", async () => {
      const lobbyId = "test-lobby-id";
      const userId = "player-id";

      mockLobbyModel.addPlayerToLobby.mockResolvedValue({} as any);

      const result = await LobbyService.addPlayerToLobby(lobbyId, userId);

      expect(result).toBe(true);
      expect(mockLobbyModel.addPlayerToLobby).toHaveBeenCalledWith(
        lobbyId,
        userId
      );
    });

    it("devrait gérer les erreurs lors de l'ajout d'un joueur", async () => {
      mockLobbyModel.addPlayerToLobby.mockRejectedValue(
        new Error("Database error")
      );

      const result = await LobbyService.addPlayerToLobby(
        "test-lobby-id",
        "player-id"
      );

      expect(result).toBe(false);
    });
  });
});

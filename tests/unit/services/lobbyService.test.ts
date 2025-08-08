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

describe("LobbyService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createLobby", () => {
    it("devrait créer un lobby avec succès", async () => {
      const mockUser = {
        id: "test-host-id",
        name: "Test User",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        email: "test@example.com",
        emailVerified: false,
      };
      const mockLobby = {
        id: "test-lobby-id",
        name: "Test Lobby",
        hostId: "test-host-id",
        gameSettings: { maxPlayers: 4 },
        host: mockUser,
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "waiting",
        gameState: null,
        authorizedPlayers: [],
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockLobbyModel.createLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.createLobby(
        "test-host-id",
        "Test Lobby",
        { maxPlayers: 4 }
      );

      expect(mockUserModel.findUserById).toHaveBeenCalledWith("test-host-id");
      expect(mockLobbyModel.createLobby).toHaveBeenCalledWith(
        "test-host-id",
        "Test Lobby",
        { maxPlayers: 4 }
      );
      expect(result.success).toBe(true);
      expect(result.lobbyId).toBe("test-lobby-id");
      expect(result.hostId).toBe("test-host-id");
    });

    it("devrait échouer si l'utilisateur n'existe pas", async () => {
      mockUserModel.findUserById.mockResolvedValue(null);

      const result = await LobbyService.createLobby(
        "non-existent-user",
        "Test Lobby"
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Utilisateur non trouvé");
    });

    it("devrait utiliser le nom de l'utilisateur si aucun nom n'est fourni", async () => {
      const mockUser = {
        id: "test-host-id",
        name: "Test User",
        image: null,
        tag: "test-tag",
        isOnline: true,
        lastSeen: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
        email: "test@example.com",
        emailVerified: false,
      };
      const mockLobby = {
        id: "test-lobby-id",
        name: "Lobby de Test User",
        hostId: "test-host-id",
        gameSettings: { maxPlayers: 4 },
        host: mockUser,
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        status: "waiting",
        gameState: null,
        authorizedPlayers: [],
      };

      mockUserModel.findUserById.mockResolvedValue(mockUser);
      mockLobbyModel.createLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.createLobby("test-host-id", "", {
        maxPlayers: 4,
      });

      expect(mockLobbyModel.createLobby).toHaveBeenCalledWith(
        "test-host-id",
        "Lobby de Test User",
        { maxPlayers: 4 }
      );
      expect(result.success).toBe(true);
    });

    it("devrait gérer les erreurs lors de la création", async () => {
      mockUserModel.findUserById.mockRejectedValue(new Error("Database error"));

      const result = await LobbyService.createLobby(
        "test-host-id",
        "Test Lobby"
      );

      expect(result.success).toBe(false);
      expect(result.message).toBe("Database error");
    });
  });

  describe("startGame", () => {
    it("devrait démarrer une partie avec succès", async () => {
      const mockLobby = {
        id: "test-lobby-id",
        players: [
          { userId: "player1", status: "ready" },
          { userId: "player2", status: "ready" },
        ],
        host: {
          id: "host-id",
          name: "Host",
          image: null,
          tag: "host-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "host@example.com",
          emailVerified: false,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Lobby",
        hostId: "host-id",
        status: "waiting",
        gameSettings: {},
        gameState: null,
        authorizedPlayers: [],
      } as any;

      mockLobbyModel.updateLobbyStatus.mockResolvedValue(mockLobby);
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);
      mockLobbyModel.updatePlayerStatus.mockResolvedValue({} as any);

      const result = await LobbyService.startGame("test-lobby-id");

      expect(mockLobbyModel.updateLobbyStatus).toHaveBeenCalledWith(
        "test-lobby-id",
        "playing"
      );
      expect(mockLobbyModel.getLobby).toHaveBeenCalledWith("test-lobby-id");
      expect(mockLobbyModel.updatePlayerStatus).toHaveBeenCalledTimes(2);
      expect(result).toBe(true);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      mockLobbyModel.updateLobbyStatus.mockRejectedValue(
        new Error("Lobby not found")
      );

      const result = await LobbyService.startGame("invalid-lobby-id");

      expect(result).toBe(false);
    });

    it("devrait gérer les erreurs lors du démarrage", async () => {
      mockLobbyModel.updateLobbyStatus.mockRejectedValue(
        new Error("Database error")
      );

      const result = await LobbyService.startGame("test-lobby-id");

      expect(result).toBe(false);
    });
  });

  describe("updatePlayerScore", () => {
    it("devrait mettre à jour le score d'un joueur avec succès", async () => {
      mockLobbyModel.updatePlayerGameData.mockResolvedValue({} as any);

      const result = await LobbyService.updatePlayerScore(
        "test-lobby-id",
        "player-id",
        100,
        50,
        ["France"],
        ["Spain"]
      );

      expect(mockLobbyModel.updatePlayerGameData).toHaveBeenCalledWith(
        "test-lobby-id",
        "player-id",
        100,
        50,
        ["France"],
        ["Spain"]
      );
      expect(result).toBe(true);
    });

    it("devrait gérer les erreurs lors de la mise à jour du score", async () => {
      mockLobbyModel.updatePlayerGameData.mockRejectedValue(
        new Error("Database error")
      );

      const result = await LobbyService.updatePlayerScore(
        "test-lobby-id",
        "player-id",
        100,
        50,
        ["France"],
        ["Spain"]
      );

      expect(result).toBe(false);
    });
  });

  describe("updatePlayerProgress", () => {
    it("devrait mettre à jour le progrès d'un joueur avec succès", async () => {
      mockLobbyModel.updatePlayerGameData.mockResolvedValue({} as any);

      const result = await LobbyService.updatePlayerProgress(
        "test-lobby-id",
        "player-id",
        ["France"],
        ["Spain"],
        100,
        10
      );

      // Le progrès est calculé comme: ((validatedCountries.length + incorrectCountries.length) / totalQuestions) * 100
      // Dans ce cas: ((1 + 1) / 10) * 100 = 20
      expect(mockLobbyModel.updatePlayerGameData).toHaveBeenCalledWith(
        "test-lobby-id",
        "player-id",
        100,
        20,
        ["France"],
        ["Spain"]
      );
      expect(result).toBe(true);
    });
  });

  describe("updatePlayerStatus", () => {
    it("devrait mettre à jour le statut d'un joueur avec succès", async () => {
      mockLobbyModel.updatePlayerStatus.mockResolvedValue({} as any);

      const result = await LobbyService.updatePlayerStatus(
        "test-lobby-id",
        "player-id",
        "ready"
      );

      expect(mockLobbyModel.updatePlayerStatus).toHaveBeenCalledWith(
        "test-lobby-id",
        "player-id",
        "ready"
      );
      expect(result).toBe(true);
    });
  });

  describe("updateLobbyStatus", () => {
    it("devrait mettre à jour le statut du lobby avec succès", async () => {
      mockLobbyModel.updateLobbyStatus.mockResolvedValue({} as any);

      const result = await LobbyService.updateLobbyStatus(
        "test-lobby-id",
        "playing"
      );

      expect(mockLobbyModel.updateLobbyStatus).toHaveBeenCalledWith(
        "test-lobby-id",
        "playing"
      );
      expect(result).toBe(true);
    });
  });

  describe("saveGameState", () => {
    it("devrait sauvegarder l'état du jeu avec succès", async () => {
      const gameState = { currentQuestion: 1, startTime: "2023-01-01" };
      mockLobbyModel.saveGameState.mockResolvedValue({} as any);

      const result = await LobbyService.saveGameState(
        "test-lobby-id",
        gameState
      );

      expect(mockLobbyModel.saveGameState).toHaveBeenCalledWith(
        "test-lobby-id",
        gameState
      );
      expect(result).toBe(true);
    });
  });

  describe("areAllPlayersReady", () => {
    it("devrait retourner true si tous les joueurs sont prêts", async () => {
      mockLobbyModel.areAllPlayersReady.mockResolvedValue(true);

      const result = await LobbyService.areAllPlayersReady(
        "test-lobby-id",
        "host-id"
      );

      expect(mockLobbyModel.areAllPlayersReady).toHaveBeenCalledWith(
        "test-lobby-id",
        "host-id"
      );
      expect(result).toBe(true);
    });

    it("devrait retourner false si un joueur n'est pas prêt", async () => {
      mockLobbyModel.areAllPlayersReady.mockResolvedValue(false);

      const result = await LobbyService.areAllPlayersReady(
        "test-lobby-id",
        "host-id"
      );

      expect(result).toBe(false);
    });

    it("devrait retourner false si le lobby n'existe pas", async () => {
      mockLobbyModel.areAllPlayersReady.mockRejectedValue(
        new Error("Lobby not found")
      );

      const result = await LobbyService.areAllPlayersReady(
        "invalid-lobby-id",
        "host-id"
      );

      expect(result).toBe(false);
    });
  });

  describe("getLobby", () => {
    it("devrait récupérer un lobby avec succès", async () => {
      const mockLobby = {
        id: "test-lobby-id",
        name: "Test Lobby",
        host: {
          id: "host-id",
          name: "Host",
          image: null,
          tag: "host-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "host@example.com",
          emailVerified: false,
        },
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        hostId: "host-id",
        status: "waiting",
        gameSettings: {},
        gameState: null,
        authorizedPlayers: [],
      };
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.getLobby("test-lobby-id");

      expect(mockLobbyModel.getLobby).toHaveBeenCalledWith("test-lobby-id");
      expect(result).toEqual(mockLobby);
    });

    it("devrait retourner null si le lobby n'existe pas", async () => {
      mockLobbyModel.getLobby.mockResolvedValue(null);

      const result = await LobbyService.getLobby("invalid-lobby-id");

      expect(result).toBeNull();
    });
  });

  describe("deleteLobby", () => {
    it("devrait supprimer un lobby avec succès", async () => {
      mockLobbyModel.deleteLobby.mockResolvedValue({} as any);

      const result = await LobbyService.deleteLobby("test-lobby-id");

      expect(mockLobbyModel.deleteLobby).toHaveBeenCalledWith("test-lobby-id");
      expect(result).toBe(true);
    });

    it("devrait gérer les erreurs lors de la suppression", async () => {
      mockLobbyModel.deleteLobby.mockRejectedValue(new Error("Database error"));

      const result = await LobbyService.deleteLobby("test-lobby-id");

      expect(result).toBe(false);
    });
  });

  describe("getGameResults", () => {
    it("devrait récupérer les résultats du jeu", async () => {
      const mockPlayer = {
        id: "player1",
        userId: "user-id",
        lobbyId: "test-lobby-id",
        status: "ready",
        score: 100,
        progress: 100,
        validatedCountries: ["France"],
        incorrectCountries: [],
        user: {
          id: "user-id",
          name: "Player 1",
          tag: "player1-tag",
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any;

      const mockLobby = {
        id: "test-lobby-id",
        hostId: "host-id",
        host: {
          id: "host-id",
          name: "Host",
          image: null,
          tag: "host-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "host@example.com",
          emailVerified: false,
        },
        players: [
          {
            userId: "player1",
            user: {
              id: "player1",
              name: "Player 1",
              image: null,
              tag: "player1-tag",
              isOnline: true,
              lastSeen: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              email: "player1@example.com",
              emailVerified: false,
            },
            score: 100,
          },
          {
            userId: "player2",
            user: {
              id: "player2",
              name: "Player 2",
              image: null,
              tag: "player2-tag",
              isOnline: true,
              lastSeen: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
              email: "player2@example.com",
              emailVerified: false,
            },
            score: 80,
          },
        ],
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Lobby",
        status: "finished",
        gameSettings: {},
        gameState: null,
        authorizedPlayers: [],
      } as any;

      mockLobbyModel.getPlayerInLobby.mockResolvedValue(mockPlayer);
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.getGameResults(
        "test-lobby-id",
        "user-id"
      );

      expect(mockLobbyModel.getPlayerInLobby).toHaveBeenCalledWith(
        "test-lobby-id",
        "user-id"
      );
      expect(mockLobbyModel.getLobby).toHaveBeenCalledWith("test-lobby-id");
      expect(result).toEqual({
        rankings: [
          {
            id: "player1",
            name: "Player 1",
            score: 100,
            rank: 1,
          },
          {
            id: "player2",
            name: "Player 2",
            score: 80,
            rank: 2,
          },
        ],
        hostId: "host-id",
      });
    });
  });

  describe("updateLobbySettings", () => {
    it("devrait mettre à jour les paramètres du lobby avec succès", async () => {
      const mockLobby = {
        id: "test-lobby-id",
        hostId: "user-id",
        host: {
          id: "user-id",
          name: "User",
          image: null,
          tag: "user-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "user@example.com",
          emailVerified: false,
        },
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Lobby",
        status: "waiting",
        gameSettings: {},
        gameState: null,
        authorizedPlayers: [],
      };
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);
      mockLobbyModel.updateLobbySettings.mockResolvedValue({} as any);

      const result = await LobbyService.updateLobbySettings(
        "user-id",
        "test-lobby-id",
        { maxPlayers: 6 }
      );

      expect(mockLobbyModel.getLobby).toHaveBeenCalledWith("test-lobby-id");
      expect(mockLobbyModel.updateLobbySettings).toHaveBeenCalledWith(
        "test-lobby-id",
        { maxPlayers: 6 }
      );
      expect(result).toBe(true);
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      const mockLobby = {
        id: "test-lobby-id",
        hostId: "other-user-id",
        host: {
          id: "other-user-id",
          name: "Other User",
          image: null,
          tag: "other-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "other@example.com",
          emailVerified: false,
        },
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Lobby",
        status: "waiting",
        gameSettings: {},
        gameState: null,
        authorizedPlayers: [],
      };
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      const result = await LobbyService.updateLobbySettings(
        "user-id",
        "test-lobby-id",
        { maxPlayers: 6 }
      );

      expect(result).toBe(false);
    });
  });

  describe("inviteToLobby", () => {
    it("devrait inviter un ami au lobby avec succès", async () => {
      const mockLobby = {
        id: "test-lobby-id",
        hostId: "host-id",
        authorizedPlayers: [],
        host: {
          id: "host-id",
          name: "Host",
          image: null,
          tag: "host-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "host@example.com",
          emailVerified: false,
        },
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Lobby",
        status: "waiting",
        gameSettings: {},
        gameState: null,
      };
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);
      mockLobbyModel.getPlayerInLobby.mockResolvedValue(null); // Le joueur n'est pas encore dans le lobby
      mockLobbyModel.addAuthorizedPlayer.mockResolvedValue({} as any);

      const result = await LobbyService.inviteToLobby(
        "host-id",
        "test-lobby-id",
        "friend-id"
      );

      expect(mockLobbyModel.getLobby).toHaveBeenCalledWith("test-lobby-id");
      expect(mockLobbyModel.getPlayerInLobby).toHaveBeenCalledWith(
        "test-lobby-id",
        "friend-id"
      );
      expect(mockLobbyModel.addAuthorizedPlayer).toHaveBeenCalledWith(
        "test-lobby-id",
        "friend-id"
      );
      expect(result.success).toBe(true);
    });

    it("devrait échouer si l'utilisateur n'est pas l'hôte", async () => {
      const mockLobby = {
        id: "test-lobby-id",
        hostId: "other-user-id",
        authorizedPlayers: [],
        host: {
          id: "other-user-id",
          name: "Other User",
          image: null,
          tag: "other-tag",
          isOnline: true,
          lastSeen: new Date(),
          createdAt: new Date(),
          updatedAt: new Date(),
          email: "other@example.com",
          emailVerified: false,
        },
        players: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        name: "Test Lobby",
        status: "waiting",
        gameSettings: {},
        gameState: null,
      };
      mockLobbyModel.getLobby.mockResolvedValue(mockLobby);

      await expect(
        LobbyService.inviteToLobby("user-id", "test-lobby-id", "friend-id")
      ).rejects.toThrow("Non autorisé à inviter des joueurs dans ce lobby");
    });
  });

  describe("addPlayerToLobby", () => {
    it("devrait ajouter un joueur au lobby avec succès", async () => {
      mockLobbyModel.addPlayerToLobby.mockResolvedValue({} as any);

      const result = await LobbyService.addPlayerToLobby(
        "test-lobby-id",
        "user-id",
        "joined"
      );

      expect(mockLobbyModel.addPlayerToLobby).toHaveBeenCalledWith(
        "test-lobby-id",
        "user-id"
      );
      expect(result).toBe(true);
    });

    it("devrait gérer les erreurs lors de l'ajout", async () => {
      mockLobbyModel.addPlayerToLobby.mockRejectedValue(
        new Error("Database error")
      );

      const result = await LobbyService.addPlayerToLobby(
        "test-lobby-id",
        "user-id"
      );

      expect(result).toBe(false);
    });
  });
});

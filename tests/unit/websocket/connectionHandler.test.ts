import { WebSocket } from "ws";
import * as LobbyModel from "../../../src/models/lobbyModel.js";
import { FriendService } from "../../../src/services/friendService.js";
import { sendSuccessResponse } from "../../../src/websocket/core/authentication.js";
import { WebSocketConnectionHandler } from "../../../src/websocket/core/connectionHandler.js";
import {
  addConnection,
  removeConnection,
} from "../../../src/websocket/core/connectionManager.js";
import { BroadcastManager } from "../../../src/websocket/lobby/broadcastManager.js";
import { LobbyLifecycleManager } from "../../../src/websocket/lobby/lobbyLifecycle.js";

// Mock des modules
jest.mock("../../../src/models/lobbyModel.js");
jest.mock("../../../src/services/friendService.js");
jest.mock("../../../src/websocket/lobby/broadcastManager.js");
jest.mock("../../../src/websocket/lobby/lobbyLifecycle.js");
jest.mock("../../../src/websocket/core/authentication.js");
jest.mock("../../../src/websocket/core/connectionManager.js");

const mockLobbyModel = LobbyModel as jest.Mocked<typeof LobbyModel>;
const mockFriendService = FriendService as jest.Mocked<typeof FriendService>;
const mockBroadcastManager = BroadcastManager as jest.Mocked<
  typeof BroadcastManager
>;
const mockLobbyLifecycleManager = LobbyLifecycleManager as jest.Mocked<
  typeof LobbyLifecycleManager
>;
const mockSendSuccessResponse = sendSuccessResponse as jest.MockedFunction<
  typeof sendSuccessResponse
>;
const mockAddConnection = addConnection as jest.MockedFunction<
  typeof addConnection
>;
const mockRemoveConnection = removeConnection as jest.MockedFunction<
  typeof removeConnection
>;

describe("WebSocketConnectionHandler", () => {
  let mockSocket: WebSocket;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      on: jest.fn(),
      send: jest.fn(),
    } as unknown as WebSocket;

    // Nettoyer le cache restoredUsers
    (WebSocketConnectionHandler as any).restoredUsers = new Set();
    (WebSocketConnectionHandler as any).recentlyDisconnectedUsers = new Set();
  });

  describe("handleNewConnection", () => {
    it("devrait gérer une nouvelle connexion", () => {
      WebSocketConnectionHandler.handleNewConnection(mockSocket);

      expect(mockSendSuccessResponse).toHaveBeenCalledWith(
        mockSocket,
        {
          message: "Connexion WebSocket établie",
        },
        "connected"
      );
    });
  });

  describe("handleAuthentication", () => {
    it("devrait gérer l'authentification d'un utilisateur", async () => {
      const userId = "test-user-id";
      const request = { headers: {} };

      await WebSocketConnectionHandler.handleAuthentication(
        mockSocket,
        userId,
        request
      );

      expect(mockAddConnection).toHaveBeenCalledWith(userId, mockSocket);
      expect(
        mockFriendService.notifyFriendsOfStatusChange
      ).toHaveBeenCalledWith(userId, true);
      expect(mockSendSuccessResponse).toHaveBeenCalledWith(
        mockSocket,
        {
          userId: userId,
        },
        "authenticated"
      );
    });

    it("devrait gérer l'authentification sans envoyer de message", async () => {
      const userId = "test-user-id";
      const request = { headers: {} };

      await WebSocketConnectionHandler.handleAuthentication(
        mockSocket,
        userId,
        request,
        false
      );

      expect(mockAddConnection).toHaveBeenCalledWith(userId, mockSocket);
      expect(
        mockFriendService.notifyFriendsOfStatusChange
      ).toHaveBeenCalledWith(userId, true);
      expect(mockSendSuccessResponse).not.toHaveBeenCalledWith(
        mockSocket,
        {
          userId: userId,
        },
        "authenticated"
      );
    });
  });

  describe("restoreUserInLobbies", () => {
    it("devrait restaurer l'utilisateur dans ses lobbies", async () => {
      const userId = "test-user-id";
      const mockLobbies = [
        {
          id: "lobby1",
          name: "Lobby 1",
          status: "waiting",
          hostId: "host1",
          gameSettings: { maxPlayers: 4 },
          gameState: null,
          authorizedPlayers: ["host1"],
          createdAt: new Date(),
          updatedAt: new Date(),
          host: {
            id: "host1",
            name: "Host User",
            createdAt: new Date(),
            updatedAt: new Date(),
            tag: "host-tag",
            email: "host@example.com",
            emailVerified: false,
            image: null,
            isOnline: true,
            lastSeen: new Date(),
          },
          players: [],
        },
      ];

      mockLobbyModel.findUserLobbies.mockResolvedValue(mockLobbies);
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue({
        players: new Map(),
      });

      // Test via handleAuthentication qui appelle restoreUserInLobbies
      await WebSocketConnectionHandler.handleAuthentication(
        mockSocket,
        userId,
        {}
      );

      expect(mockLobbyModel.findUserLobbies).toHaveBeenCalledWith(userId);
      expect(mockLobbyLifecycleManager.getLobbyInMemory).toHaveBeenCalledWith(
        "lobby1"
      );
    });

    it("devrait ignorer les lobbies qui ne sont pas en attente", async () => {
      const userId = "test-user-id";
      const mockLobbies = [
        {
          id: "lobby1",
          name: "Lobby 1",
          status: "playing", // Pas en attente
          hostId: "host1",
          gameSettings: { maxPlayers: 4 },
          gameState: null,
          authorizedPlayers: ["host1"],
          createdAt: new Date(),
          updatedAt: new Date(),
          host: {
            id: "host1",
            name: "Host User",
            createdAt: new Date(),
            updatedAt: new Date(),
            tag: "host-tag",
            email: "host@example.com",
            emailVerified: false,
            image: null,
            isOnline: true,
            lastSeen: new Date(),
          },
          players: [],
        },
      ];

      mockLobbyModel.findUserLobbies.mockResolvedValue(mockLobbies);

      // Test via handleAuthentication qui appelle restoreUserInLobbies
      await WebSocketConnectionHandler.handleAuthentication(
        mockSocket,
        userId,
        {}
      );

      expect(mockLobbyModel.findUserLobbies).toHaveBeenCalledWith(userId);
      expect(mockLobbyLifecycleManager.getLobbyInMemory).not.toHaveBeenCalled();
    });

    it("devrait ignorer les lobbies qui ne sont pas en mémoire", async () => {
      const userId = "test-user-id";
      const mockLobbies = [
        {
          id: "lobby1",
          name: "Lobby 1",
          status: "waiting",
          hostId: "host1",
          gameSettings: { maxPlayers: 4 },
          gameState: null,
          authorizedPlayers: ["host1"],
          createdAt: new Date(),
          updatedAt: new Date(),
          host: {
            id: "host1",
            name: "Host User",
            createdAt: new Date(),
            updatedAt: new Date(),
            tag: "host-tag",
            email: "host@example.com",
            emailVerified: false,
            image: null,
            isOnline: true,
            lastSeen: new Date(),
          },
          players: [],
        },
      ];

      mockLobbyModel.findUserLobbies.mockResolvedValue(mockLobbies);
      mockLobbyLifecycleManager.getLobbyInMemory.mockReturnValue(null);

      // Test via handleAuthentication qui appelle restoreUserInLobbies
      await WebSocketConnectionHandler.handleAuthentication(
        mockSocket,
        userId,
        {}
      );

      expect(mockLobbyModel.findUserLobbies).toHaveBeenCalledWith(userId);
      expect(mockLobbyLifecycleManager.getLobbyInMemory).toHaveBeenCalledWith(
        "lobby1"
      );
      expect(mockBroadcastManager.broadcastLobbyUpdate).not.toHaveBeenCalled();
    });
  });

  describe("setupConnectionEventHandlers", () => {
    it("devrait configurer les gestionnaires d'événements de connexion", () => {
      const userId = "test-user-id";

      const setupConnectionEventHandlers = (WebSocketConnectionHandler as any)
        .setupConnectionEventHandlers;
      setupConnectionEventHandlers.call(
        WebSocketConnectionHandler,
        mockSocket,
        userId
      );

      expect(mockSocket.on).toHaveBeenCalledWith("close", expect.any(Function));
    });
  });

  describe("handlePlayerDisconnect", () => {
    it("devrait gérer la déconnexion d'un joueur", async () => {
      const userId = "test-user-id";

      // Simuler la déconnexion en appelant directement la méthode privée via handleAuthentication
      // puis en simulant l'événement close
      await WebSocketConnectionHandler.handleAuthentication(
        mockSocket,
        userId,
        {}
      );

      // Simuler l'événement close
      const closeHandler = (mockSocket.on as jest.Mock).mock.calls.find(
        (call: [string, Function]) => call[0] === "close"
      )?.[1];

      if (closeHandler) {
        await closeHandler();
      }

      expect(mockRemoveConnection).toHaveBeenCalledWith(userId);
      expect(
        mockFriendService.notifyFriendsOfStatusChange
      ).toHaveBeenCalledWith(userId, false);
    });
  });
});

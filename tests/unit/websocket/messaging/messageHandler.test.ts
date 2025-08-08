import {
  sendErrorResponse,
  sendSuccessResponse,
} from "../../../../src/websocket/core/authentication.js";
import { WebSocketMessageHandler } from "../../../../src/websocket/messaging/messageHandler.js";

// Mock des dépendances
jest.mock("../../../../src/websocket/core/authentication.js");
jest.mock("../../../../src/controllers/websocketController.js", () => ({
  handleCreateLobby: jest.fn(),
  handleJoinLobby: jest.fn(),
  handleLeaveLobby: jest.fn(),
  handleStartGame: jest.fn(),
  handleUpdatePlayerProgress: jest.fn(),
  handleGetGameState: jest.fn(),
  handleGetLobbyState: jest.fn(),
  handleGetGameResults: jest.fn(),
  handleSendFriendRequest: jest.fn(),
  handleRespondFriendRequest: jest.fn(),
  handleInviteToLobby: jest.fn(),
  handleUpdateLobbySettings: jest.fn(),
  handleSetPlayerReady: jest.fn(),
  handleRestartGame: jest.fn(),
  handleRemovePlayer: jest.fn(),
  handleUpdatePlayerStatus: jest.fn(),
}));

const mockSendErrorResponse = sendErrorResponse as jest.MockedFunction<
  typeof sendErrorResponse
>;
const mockSendSuccessResponse = sendSuccessResponse as jest.MockedFunction<
  typeof sendSuccessResponse
>;

describe("WebSocketMessageHandler", () => {
  let mockSocket: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSocket = {
      send: jest.fn(),
      close: jest.fn(),
    };
  });

  describe("requireAuth", () => {
    it("devrait retourner true si userId est fourni", () => {
      const userId = "test-user-id";

      const result = (WebSocketMessageHandler as any).requireAuth(
        userId,
        mockSocket
      );

      expect(result).toBe(true);
    });

    it("devrait envoyer une erreur et retourner false si userId n'est pas fourni", () => {
      const userId = null;

      const result = (WebSocketMessageHandler as any).requireAuth(
        userId,
        mockSocket
      );

      expect(mockSendErrorResponse).toHaveBeenCalledWith(
        mockSocket,
        "Authentification requise"
      );
      expect(result).toBe(false);
    });
  });

  describe("handleMessage", () => {
    it("devrait gérer un message sans authentification", async () => {
      const message = {
        type: "create_lobby",
        payload: { name: "Test Lobby" },
      };
      const userId = null;

      await WebSocketMessageHandler.handleMessage(message, mockSocket, userId);

      expect(mockSendErrorResponse).toHaveBeenCalledWith(
        mockSocket,
        "Authentification requise"
      );
    });

    it("devrait gérer un message avec type invalide", async () => {
      const message = {
        type: "invalid_type",
        payload: {},
      };
      const userId = "test-user-id";

      await WebSocketMessageHandler.handleMessage(message, mockSocket, userId);

      expect(mockSendErrorResponse).toHaveBeenCalledWith(
        mockSocket,
        "Type de message non supporté: invalid_type"
      );
    });

    it("devrait gérer un message malformé", async () => {
      const message = "invalid message";
      const userId = "test-user-id";

      await WebSocketMessageHandler.handleMessage(message, mockSocket, userId);

      expect(mockSendErrorResponse).toHaveBeenCalledWith(
        mockSocket,
        "Message invalide"
      );
    });

    it("devrait gérer les messages de ping", async () => {
      const message = {
        type: "ping",
        payload: {},
      };
      const userId = "test-user-id";

      await WebSocketMessageHandler.handleMessage(message, mockSocket, userId);

      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "pong" })
      );
    });

    it("devrait gérer les messages avec type manquant", async () => {
      const message = {
        payload: { name: "Test Lobby" },
      };
      const userId = "test-user-id";

      await WebSocketMessageHandler.handleMessage(message, mockSocket, userId);

      expect(mockSendErrorResponse).toHaveBeenCalledWith(
        mockSocket,
        "Type de message requis"
      );
    });
  });

  describe("handlePing", () => {
    it("devrait envoyer une réponse pong", () => {
      (WebSocketMessageHandler as any).handlePing(mockSocket);

      expect(mockSocket.send).toHaveBeenCalledWith(
        JSON.stringify({ type: "pong" })
      );
    });
  });
});

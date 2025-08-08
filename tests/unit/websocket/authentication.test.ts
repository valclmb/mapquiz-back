import { WebSocket } from "@fastify/websocket";
import { auth } from "../../../src/lib/auth.js";
import {
  authenticateInitialConnection,
  authenticateWebSocketUser,
  sendErrorResponse,
  sendSuccessResponse,
} from "../../../src/websocket/core/authentication.js";

// Mock des modules
jest.mock("../../../src/lib/auth.js");

const mockAuth = auth as jest.Mocked<typeof auth>;
const mockWebSocket = {
  send: jest.fn(),
} as unknown as WebSocket;

describe("WebSocket Authentication", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    delete process.env.NODE_ENV;
  });

  describe("authenticateWebSocketUser", () => {
    it("devrait authentifier un utilisateur en mode test avec x-user-id", async () => {
      const mockRequest = {
        headers: {
          "x-user-id": "test-user-id",
        },
      };

      const result = await authenticateWebSocketUser(
        mockRequest,
        mockWebSocket
      );

      expect(result).toEqual({
        user: { id: "test-user-id", name: "Test User" },
        session: { user: { id: "test-user-id", name: "Test User" } },
      });
    });

    it("devrait authentifier un utilisateur avec une session valide", async () => {
      process.env.NODE_ENV = "production";
      const mockRequest = {
        headers: {
          authorization: "Bearer valid-token",
        },
      };
      const mockSession = {
        user: { id: "user-id", name: "Test User" },
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await authenticateWebSocketUser(
        mockRequest,
        mockWebSocket
      );

      expect(result).toEqual({
        user: { id: "user-id", name: "Test User" },
        session: mockSession,
      });
    });

    it("devrait gérer les headers multiples", async () => {
      process.env.NODE_ENV = "production";
      const mockRequest = {
        headers: {
          authorization: ["Bearer valid-token", "Bearer another-token"],
        },
      };
      const mockSession = {
        user: { id: "user-id", name: "Test User" },
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await authenticateWebSocketUser(
        mockRequest,
        mockWebSocket
      );

      expect(result).toEqual({
        user: { id: "user-id", name: "Test User" },
        session: mockSession,
      });
    });

    it("devrait retourner null si pas de session", async () => {
      process.env.NODE_ENV = "production";
      const mockRequest = {
        headers: {},
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(null);

      const result = await authenticateWebSocketUser(
        mockRequest,
        mockWebSocket
      );

      expect(result).toBeNull();
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          message: "Non authentifié - veuillez vous connecter",
        })
      );
    });

    it("devrait gérer les erreurs d'authentification", async () => {
      process.env.NODE_ENV = "production";
      const mockRequest = {
        headers: {},
      };
      (mockAuth.api.getSession as jest.Mock).mockRejectedValue(
        new Error("Auth error")
      );

      const result = await authenticateWebSocketUser(
        mockRequest,
        mockWebSocket
      );

      expect(result).toBeNull();
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          message: "Erreur d'authentification",
        })
      );
    });

    // Nouveaux tests pour couvrir les lignes manquantes
    it("devrait gérer les headers avec valeurs null ou undefined", async () => {
      process.env.NODE_ENV = "production";
      const mockRequest = {
        headers: {
          authorization: null,
          "user-agent": undefined,
          "content-type": "",
        },
      };
      const mockSession = {
        user: { id: "user-id", name: "Test User" },
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await authenticateWebSocketUser(
        mockRequest,
        mockWebSocket
      );

      expect(result).toEqual({
        user: { id: "user-id", name: "Test User" },
        session: mockSession,
      });
    });

    it("devrait gérer les headers avec valeurs vides", async () => {
      process.env.NODE_ENV = "production";
      const mockRequest = {
        headers: {
          authorization: "",
          "user-agent": "   ",
        },
      };
      const mockSession = {
        user: { id: "user-id", name: "Test User" },
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await authenticateWebSocketUser(
        mockRequest,
        mockWebSocket
      );

      expect(result).toEqual({
        user: { id: "user-id", name: "Test User" },
        session: mockSession,
      });
    });

    it("devrait gérer les erreurs d'authentification avec console.error", async () => {
      process.env.NODE_ENV = "production";
      const mockRequest = {
        headers: {},
      };
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (mockAuth.api.getSession as jest.Mock).mockRejectedValue(
        new Error("Auth error")
      );

      const result = await authenticateWebSocketUser(
        mockRequest,
        mockWebSocket
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Erreur d'authentification:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("authenticateInitialConnection", () => {
    it("devrait authentifier une connexion initiale avec succès", async () => {
      const mockRequest = {
        headers: {
          authorization: "Bearer valid-token",
        },
      };
      const mockSession = {
        user: { id: "user-id", name: "Test User" },
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await authenticateInitialConnection(
        mockRequest,
        mockWebSocket
      );

      expect(result).toEqual({
        user: { id: "user-id", name: "Test User" },
        session: mockSession,
      });
    });

    it("devrait gérer les headers multiples pour la connexion initiale", async () => {
      const mockRequest = {
        headers: {
          authorization: ["Bearer valid-token"],
        },
      };
      const mockSession = {
        user: { id: "user-id", name: "Test User" },
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await authenticateInitialConnection(
        mockRequest,
        mockWebSocket
      );

      expect(result).toEqual({
        user: { id: "user-id", name: "Test User" },
        session: mockSession,
      });
    });

    it("devrait retourner null si pas de session pour la connexion initiale", async () => {
      const mockRequest = {
        headers: {},
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(null);

      const result = await authenticateInitialConnection(
        mockRequest,
        mockWebSocket
      );

      expect(result).toBeNull();
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "authentication_failed",
          message: "Session invalide",
        })
      );
    });

    it("devrait gérer les erreurs d'authentification pour la connexion initiale", async () => {
      const mockRequest = {
        headers: {},
      };
      (mockAuth.api.getSession as jest.Mock).mockRejectedValue(
        new Error("Auth error")
      );

      const result = await authenticateInitialConnection(
        mockRequest,
        mockWebSocket
      );

      expect(result).toBeNull();
      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "authentication_error",
          message: "Erreur d'authentification",
        })
      );
    });

    // Nouveaux tests pour couvrir les lignes manquantes
    it("devrait gérer les headers avec valeurs null pour la connexion initiale", async () => {
      const mockRequest = {
        headers: {
          authorization: null,
          "user-agent": undefined,
        },
      };
      const mockSession = {
        user: { id: "user-id", name: "Test User" },
      };
      (mockAuth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      const result = await authenticateInitialConnection(
        mockRequest,
        mockWebSocket
      );

      expect(result).toEqual({
        user: { id: "user-id", name: "Test User" },
        session: mockSession,
      });
    });

    it("devrait gérer les erreurs d'authentification avec console.error pour la connexion initiale", async () => {
      const mockRequest = {
        headers: {},
      };
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      (mockAuth.api.getSession as jest.Mock).mockRejectedValue(
        new Error("Auth error")
      );

      const result = await authenticateInitialConnection(
        mockRequest,
        mockWebSocket
      );

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalledWith(
        "Erreur d'authentification:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });
  });

  describe("sendErrorResponse", () => {
    it("devrait envoyer une réponse d'erreur", () => {
      sendErrorResponse(mockWebSocket, "Test error message");

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          message: "Test error message",
        })
      );
    });

    it("devrait envoyer une réponse d'erreur avec un type personnalisé", () => {
      sendErrorResponse(mockWebSocket, "Test error message", "custom_error");

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "custom_error",
          message: "Test error message",
        })
      );
    });

    it("devrait envoyer une réponse d'erreur avec un lobbyId", () => {
      sendErrorResponse(
        mockWebSocket,
        "Test error message",
        "error",
        "lobby-id"
      );

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "error",
          message: "Test error message",
          lobbyId: "lobby-id",
        })
      );
    });
  });

  describe("sendSuccessResponse", () => {
    it("devrait envoyer une réponse de succès", () => {
      const data = { success: true, message: "Operation completed" };
      sendSuccessResponse(mockWebSocket, data, "success");

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "success",
          data: data,
        })
      );
    });

    it("devrait envoyer une réponse de succès avec un lobbyId", () => {
      const data = { success: true, message: "Operation completed" };
      sendSuccessResponse(mockWebSocket, data, "success", "lobby-id");

      expect(mockWebSocket.send).toHaveBeenCalledWith(
        JSON.stringify({
          type: "success",
          data: data,
          lobbyId: "lobby-id",
        })
      );
    });
  });
});

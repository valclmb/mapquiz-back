import { FastifyReply, FastifyRequest } from "fastify";
import { handleAuth } from "../../../src/controllers/authController.js";

// Mock des dépendances
jest.mock("../../../src/lib/auth.js", () => ({
  auth: {
    handler: jest.fn(),
  },
}));

describe("AuthController", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    // Reset des mocks
    jest.clearAllMocks();

    // Mock de la requête
    mockRequest = {
      url: "/auth/google",
      method: "GET",
      headers: {
        host: "localhost:3000",
        "user-agent": "test-agent",
      },
      body: null,
      log: {
        error: jest.fn(),
      } as any,
    };

    // Mock de la réponse
    mockReply = {
      status: jest.fn().mockReturnThis(),
      header: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe("handleAuth", () => {
    it("devrait gérer une requête d'authentification réussie", async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        headers: new Headers({
          "content-type": "application/json",
        }),
        body: '{"success": true}',
        text: jest.fn().mockResolvedValue('{"success": true}'),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handleAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(auth.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "http://localhost:3000/auth/google",
        })
      );
      expect(mockReply.status).toHaveBeenCalledWith(200);
      expect(mockReply.send).toHaveBeenCalledWith('{"success": true}');
    });

    it("devrait gérer une requête avec body JSON", async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue('{"success": true}'),
      };

      const requestWithBody = {
        ...mockRequest,
        body: { test: "data" },
        method: "POST",
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handleAuth(
        requestWithBody as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(auth.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "POST",
        })
      );
    });

    it("devrait gérer les erreurs d'authentification", async () => {
      // Arrange
      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockRejectedValue(new Error("Auth failed"));

      // Act
      await handleAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
      expect(mockRequest.log?.error).toHaveBeenCalledWith(
        "Authentication Error:",
        expect.any(Error)
      );
    });

    it("devrait gérer une réponse sans body", async () => {
      // Arrange
      const mockResponse = {
        status: 204,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue(null),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handleAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(mockReply.status).toHaveBeenCalledWith(204);
      expect(mockReply.send).toHaveBeenCalledWith(null);
    });

    it("devrait gérer les headers de réponse", async () => {
      // Arrange
      const mockResponse = {
        status: 200,
        headers: new Headers({
          "set-cookie": "session=abc123",
          "content-type": "application/json",
        }),
        text: jest.fn().mockResolvedValue('{"success": true}'),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handleAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(mockReply.header).toHaveBeenCalledWith(
        "set-cookie",
        "session=abc123"
      );
      expect(mockReply.header).toHaveBeenCalledWith(
        "content-type",
        "application/json"
      );
    });

    it("devrait gérer une URL complexe avec query parameters", async () => {
      // Arrange
      const requestWithQuery = {
        ...mockRequest,
        url: "/auth/google?redirect=/dashboard&state=abc123",
      };

      const mockResponse = {
        status: 200,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue('{"success": true}'),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handleAuth(
        requestWithQuery as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(auth.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          url: "http://localhost:3000/auth/google?redirect=/dashboard&state=abc123",
        })
      );
    });

    // Nouveaux tests pour couvrir les lignes manquantes
    it("devrait gérer les headers avec valeurs null ou undefined", async () => {
      // Arrange
      const requestWithNullHeaders = {
        ...mockRequest,
        headers: {
          host: "localhost:3000",
          "user-agent": null as any,
          "content-type": undefined as any,
          authorization: "",
        },
      };

      const mockResponse = {
        status: 200,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue('{"success": true}'),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handleAuth(
        requestWithNullHeaders as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(auth.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "http://localhost:3000/auth/google",
        })
      );
    });

    it("devrait gérer les headers avec valeurs vides", async () => {
      // Arrange
      const requestWithEmptyHeaders = {
        ...mockRequest,
        headers: {
          host: "localhost:3000",
          "user-agent": "   ",
          "content-type": "",
          authorization: null as any,
        },
      };

      const mockResponse = {
        status: 200,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue('{"success": true}'),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handleAuth(
        requestWithEmptyHeaders as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(auth.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "http://localhost:3000/auth/google",
        })
      );
    });

    it("devrait gérer les erreurs d'authentification avec console.error", async () => {
      // Arrange
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();
      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockRejectedValue(new Error("Auth failed"));

      // Act
      await handleAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Internal authentication error",
        code: "AUTH_FAILURE",
      });
      expect(mockRequest.log?.error).toHaveBeenCalledWith(
        "Authentication Error:",
        expect.any(Error)
      );
      consoleSpy.mockRestore();
    });

    it("devrait gérer une requête sans host header", async () => {
      // Arrange
      const requestWithoutHost = {
        ...mockRequest,
        headers: {
          "user-agent": "test-agent",
        },
      };

      const mockResponse = {
        status: 200,
        headers: new Headers(),
        text: jest.fn().mockResolvedValue('{"success": true}'),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.handler as jest.Mock).mockResolvedValue(mockResponse);

      // Act
      await handleAuth(
        requestWithoutHost as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(auth.handler).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "GET",
          url: "http://undefined/auth/google",
        })
      );
    });
  });
});

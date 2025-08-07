import { FastifyReply, FastifyRequest } from "fastify";
import { optionalAuth, requireAuth } from "../../../src/middleware/auth.js";

// Mock des dépendances
jest.mock("../../../src/lib/auth.js", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

describe("Auth Middleware", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      headers: {
        authorization: "Bearer test-token",
        host: "localhost:3000",
      },
    } as any;

    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    } as any;
  });

  describe("requireAuth", () => {
    it("devrait autoriser un utilisateur avec un token valide", async () => {
      // Arrange
      const mockUser = {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
      };

      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 3600000),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      // Act
      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(auth.api.getSession).toHaveBeenCalledWith({
        headers: expect.any(Headers),
      });
      expect((mockRequest as any).user).toEqual(mockUser);
      expect((mockRequest as any).session).toEqual(mockSession);
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it("devrait rejeter un utilisateur sans token", async () => {
      // Arrange
      mockRequest.headers = {};

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      // Act
      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "Non autorisé" });
    });

    it("devrait rejeter un utilisateur avec un token invalide", async () => {
      // Arrange
      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockRejectedValue(
        new Error("Invalid token")
      );

      // Act
      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "Token invalide" });
    });

    it("devrait rejeter un utilisateur avec une session sans user", async () => {
      // Arrange
      const mockSession = {
        expires: new Date(Date.now() + 3600000),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      // Act
      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "Non autorisé" });
    });
  });

  describe("optionalAuth", () => {
    it("devrait attacher l'utilisateur si le token est valide", async () => {
      // Arrange
      const mockUser = {
        id: "test-user-id",
        name: "Test User",
        email: "test@example.com",
      };

      const mockSession = {
        user: mockUser,
        expires: new Date(Date.now() + 3600000),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      // Act
      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect((mockRequest as any).user).toEqual(mockUser);
      expect((mockRequest as any).session).toEqual(mockSession);
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it("devrait continuer sans bloquer si pas de token", async () => {
      // Arrange
      mockRequest.headers = {};

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      // Act
      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect((mockRequest as any).user).toBeUndefined();
      expect((mockRequest as any).session).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it("devrait continuer sans bloquer en cas d'erreur", async () => {
      // Arrange
      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      // Act
      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect((mockRequest as any).user).toBeUndefined();
      expect((mockRequest as any).session).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it("devrait continuer sans bloquer si session sans user", async () => {
      // Arrange
      const mockSession = {
        expires: new Date(Date.now() + 3600000),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      // Act
      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Assert
      expect((mockRequest as any).user).toBeUndefined();
      expect((mockRequest as any).session).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });
});

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

const mockAuth = {
  api: {
    getSession: jest.fn(),
  },
};

describe("Auth Middleware", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      headers: {
        authorization: "Bearer valid-token",
      },
      log: {
        error: jest.fn(),
      } as any,
    };

    mockReply = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
    };
  });

  describe("requireAuth", () => {
    it("devrait autoriser un utilisateur avec un token valide", async () => {
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

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).user).toEqual(mockUser);
      expect((mockRequest as any).session).toEqual(mockSession);
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it("devrait rejeter un utilisateur sans token", async () => {
      mockRequest.headers = {};

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "Non autorisé" });
    });

    it("devrait rejeter un utilisateur avec un token invalide", async () => {
      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockRejectedValue(
        new Error("Invalid token")
      );

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "Token invalide" });
    });

    it("devrait rejeter un utilisateur avec une session sans user", async () => {
      const mockSession = {
        expires: new Date(Date.now() + 3600000),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      await requireAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect(mockReply.status).toHaveBeenCalledWith(401);
      expect(mockReply.send).toHaveBeenCalledWith({ error: "Non autorisé" });
    });
  });

  describe("optionalAuth", () => {
    it("devrait attacher l'utilisateur si le token est valide", async () => {
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

      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).user).toEqual(mockUser);
      expect((mockRequest as any).session).toEqual(mockSession);
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it("devrait continuer sans bloquer si pas de token", async () => {
      mockRequest.headers = {};

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(null);

      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).user).toBeUndefined();
      expect((mockRequest as any).session).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it("devrait continuer sans bloquer en cas d'erreur", async () => {
      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockRejectedValue(
        new Error("Database error")
      );

      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).user).toBeUndefined();
      expect((mockRequest as any).session).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
    });

    it("devrait continuer sans bloquer si session sans user", async () => {
      const mockSession = {
        expires: new Date(Date.now() + 3600000),
      };

      const { auth } = await import("../../../src/lib/auth.js");
      (auth.api.getSession as jest.Mock).mockResolvedValue(mockSession);

      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      expect((mockRequest as any).user).toBeUndefined();
      expect((mockRequest as any).session).toBeUndefined();
      expect(mockReply.status).not.toHaveBeenCalled();
    });
  });
});

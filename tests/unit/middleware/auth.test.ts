import { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../../../src/lib/auth.js";
import { optionalAuth } from "../../../src/middleware/auth.js";

// Mock du module auth
jest.mock("../../../src/lib/auth.js", () => ({
  auth: {
    api: {
      getSession: jest.fn(),
    },
  },
}));

const mockGetSession = auth.api.getSession as jest.MockedFunction<
  typeof auth.api.getSession
>;

describe("Auth Middleware - Logique Conditionnelle Critique", () => {
  let mockRequest: Partial<FastifyRequest>;
  let mockReply: Partial<FastifyReply>;
  let originalNodeEnv: string | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    originalNodeEnv = process.env.NODE_ENV;

    mockRequest = { headers: {} };
    mockReply = {};
  });

  afterEach(() => {
    if (originalNodeEnv !== undefined) {
      process.env.NODE_ENV = originalNodeEnv;
    } else {
      delete process.env.NODE_ENV;
    }
  });

  describe("🔥 Logique conditionnelle critique - Mode test vs production", () => {
    it("devrait utiliser x-user-id en mode test", async () => {
      process.env.NODE_ENV = "test";
      mockRequest.headers = { "x-user-id": "test-user-123" };

      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // En mode test : l'utilisateur doit être simulé à partir du header
      expect((mockRequest as any).user).toEqual({ id: "test-user-123" });
      // Better-auth ne doit PAS être appelé en mode test
      expect(mockGetSession).not.toHaveBeenCalled();
    });

    it("devrait utiliser Better-auth en mode production", async () => {
      process.env.NODE_ENV = "production";
      mockRequest.headers = {
        "x-user-id": "should-be-ignored", // Ignoré en production
        authorization: "Bearer prod-token",
      };

      const mockUser = { id: "prod-user-999", name: "Prod User" };
      mockGetSession.mockResolvedValue({ user: mockUser } as any);

      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Mode production : ignorer x-user-id, utiliser Better-auth
      expect(mockGetSession).toHaveBeenCalled();
      expect((mockRequest as any).user).toEqual(mockUser);
      expect((mockRequest as any).user.id).not.toBe("should-be-ignored");
    });

    it("devrait continuer gracieusement en cas d'erreur API", async () => {
      process.env.NODE_ENV = "production";
      const consoleSpy = jest.spyOn(console, "log").mockImplementation();

      mockGetSession.mockRejectedValue(new Error("Network timeout"));

      await optionalAuth(
        mockRequest as FastifyRequest,
        mockReply as FastifyReply
      );

      // Erreur loggée mais pas propagée (optionalAuth ne bloque jamais)
      expect(consoleSpy).toHaveBeenCalledWith(
        "Auth optionnelle échouée:",
        expect.any(Error)
      );
      expect((mockRequest as any).user).toBeUndefined();

      consoleSpy.mockRestore();
    });
  });
});

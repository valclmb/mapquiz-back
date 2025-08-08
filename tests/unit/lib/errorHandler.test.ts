import { FastifyReply, FastifyRequest } from "fastify";
import {
  AppError,
  asyncHandler,
  ConflictError,
  errorHandler,
  NotFoundError,
  ValidationError,
} from "../../../src/lib/errorHandler.js";

// Mock Fastify
const mockReply = {
  status: jest.fn().mockReturnThis(),
  send: jest.fn().mockReturnThis(),
} as unknown as FastifyReply;

const mockRequest = {
  log: {
    error: jest.fn(),
  },
} as unknown as FastifyRequest;

describe("ErrorHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("AppError", () => {
    it("devrait créer une AppError avec les valeurs par défaut", () => {
      const error = new AppError("Test error");
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(400);
      expect(error.isOperational).toBe(true);
      expect(error.name).toBe("AppError");
    });

    it("devrait créer une AppError avec des valeurs personnalisées", () => {
      const error = new AppError("Test error", 500, false);
      expect(error.message).toBe("Test error");
      expect(error.statusCode).toBe(500);
      expect(error.isOperational).toBe(false);
    });
  });

  describe("ValidationError", () => {
    it("devrait créer une ValidationError", () => {
      const error = new ValidationError("Validation failed");
      expect(error.message).toBe("Validation failed");
      expect(error.statusCode).toBe(400);
      expect(error.name).toBe("ValidationError");
    });
  });

  describe("NotFoundError", () => {
    it("devrait créer une NotFoundError", () => {
      const error = new NotFoundError("User");
      expect(error.message).toBe("User non trouvé");
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe("NotFoundError");
    });
  });

  describe("ConflictError", () => {
    it("devrait créer une ConflictError", () => {
      const error = new ConflictError("Resource already exists");
      expect(error.message).toBe("Resource already exists");
      expect(error.statusCode).toBe(409);
      expect(error.name).toBe("ConflictError");
    });
  });

  describe("errorHandler", () => {
    it("devrait gérer une AppError", () => {
      const error = new AppError("Test error", 400);
      errorHandler(error, mockRequest, mockReply);

      expect(mockRequest.log.error).toHaveBeenCalledWith(error);
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Test error",
        statusCode: 400,
      });
    });

    it("devrait gérer une ZodError", () => {
      const error = new Error("ZodError");
      error.name = "ZodError";
      error.message = "Validation failed";

      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Données invalides",
        details: "Validation failed",
      });
    });

    it("devrait gérer une PrismaClientKnownRequestError", () => {
      const error = new Error("Database error");
      error.name = "PrismaClientKnownRequestError";

      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Erreur de base de données",
      });
    });

    it("devrait gérer une erreur générique en mode production", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const error = new Error("Internal server error");
      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Erreur interne du serveur",
        statusCode: 500,
      });

      process.env.NODE_ENV = originalEnv;
    });

    it("devrait gérer une erreur générique en mode développement", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const error = new Error("Internal server error");
      errorHandler(error, mockRequest, mockReply);

      expect(mockReply.status).toHaveBeenCalledWith(500);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Internal server error",
        statusCode: 500,
      });

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("asyncHandler", () => {
    it("devrait exécuter la fonction sans erreur", async () => {
      const mockFn = jest.fn().mockResolvedValue("success");
      const handler = asyncHandler(mockFn);

      await handler(mockRequest, mockReply);

      expect(mockFn).toHaveBeenCalledWith(mockRequest, mockReply);
    });

    it("devrait gérer les erreurs dans la fonction", async () => {
      const mockFn = jest
        .fn()
        .mockRejectedValue(new AppError("Test error", 400));
      const handler = asyncHandler(mockFn);

      await handler(mockRequest, mockReply);

      expect(mockRequest.log.error).toHaveBeenCalled();
      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        error: "Test error",
        statusCode: 400,
      });
    });
  });
});

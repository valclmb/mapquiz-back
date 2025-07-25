import { FastifyReply, FastifyRequest } from "fastify";

// Types d'erreurs personnalisées
export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public isOperational: boolean = true
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 400);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} non trouvé`, 404);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
    this.name = "ConflictError";
  }
}

// Gestionnaire d'erreur global
export const errorHandler = (
  error: Error,
  request: FastifyRequest,
  reply: FastifyReply
) => {
  // Log de l'erreur
  request.log.error(error);

  // Erreurs personnalisées
  if (error instanceof AppError) {
    return reply.status(error.statusCode).send({
      error: error.message,
      statusCode: error.statusCode,
    });
  }

  // Erreurs de validation Zod
  if (error.name === "ZodError") {
    return reply.status(400).send({
      error: "Données invalides",
      details: error.message,
    });
  }

  // Erreurs Prisma
  if (error.name === "PrismaClientKnownRequestError") {
    return reply.status(400).send({
      error: "Erreur de base de données",
    });
  }

  // Erreurs par défaut
  const statusCode = 500;
  const message = process.env.NODE_ENV === "production" 
    ? "Erreur interne du serveur" 
    : error.message;

  return reply.status(statusCode).send({
    error: message,
    statusCode,
  });
};

// Wrapper pour les contrôleurs
export const asyncHandler = (fn: Function) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      return await fn(request, reply);
    } catch (error) {
      return errorHandler(error as Error, request, reply);
    }
  };
}; 
import { FastifyBaseLogger, FastifyReply } from "fastify";
import { ApiResponse } from "../types/index.js";
import { BaseError, createErrorFromMessage } from "./errors.js";

/**
 * Gestionnaire d'erreurs centralisé pour l'application
 */
export const handleError = (
  error: unknown,
  reply: FastifyReply,
  logger: FastifyBaseLogger
): FastifyReply => {
  let appError: BaseError;

  // Convertir l'erreur en AppError si ce n'est pas déjà le cas
  if (error instanceof BaseError) {
    appError = error;
  } else if (error instanceof Error) {
    appError = createErrorFromMessage(error.message);
  } else {
    appError = new BaseError("Erreur inconnue");
  }

  // Logger l'erreur avec plus de détails
  logger.error({
    error: appError.message,
    code: appError.code,
    statusCode: appError.statusCode,
    stack: appError.stack,
    timestamp: new Date().toISOString(),
  });

  // Construire la réponse d'erreur
  const errorResponse: ApiResponse = {
    success: false,
    error: appError.message,
    code: appError.code,
  };

  return reply.status(appError.statusCode).send(errorResponse);
};

/**
 * Middleware pour capturer les erreurs non gérées
 */
export const errorHandler = (
  error: Error,
  request: any,
  reply: FastifyReply
) => {
  const logger = request.log || console;
  return handleError(error, reply, logger);
};

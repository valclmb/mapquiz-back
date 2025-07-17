import { AppError } from "../types/index.js";

/**
 * Classe de base pour toutes les erreurs de l'application
 */
export class BaseError extends Error implements AppError {
  public statusCode: number;
  public code: string;

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = "INTERNAL_ERROR"
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Erreur pour les requêtes invalides (400)
 */
export class ValidationError extends BaseError {
  constructor(message: string, code: string = "VALIDATION_ERROR") {
    super(message, 400, code);
  }
}

/**
 * Erreur pour les ressources non trouvées (404)
 */
export class NotFoundError extends BaseError {
  constructor(resource: string, code: string = "NOT_FOUND") {
    super(`${resource} non trouvé`, 404, code);
  }
}

/**
 * Erreur pour les accès non autorisés (401)
 */
export class UnauthorizedError extends BaseError {
  constructor(message: string = "Non autorisé", code: string = "UNAUTHORIZED") {
    super(message, 401, code);
  }
}

/**
 * Erreur pour les accès interdits (403)
 */
export class ForbiddenError extends BaseError {
  constructor(message: string = "Accès interdit", code: string = "FORBIDDEN") {
    super(message, 403, code);
  }
}

/**
 * Erreur pour les conflits (409)
 */
export class ConflictError extends BaseError {
  constructor(message: string, code: string = "CONFLICT") {
    super(message, 409, code);
  }
}

/**
 * Erreur pour les limites dépassées (429)
 */
export class RateLimitError extends BaseError {
  constructor(
    message: string = "Limite de requêtes dépassée",
    code: string = "RATE_LIMIT_EXCEEDED"
  ) {
    super(message, 429, code);
  }
}

/**
 * Erreur pour les services indisponibles (503)
 */
export class ServiceUnavailableError extends BaseError {
  constructor(
    message: string = "Service temporairement indisponible",
    code: string = "SERVICE_UNAVAILABLE"
  ) {
    super(message, 503, code);
  }
}

/**
 * Erreurs spécifiques aux lobbies
 */
export class LobbyError extends BaseError {
  constructor(message: string, code: string = "LOBBY_ERROR") {
    super(message, 400, code);
  }
}

/**
 * Erreurs spécifiques aux amis
 */
export class FriendError extends BaseError {
  constructor(message: string, code: string = "FRIEND_ERROR") {
    super(message, 400, code);
  }
}

/**
 * Erreurs spécifiques aux WebSockets
 */
export class WebSocketError extends BaseError {
  constructor(message: string, code: string = "WEBSOCKET_ERROR") {
    super(message, 400, code);
  }
}

/**
 * Factory pour créer des erreurs basées sur des messages
 */
export function createErrorFromMessage(message: string): BaseError {
  if (message.includes("requis") || message.includes("invalide")) {
    return new ValidationError(message);
  }
  if (message.includes("non trouvé") || message.includes("introuvable")) {
    return new NotFoundError("Ressource");
  }
  if (message.includes("autorisé")) {
    return new UnauthorizedError(message);
  }
  if (message.includes("déjà")) {
    return new ConflictError(message);
  }

  return new BaseError(message);
}

import {
  AddFriendRequest,
  CreateLobbyRequest,
  FriendRequestActionRequest,
  GameProgressRequest,
  LobbySettings,
  PlayerProgressRequest,
  RemoveFriendRequest,
  UpdateLobbySettingsRequest,
} from "../types/index.js";
import { ValidationError } from "./errors.js";

/**
 * Valide une chaîne de caractères non vide
 */
export function validateRequiredString(value: any, fieldName: string): string {
  if (!value || typeof value !== "string" || value.trim().length === 0) {
    throw new ValidationError(`${fieldName} est requis`);
  }
  return value.trim();
}

/**
 * Valide un identifiant UUID
 */
export function validateUUID(value: any, fieldName: string): string {
  const uuid = validateRequiredString(value, fieldName);
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  if (!uuidRegex.test(uuid)) {
    throw new ValidationError(`${fieldName} doit être un UUID valide`);
  }

  return uuid;
}

/**
 * Valide un nombre positif
 */
export function validatePositiveNumber(value: any, fieldName: string): number {
  if (typeof value !== "number" || value < 0) {
    throw new ValidationError(`${fieldName} doit être un nombre positif`);
  }
  return value;
}

/**
 * Valide un pourcentage (0-100)
 */
export function validatePercentage(value: any, fieldName: string): number {
  const num = validatePositiveNumber(value, fieldName);
  if (num > 100) {
    throw new ValidationError(`${fieldName} doit être entre 0 et 100`);
  }
  return num;
}

/**
 * Valide un tableau de chaînes
 */
export function validateStringArray(value: any, fieldName: string): string[] {
  if (!Array.isArray(value)) {
    throw new ValidationError(`${fieldName} doit être un tableau`);
  }

  return value.map((item, index) => {
    if (typeof item !== "string") {
      throw new ValidationError(`${fieldName}[${index}] doit être une chaîne`);
    }
    return item;
  });
}

/**
 * Valide les paramètres de création d'un lobby
 */
export function validateCreateLobbyRequest(data: any): CreateLobbyRequest {
  return {
    name: validateRequiredString(data.name, "name"),
    settings: validateLobbySettings(data.settings || {}),
  };
}

/**
 * Valide les paramètres de mise à jour d'un lobby
 */
export function validateUpdateLobbySettingsRequest(
  data: any
): UpdateLobbySettingsRequest {
  return {
    settings: validateLobbySettings(data.settings || {}),
  };
}

/**
 * Valide les paramètres de progression du jeu
 */
export function validateGameProgressRequest(data: any): GameProgressRequest {
  return {
    score: validatePositiveNumber(data.score, "score"),
    progress: validatePercentage(data.progress, "progress"),
    answerTime: data.answerTime
      ? validatePositiveNumber(data.answerTime, "answerTime")
      : undefined,
    isConsecutiveCorrect:
      typeof data.isConsecutiveCorrect === "boolean"
        ? data.isConsecutiveCorrect
        : undefined,
  };
}

/**
 * Valide les paramètres de progression du joueur
 */
export function validatePlayerProgressRequest(
  data: any
): PlayerProgressRequest {
  return {
    validatedCountries: validateStringArray(
      data.validatedCountries,
      "validatedCountries"
    ),
    incorrectCountries: validateStringArray(
      data.incorrectCountries,
      "incorrectCountries"
    ),
    score: validatePositiveNumber(data.score, "score"),
    progress: validatePercentage(data.progress, "progress"),
  };
}

/**
 * Valide les paramètres d'ajout d'ami
 */
export function validateAddFriendRequest(data: any): AddFriendRequest {
  return {
    tag: validateRequiredString(data.tag, "tag"),
  };
}

/**
 * Valide les paramètres de suppression d'ami
 */
export function validateRemoveFriendRequest(data: any): RemoveFriendRequest {
  return {
    friendId: validateUUID(data.friendId, "friendId"),
  };
}

/**
 * Valide les paramètres de réponse à une demande d'ami
 */
export function validateFriendRequestActionRequest(
  data: any
): FriendRequestActionRequest {
  const action = validateRequiredString(data.action, "action");

  if (action !== "accept" && action !== "reject") {
    throw new ValidationError('action doit être "accept" ou "reject"');
  }

  return { action };
}

/**
 * Valide les paramètres d'un lobby
 */
export function validateLobbySettings(settings: any): LobbySettings {
  const validated: LobbySettings = {};

  if (settings.totalQuestions !== undefined) {
    validated.totalQuestions = validatePositiveNumber(
      settings.totalQuestions,
      "totalQuestions"
    );
  }

  if (settings.timeLimit !== undefined) {
    validated.timeLimit = validatePositiveNumber(
      settings.timeLimit,
      "timeLimit"
    );
  }

  if (settings.difficulty !== undefined) {
    const difficulty = validateRequiredString(
      settings.difficulty,
      "difficulty"
    );
    if (!["easy", "medium", "hard"].includes(difficulty)) {
      throw new ValidationError(
        'difficulty doit être "easy", "medium" ou "hard"'
      );
    }
    validated.difficulty = difficulty as "easy" | "medium" | "hard";
  }

  // Permettre des propriétés supplémentaires
  Object.keys(settings).forEach((key) => {
    if (!["totalQuestions", "timeLimit", "difficulty"].includes(key)) {
      validated[key] = settings[key];
    }
  });

  return validated;
}

/**
 * Valide un identifiant de lobby
 */
export function validateLobbyId(lobbyId: any): string {
  return validateUUID(lobbyId, "lobbyId");
}

/**
 * Valide un identifiant d'utilisateur
 */
export function validateUserId(userId: any): string {
  return validateUUID(userId, "userId");
}

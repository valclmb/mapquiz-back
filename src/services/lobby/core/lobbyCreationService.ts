import { loggers } from "../../../config/logger.js";
import { ValidationError } from "../../../lib/errors.js";
import {
  validateLobbySettings,
  validateRequiredString,
} from "../../../lib/validation.js";
import { lobbyRepository } from "../../../repositories/lobbyRepository.js";
import { LobbySettings } from "../../../types/index.js";
import { LobbyManager } from "../../../websocket/lobby/lobbyManagerStub.js";

/**
 * Service focalisé sur la création de lobbies
 */
export class LobbyCreationService {
  /**
   * Crée un nouveau lobby avec validation
   */
  static async createLobby(
    userId: string,
    name: string,
    settings: LobbySettings = {}
  ) {
    // Validation des entrées
    const validatedName = validateRequiredString(name, "name");
    const validatedSettings = validateLobbySettings(settings);

    if (validatedName.length < 3 || validatedName.length > 50) {
      throw new ValidationError(
        "Le nom du lobby doit contenir entre 3 et 50 caractères"
      );
    }

    loggers.lobby.info("Création d'un nouveau lobby", {
      userId,
      name: validatedName,
      settings: validatedSettings,
    });

    try {
      // Création en base de données
      const lobby = await lobbyRepository.create(
        userId,
        validatedName,
        validatedSettings
      );

      loggers.lobby.info("Lobby créé avec succès", {
        lobbyId: lobby.id,
        hostId: lobby.hostId,
      });

      // Initialisation en mémoire pour WebSocket
      LobbyManager.createLobby(
        lobby.id,
        lobby.hostId,
        lobby.name || "",
        lobby.gameSettings || {}
      );

      return {
        success: true,
        lobby: {
          id: lobby.id,
          name: lobby.name,
          hostId: lobby.hostId,
          settings: lobby.gameSettings,
          players: lobby.players.map((p) => ({
            id: p.userId,
            name: p.user?.name || "",
            status: p.status,
            isHost: p.userId === lobby.hostId,
          })),
        },
      };
    } catch (error) {
      loggers.lobby.error("Erreur lors de la création du lobby", {
        userId,
        name: validatedName,
        error: error instanceof Error ? error.message : "Unknown error",
      });
      throw error;
    }
  }
}

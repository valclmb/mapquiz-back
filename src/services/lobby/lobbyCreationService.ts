import { APP_CONSTANTS } from "../../lib/config.js";
import { LobbyError, NotFoundError } from "../../lib/errors.js";
import {
  validateCreateLobbyRequest,
  validateLobbyId,
} from "../../lib/validation.js";
import * as LobbyModel from "../../models/lobbyModel.js";
import * as UserModel from "../../models/userModel.js";
import { LobbyPlayer, LobbySettings } from "../../types/index.js";
import * as LobbyManager from "../../websocket/lobby/lobbyManager.js";

/**
 * Service dédié à la création et gestion de base des lobbies
 */
export class LobbyCreationService {
  /**
   * Crée un nouveau lobby
   */
  static async createLobby(
    userId: string,
    name: string,
    settings: LobbySettings
  ) {
    // Valider les données d'entrée
    const validatedData = validateCreateLobbyRequest({ name, settings });

    // Récupérer les informations de l'utilisateur
    const user = await UserModel.findUserById(userId);
    if (!user) {
      throw new NotFoundError("Utilisateur");
    }

    // Créer le lobby dans la base de données
    const lobby = await LobbyModel.createLobby(
      userId,
      validatedData.name,
      validatedData.settings
    );

    // Créer le lobby en mémoire pour la gestion en temps réel
    LobbyManager.createLobby(
      lobby.id,
      userId,
      user.name,
      validatedData.settings
    );

    // Construire la réponse
    const players: LobbyPlayer[] = [
      {
        id: userId,
        name: user.name,
        status: APP_CONSTANTS.PLAYER_STATUS.JOINED, // L'hôte commence comme "rejoint", pas "prêt"
      },
    ];

    return {
      success: true,
      lobby,
      players,
      hostId: userId,
      settings: validatedData.settings,
    };
  }

  /**
   * Récupère un lobby par son ID
   */
  static async getLobby(lobbyId: string) {
    const validatedLobbyId = validateLobbyId(lobbyId);
    const lobby = await LobbyModel.getLobby(validatedLobbyId);

    if (!lobby) {
      throw new NotFoundError("Lobby");
    }

    return lobby;
  }

  /**
   * Vérifie si un utilisateur est l'hôte d'un lobby
   */
  static async verifyHostPermissions(
    userId: string,
    lobbyId: string
  ): Promise<void> {
    const lobby = await this.getLobby(lobbyId);

    if (lobby.hostId !== userId) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }
  }

  /**
   * Vérifie si un joueur est dans un lobby
   */
  static async verifyPlayerInLobby(userId: string, lobbyId: string) {
    const validatedLobbyId = validateLobbyId(lobbyId);
    const player = await LobbyModel.getPlayerInLobby(validatedLobbyId, userId);

    if (!player) {
      throw new NotFoundError("Joueur dans le lobby");
    }

    return player;
  }

  /**
   * Supprime un lobby
   */
  static async deleteLobby(lobbyId: string, userId: string) {
    await this.verifyHostPermissions(userId, lobbyId);

    const validatedLobbyId = validateLobbyId(lobbyId);
    await LobbyModel.deleteLobby(validatedLobbyId);
    LobbyManager.removeLobby(validatedLobbyId);

    return { success: true, message: "Lobby supprimé" };
  }
}

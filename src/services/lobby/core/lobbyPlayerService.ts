import { loggers } from "../../../config/logger.js";
import { APP_CONSTANTS } from "../../../lib/config.js";
import {
  LobbyError,
  NotFoundError,
  ValidationError,
} from "../../../lib/errors.js";
import { validateLobbyId, validateUserId } from "../../../lib/validation.js";
import { lobbyRepository } from "../../../repositories/lobbyRepository.js";
import { sendToUser } from "../../../websocket/core/connectionManager.js";
import { LobbyManager } from "../../../websocket/lobby/lobbyManagerStub.js";

/**
 * Service dédié à la gestion des joueurs dans les lobbies
 */
export class LobbyPlayerService {
  /**
   * Invite un ami dans un lobby
   */
  static async inviteToLobby(
    hostId: string,
    lobbyId: string,
    friendId: string
  ) {
    const validatedLobbyId = validateLobbyId(lobbyId);
    const validatedFriendId = validateUserId(friendId);

    const lobby = await lobbyRepository.findById(validatedLobbyId, false);
    if (!lobby || lobby.hostId !== hostId) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    // Vérifier si le joueur est déjà dans le lobby
    const existingPlayer = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedFriendId
    );
    if (existingPlayer) {
      return { success: true, message: "Joueur déjà dans le lobby" };
    }

    // Ajouter l'utilisateur à la liste des joueurs autorisés
    await lobbyRepository.addAuthorizedPlayer(
      validatedLobbyId,
      validatedFriendId
    );

    // Envoyer une notification à l'ami
    sendToUser(validatedFriendId, {
      type: "lobby_invitation",
      payload: {
        lobbyId: validatedLobbyId,
        hostId,
        hostName: lobby.host.name,
        lobbyName: lobby.name,
      },
    });

    loggers.player.info("Invitation envoyée", {
      lobbyId: validatedLobbyId,
      friendId: validatedFriendId,
      hostId,
    });

    return { success: true, message: "Invitation envoyée" };
  }

  /**
   * Rejoint un lobby
   */
  static async joinLobby(userId: string, lobbyId: string) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findById(validatedLobbyId, false);
    if (!lobby) {
      throw new NotFoundError("Lobby");
    }

    // Vérifier l'autorisation
    if (!lobby.authorizedPlayers.includes(validatedUserId)) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    // Vérifier si le joueur est déjà dans le lobby
    const existingPlayer = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (existingPlayer) {
      // Mise à jour du statut si nécessaire
      if (existingPlayer.status !== APP_CONSTANTS.PLAYER_STATUS.JOINED) {
        await lobbyRepository.updatePlayerStatus(
          validatedLobbyId,
          validatedUserId,
          APP_CONSTANTS.PLAYER_STATUS.JOINED
        );
      }
    } else {
      // Ajouter le joueur à la base de données
      await lobbyRepository.addPlayer(
        validatedLobbyId,
        validatedUserId,
        APP_CONSTANTS.PLAYER_STATUS.JOINED
      );
    }

    // Mise à jour en mémoire
    LobbyManager.addPlayerToLobby(validatedLobbyId, validatedUserId);

    // Diffuser la mise à jour
    // await BroadcastManager.broadcastLobbyUpdate(validatedLobbyId, lobby);

    loggers.player.info("Joueur rejoint le lobby", {
      userId: validatedUserId,
      lobbyId: validatedLobbyId,
    });

    return { success: true, message: "Lobby rejoint avec succès" };
  }

  /**
   * Quitte un lobby
   */
  static async leaveLobby(userId: string, lobbyId: string) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    const lobby = await lobbyRepository.findById(validatedLobbyId, false);
    if (!lobby) {
      throw new NotFoundError("Lobby");
    }

    const player = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (!player) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.PLAYER_NOT_IN_LOBBY);
    }

    // Supprimer le joueur de la base de données
    await lobbyRepository.removePlayer(validatedLobbyId, validatedUserId);

    // Supprimer de la mémoire
    const memoryRemoved = LobbyManager.removePlayerFromLobby(
      validatedLobbyId,
      validatedUserId
    );

    loggers.player.info("Joueur quitté le lobby", {
      userId: validatedUserId,
      lobbyId: validatedLobbyId,
      wasHost: lobby.hostId === validatedUserId,
      memoryRemoved,
    });

    // Si c'est l'hôte qui quitte, terminer la partie
    if (lobby.hostId === validatedUserId) {
      await this._handleHostLeaving(validatedLobbyId);
      return { success: true, message: "Lobby terminé car l'hôte a quitté" };
    }

    // Diffuser la mise à jour
    // await BroadcastManager.broadcastLobbyUpdate(validatedLobbyId, lobby);

    return { success: true, message: "Lobby quitté avec succès" };
  }

  /**
   * Met à jour le statut de préparation d'un joueur
   */
  static async setPlayerReady(userId: string, lobbyId: string, ready: boolean) {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    if (typeof ready !== "boolean") {
      throw new ValidationError("ready doit être un booléen");
    }

    const player = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (!player) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.PLAYER_NOT_IN_LOBBY);
    }

    const newStatus = ready
      ? APP_CONSTANTS.PLAYER_STATUS.READY
      : APP_CONSTANTS.PLAYER_STATUS.JOINED;

    // Mise à jour en base de données
    await lobbyRepository.updatePlayerStatus(
      validatedLobbyId,
      validatedUserId,
      newStatus
    );

    // Mise à jour en mémoire
    LobbyManager.updatePlayerStatus(
      validatedLobbyId,
      validatedUserId,
      newStatus
    );

    // Diffuser la mise à jour
    // await BroadcastManager.broadcastLobbyUpdate(validatedLobbyId, lobby);

    loggers.player.debug("Statut de préparation mis à jour", {
      userId: validatedUserId,
      lobbyId: validatedLobbyId,
      ready,
      newStatus,
    });

    return { success: true, ready };
  }

  /**
   * Met à jour le statut absent d'un joueur
   */
  static async setPlayerAbsent(
    userId: string,
    lobbyId: string,
    absent: boolean
  ): Promise<{ changed: boolean }> {
    const validatedUserId = validateUserId(userId);
    const validatedLobbyId = validateLobbyId(lobbyId);

    if (typeof absent !== "boolean") {
      throw new ValidationError("absent doit être un booléen");
    }

    const player = await lobbyRepository.findPlayer(
      validatedLobbyId,
      validatedUserId
    );
    if (!player) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.PLAYER_NOT_IN_LOBBY);
    }

    // Vérifier si le changement est nécessaire
    const currentAbsent = player.status === "absent";
    if (currentAbsent === absent) {
      return { changed: false };
    }

    // Mise à jour en base de données
    await lobbyRepository.updatePlayerAbsence(
      validatedLobbyId,
      validatedUserId,
      absent
    );

    // Mise à jour en mémoire
    LobbyManager.updatePlayerAbsence(validatedLobbyId, validatedUserId, absent);

    // Diffuser la mise à jour
    // await BroadcastManager.broadcastLobbyUpdate(validatedLobbyId, lobby);

    loggers.player.debug("Statut d'absence mis à jour", {
      userId: validatedUserId,
      lobbyId: validatedLobbyId,
      absent,
    });

    return { changed: true };
  }

  /**
   * Gère le départ de l'hôte
   */
  private static async _handleHostLeaving(lobbyId: string) {
    loggers.lobby.info("Hôte quitté, terminaison du lobby", { lobbyId });

    // Marquer le lobby comme terminé
    await lobbyRepository.updateStatus(
      lobbyId,
      APP_CONSTANTS.LOBBY_STATUS.FINISHED
    );

    // Nettoyer la mémoire
    LobbyManager.removeLobby(lobbyId);

    // Notifier tous les joueurs
    // await BroadcastManager.broadcastToLobby(lobbyId, {
    //   type: 'lobby_ended',
    //   payload: {
    //     reason: 'host_left',
    //     message: 'Le lobby a été fermé car l\'hôte a quitté'
    //   }
    // });
  }
}

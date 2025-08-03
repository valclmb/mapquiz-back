import * as LobbyModel from "../models/lobbyModel.js";
import * as UserModel from "../models/userModel.js";
import { sendToUser } from "../websocket/core/connectionManager.js";

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
    // Vérifier que l'utilisateur est bien l'hôte du lobby
    const lobby = await LobbyModel.getLobby(lobbyId);
    if (!lobby || lobby.hostId !== hostId) {
      throw new Error("Non autorisé à inviter des joueurs dans ce lobby");
    }

    // Vérifier si le joueur est déjà dans le lobby
    const existingPlayer = await LobbyModel.getPlayerInLobby(lobbyId, friendId);

    // Si le joueur est déjà dans le lobby, ne pas renvoyer d'invitation
    if (existingPlayer) {
      return { success: true, message: "Joueur déjà dans le lobby" };
    }

    // Ajouter l'utilisateur à la liste des joueurs autorisés
    await LobbyModel.addAuthorizedPlayer(lobbyId, friendId);

    // Envoyer une notification à l'ami
    sendToUser(friendId, {
      type: "lobby_invitation",
      payload: {
        lobbyId,
        hostId,
        hostName: lobby.host.name,
        lobbyName: lobby.name,
      },
    });

    return { success: true, message: "Invitation envoyée" };
  }

  /**
   * Rejoint un lobby
   */
  static async joinLobby(userId: string, lobbyId: string) {
    console.log(
      `joinLobby - Tentative de rejoindre le lobby ${lobbyId} par l'utilisateur ${userId}`
    );

    // Vérifier que le lobby existe
    const lobby = await LobbyModel.getLobby(lobbyId);
    console.log(
      `joinLobby - Résultat de getLobby pour ${lobbyId}:`,
      lobby ? "trouvé" : "non trouvé"
    );

    if (!lobby) {
      console.log(`joinLobby - Lobby ${lobbyId} non trouvé en base de données`);
      throw new Error("Lobby non trouvé");
    }

    // Vérifier si l'utilisateur est autorisé à rejoindre le lobby
    if (!lobby.authorizedPlayers.includes(userId) && lobby.hostId !== userId) {
      console.log(
        `joinLobby - Utilisateur ${userId} non autorisé à rejoindre le lobby ${lobbyId}`
      );
      throw new Error("Vous n'êtes pas autorisé à rejoindre ce lobby");
    }

    // Vérifier si l'utilisateur est déjà dans le lobby
    const existingPlayer = await LobbyModel.getPlayerInLobby(lobbyId, userId);

    // Récupérer les informations de l'utilisateur
    const user = await UserModel.findUserById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }

    // Si l'utilisateur n'est pas déjà dans le lobby, l'ajouter
    if (!existingPlayer) {
      await LobbyModel.addPlayerToLobby(lobbyId, userId, "joined");
    } else {
      // Mettre à jour le statut du joueur dans la base de données
      await LobbyModel.updatePlayerStatus(lobbyId, userId, "joined");
    }

    return { success: true, message: "Joueur ajouté au lobby" };
  }

  /**
   * Quitte un lobby
   */
  static async leaveLobby(userId: string, lobbyId: string) {
    // Vérifier que le lobby existe
    const lobby = await LobbyModel.getLobby(lobbyId);
    if (!lobby) {
      throw new Error("Lobby non trouvé");
    }

    // Vérifier si l'utilisateur est dans le lobby
    const existingPlayer = await LobbyModel.getPlayerInLobby(lobbyId, userId);
    if (!existingPlayer) {
      throw new Error("Vous n'êtes pas dans ce lobby");
    }

    // Retirer le joueur du lobby
    await LobbyModel.removePlayerFromLobby(lobbyId, userId);

    return { success: true, message: "Joueur retiré du lobby" };
  }

  /**
   * Met à jour le statut de préparation d'un joueur
   */
  static async setPlayerReady(userId: string, lobbyId: string, ready: boolean) {
    const status = ready ? "ready" : "joined";
    await LobbyModel.updatePlayerStatus(lobbyId, userId, status);
    return {
      success: true,
      message: `Joueur marqué comme ${ready ? "prêt" : "non prêt"}`,
    };
  }

  /**
   * Met à jour le statut absent d'un joueur
   */
  static async setPlayerAbsent(
    userId: string,
    lobbyId: string,
    absent: boolean
  ): Promise<{ changed: boolean }> {
    const status = absent ? "absent" : "joined";
    await LobbyModel.updatePlayerStatus(lobbyId, userId, status);
    return { changed: true };
  }
}

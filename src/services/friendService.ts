import * as FriendModel from "../models/friendModel.js";
import * as UserModel from "../models/userModel.js";
import { sendToUser } from "../websocket/core/connectionManager.js";

/**
 * Service unifié pour la gestion des amis
 */
export class FriendService {
  /**
   * Envoie une demande d'ami
   */
  static async sendFriendRequest(senderId: string, tag: string) {
    if (!tag || tag.trim().length === 0) {
      throw new Error("Le tag est requis");
    }

    const friendUser = await UserModel.findUserByTag(tag);
    if (!friendUser) {
      throw new Error("Utilisateur non trouvé");
    }

    if (friendUser.id === senderId) {
      throw new Error("Vous ne pouvez pas vous ajouter vous-même");
    }

    const existingFriendship = await FriendModel.findFriendship(
      senderId,
      friendUser.id
    );
    if (existingFriendship) {
      throw new Error("Vous êtes déjà amis avec cet utilisateur");
    }

    const pendingRequest = await FriendModel.findPendingFriendRequest(
      senderId,
      friendUser.id
    );
    if (pendingRequest) {
      throw new Error("Une demande est déjà en attente");
    }

    const friendRequest = await FriendModel.createFriendRequest(
      senderId,
      friendUser.id
    );

    // Notifier l'ami
    sendToUser(friendUser.id, {
      type: "friend_request_received",
    });

    return {
      success: true,
      message: "Demande d'ami envoyée",
      receiverId: friendUser.id,
    };
  }

  /**
   * Répond à une demande d'ami
   */
  static async respondToFriendRequest(
    requestId: string,
    action: "accept" | "reject",
    userId: string
  ) {
    if (!action || !["accept", "reject"].includes(action)) {
      throw new Error("Action invalide");
    }

    const request = await FriendModel.findFriendRequestById(requestId);
    if (!request) {
      throw new Error("Demande d'ami non trouvée");
    }

    if (request.receiverId !== userId) {
      throw new Error("Non autorisé");
    }

    if (request.status !== "pending") {
      throw new Error("Demande déjà traitée");
    }

    const status = action === "accept" ? "accepted" : "rejected";
    await FriendModel.updateFriendRequestStatus(requestId, status);

    if (action === "accept") {
      await FriendModel.createMutualFriendship(request.senderId, userId);

      // CORRECTIF C4.2.2: Notifier seulement l'utilisateur qui a envoyé la demande (User A)
      // User B voit déjà sa liste se mettre à jour automatiquement
      // Ce correctif a été implémenté suite au retour utilisateur signalant que
      // l'expéditeur devait rafraîchir la page pour voir sa liste d'amis mise à jour
      sendToUser(request.senderId, {
        type: "friend_request_accepted",
        payload: {
          success: true,
          acceptedBy: userId,
          friendId: userId,
        },
      });
    }

    return {
      success: true,
      message: action === "accept" ? "Demande acceptée" : "Demande rejetée",
    };
  }

  /**
   * Récupère la liste des amis
   */
  static async getFriendsList(userId: string) {
    const friends = await FriendModel.findUserFriends(userId);
    return {
      friends: friends.map((f: any) => f.friend),
    };
  }

  /**
   * Supprime un ami
   */
  static async removeFriend(userId: string, friendId: string) {
    if (!friendId) {
      throw new Error("ID d'ami requis");
    }
    await FriendModel.removeMutualFriendship(userId, friendId);
    return {
      success: true,
      message: "Ami supprimé avec succès",
    };
  }

  /**
   * Récupère les demandes d'amis
   */
  static async getFriendRequests(userId: string) {
    return await FriendModel.findFriendRequests(userId);
  }

  /**
   * Notifie les amis d'un changement de statut
   */
  static async notifyFriendsOfStatusChange(userId: string, isOnline: boolean) {
    try {
      // Vérifier le statut actuel
      const user = await UserModel.findUserById(userId);
      if (!user) return false;
      if (user.isOnline === isOnline) {
        // Pas de changement de statut, ne rien faire
        return false;
      }

      // Récupérer tous les amis de l'utilisateur
      const friends = await FriendModel.findUserFriends(userId);

      // Obtenir la date actuelle pour lastSeen
      const lastSeen = new Date().toISOString();

      // Notifier chaque ami du changement de statut
      for (const friendship of friends) {
        sendToUser(friendship.friend.id, {
          type: "friend_status_change",
          payload: {
            friendId: userId,
            isOnline,
            lastSeen,
          },
        });
      }

      // Mettre à jour le statut de l'utilisateur dans la base de données
      await UserModel.updateUserStatus(userId, isOnline, lastSeen);
      return true;
    } catch (error) {
      console.error("Erreur lors de la notification des amis:", error);
      return false;
    }
  }
}

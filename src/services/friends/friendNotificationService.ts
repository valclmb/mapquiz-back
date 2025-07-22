import * as FriendModel from "../../models/friendModel.js";
import * as UserModel from "../../models/userModel.js";
import { sendToUser } from "../../websocket/core/connectionManager.js";

/**
 * Service dédié aux notifications de statut d'amis
 */
export class FriendNotificationService {
  /**
   * Notifie tous les amis d'un utilisateur d'un changement de statut (en ligne/hors ligne)
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

import { ValidationError } from "../../lib/errors.js";
import * as FriendModel from "../../models/friendModel.js";

/**
 * Service dédié à la gestion de la liste d'amis
 */
export class FriendListService {
  /**
   * Récupère la liste des amis d'un utilisateur
   */
  static async getFriendsList(userId: string) {
    const friends = await FriendModel.findUserFriends(userId);
    return {
      friends: friends.map((f) => f.friend),
    };
  }

  /**
   * Supprime un ami
   */
  static async removeFriend(userId: string, friendId: string) {
    if (!friendId) {
      throw new ValidationError("ID d'ami requis");
    }
    await FriendModel.removeMutualFriendship(userId, friendId);
    return {
      success: true,
      message: "Ami supprimé avec succès",
    };
  }
}


import * as UserModel from "../models/userModel.js";

/**
 * Service unifié pour la gestion des utilisateurs
 */
export class UserService {
  /**
   * Récupère un utilisateur par son ID
   */
  static async getUserById(userId: string) {
    const user = await UserModel.findUserById(userId);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }
    return user;
  }

  /**
   * Récupère un utilisateur par son tag
   */
  static async getUserByTag(tag: string) {
    const user = await UserModel.findUserByTag(tag);
    if (!user) {
      throw new Error("Utilisateur non trouvé");
    }
    return user;
  }

  /**
   * Met à jour le statut en ligne d'un utilisateur
   */
  static async updateUserStatus(userId: string, isOnline: boolean) {
    const lastSeen = new Date().toISOString();
    await UserModel.updateUserStatus(userId, isOnline, lastSeen);
    return { success: true };
  }

  /**
   * Récupère la liste des utilisateurs (pour la recherche d'amis)
   */
  static async getUsersList() {
    const users = await UserModel.findAllUsers();
    return {
      users: users.map(user => ({
        id: user.id,
        name: user.name,
        tag: user.tag,
        isOnline: user.isOnline,
        lastSeen: user.lastSeen,
      })),
    };
  }
}

import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from "../../lib/errors.js";
import {
  validateAddFriendRequest,
  validateFriendRequestActionRequest,
} from "../../lib/validation.js";
import * as FriendModel from "../../models/friendModel.js";
import * as UserModel from "../../models/userModel.js";
import { sendToUser } from "../../websocket/core/connectionManager.js";

/**
 * Interface pour le résultat d'une demande d'ami
 */
export interface FriendRequestResult {
  success: boolean;
  message: string;
  receiverId?: string;
}

/**
 * Service dédié à la gestion des demandes d'amis
 */
export class FriendRequestService {
  /**
   * Envoie une demande d'ami
   */
  static async sendFriendRequest(
    senderId: string,
    tag: string
  ): Promise<FriendRequestResult> {
    // Valider les données d'entrée
    const validatedData = validateAddFriendRequest({ tag });

    // Trouver l'utilisateur par son tag
    const friendUser = await UserModel.findUserByTag(validatedData.tag);
    if (!friendUser) {
      throw new NotFoundError("Utilisateur");
    }

    // Vérifier que l'utilisateur ne s'ajoute pas lui-même
    if (friendUser.id === senderId) {
      throw new ValidationError("Vous ne pouvez pas vous ajouter vous-même");
    }

    // Vérifier si l'amitié existe déjà
    const existingFriendship = await FriendModel.findFriendship(
      senderId,
      friendUser.id
    );
    if (existingFriendship) {
      throw new ConflictError("Vous êtes déjà amis avec cet utilisateur");
    }

    // Vérifier s'il y a déjà une demande en attente
    const pendingRequest = await FriendModel.findPendingFriendRequest(
      senderId,
      friendUser.id
    );
    if (pendingRequest) {
      throw new ConflictError("Une demande est déjà en attente");
    }

    // Créer la demande d'ami
    const friendRequest = await FriendModel.createFriendRequest(
      senderId,
      friendUser.id
    );

    // Envoyer une notification à l'ami
    this.sendFriendRequestNotification(friendUser.id, friendRequest, senderId);

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
  ): Promise<{ success: boolean; message: string }> {
    // Valider les données d'entrée
    const validatedData = validateFriendRequestActionRequest({ action });

    // Trouver la demande
    const request = await FriendModel.findFriendRequestById(requestId);
    if (!request) {
      throw new NotFoundError("Demande d'ami");
    }

    // Vérifier que l'utilisateur est bien le destinataire
    if (request.receiverId !== userId) {
      throw new ValidationError("Non autorisé");
    }

    // Vérifier que la demande est encore en attente
    if (request.status !== "pending") {
      throw new ConflictError("Demande déjà traitée");
    }

    // Traiter la demande
    const status = validatedData.action === "accept" ? "accepted" : "rejected";
    await FriendModel.updateFriendRequestStatus(requestId, status);

    // Si acceptée, créer l'amitié mutuelle
    if (validatedData.action === "accept") {
      await FriendModel.createMutualFriendship(request.senderId, userId);
    }

    return {
      success: true,
      message:
        validatedData.action === "accept"
          ? "Demande acceptée"
          : "Demande rejetée",
    };
  }

  /**
   * Envoie une notification de demande d'ami
   */
  private static sendFriendRequestNotification(
    receiverId: string,
    friendRequest: any,
    senderId: string
  ): void {
    const notificationSent = sendToUser(receiverId, {
      type: "friend_request_received",
      payload: {
        request: {
          id: friendRequest.id,
          senderId,
          senderName: "Nom de l'expéditeur", // TODO: Récupérer le vrai nom
          senderTag: "Tag de l'expéditeur", // TODO: Récupérer le vrai tag
        },
      },
    });

    if (notificationSent) {
      // console.log(`Notification envoyée à l'utilisateur ${receiverId}`);
    } else {
      // console.log(
      //   `Utilisateur ${receiverId} pas connecté - notification ignorée`
      // );
    }
  }
}

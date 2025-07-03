import { prisma } from "../lib/database.js";
import * as FriendModel from "../models/friendModel.js";
import * as UserModel from "../models/userModel.js";
import { sendToUser } from "../websocket/connectionManager.js";

interface FriendRequestResult {
  success: boolean;
  message: string;
  receiverId?: string;
}

export const sendFriendRequest = async (
  senderId: string,
  tag: string
): Promise<FriendRequestResult> => {
  if (!tag) {
    throw new Error("Tag requis");
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
  const notificationSent = sendToUser(friendUser.id, {
    type: "friend_request_received",
    payload: {
      request: {
        id: friendRequest.id,
        senderId,
        senderName: "Nom de l'expéditeur",
        senderTag: "Tag de l'expéditeur",
      },
    },
  });

  if (notificationSent) {
    console.log(`Notification envoyée à l'utilisateur ${friendUser.id}`);
  } else {
    console.log(
      `Utilisateur ${friendUser.id} pas connecté - notification ignorée`
    );
  }

  return {
    success: true,
    message: "Demande d'ami envoyée",
    receiverId: friendUser.id,
  };
};

export const getFriendsList = async (userId: string) => {
  const friends = await FriendModel.findUserFriends(userId);
  return {
    friends: friends.map((f) => f.friend),
  };
};

export const getFriendRequests = async (userId: string) => {
  const friendRequests = await FriendModel.findFriendRequests(userId);
  return { friendRequests };
};

export const respondToFriendRequest = async (
  requestId: string,
  action: "accept" | "reject",
  userId: string
) => {
  if (!["accept", "reject"].includes(action)) {
    throw new Error("Action invalide");
  }

  const request = await prisma.friendRequest.findUnique({
    where: { id: requestId },
    include: { sender: true },
  });

  if (!request) {
    throw new Error("Demande non trouvée");
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
  }

  return {
    success: true,
    message: action === "accept" ? "Demande acceptée" : "Demande rejetée",
  };
};

export const removeFriend = async (userId: string, friendId: string) => {
  if (!friendId) {
    throw new Error("ID d'ami requis");
  }

  await FriendModel.removeMutualFriendship(userId, friendId);

  return {
    success: true,
    message: "Ami supprimé avec succès",
  };
};

// Nouvelle fonction pour notifier les amis d'un changement de statut
export const notifyFriendsOfStatusChange = async (
  userId: string,
  isOnline: boolean
) => {
  try {
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
};

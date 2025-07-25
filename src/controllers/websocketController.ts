import { FriendService } from "../services/friendService.js";
import { UserService } from "../services/userService.js";
import { updatePlayerStatus as updatePlayerStatusInLobby } from "../websocket/lobby/lobbyManager.js";

export const handleSendFriendRequest = async (payload: any, userId: string) => {
  const { receiverTag } = payload;

  if (!receiverTag) {
    throw new Error("receiverTag requis");
  }

  return await FriendService.sendFriendRequest(userId, receiverTag);
};

export const handleRespondFriendRequest = async (
  payload: any,
  userId: string
) => {
  const { requestId, action } = payload;

  if (!requestId || !action) {
    throw new Error("requestId et action requis");
  }

  return await FriendService.respondToFriendRequest(requestId, action, userId);
};



export const handleUpdatePlayerStatus = async (payload: any, userId: string) => {
  const { lobbyId, status } = payload;

  if (!lobbyId || !status) {
    throw new Error("lobbyId et status requis");
  }

  return await updatePlayerStatusInLobby(lobbyId, userId, status);
};

export const handleStartGame = async (payload: any, userId: string) => {
  const { lobbyId } = payload;

  if (!lobbyId) {
    throw new Error("lobbyId requis");
  }

  // Cette fonctionnalité sera gérée par le LobbyManager
  return { success: true, message: "Démarrage de la partie" };
};



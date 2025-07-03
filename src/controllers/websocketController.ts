import * as FriendService from "../services/friendService.js";
import * as LobbyService from "../services/lobbyService.js";

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

export const handleCreateLobby = async (payload: any, userId: string) => {
  const { name, settings } = payload;
  return await LobbyService.createLobby(userId, name, settings);
};

export const handleInviteToLobby = async (payload: any, userId: string) => {
  const { lobbyId, friendId } = payload;
  return await LobbyService.inviteToLobby(userId, lobbyId, friendId);
};

export const handleJoinLobby = async (payload: any, userId: string) => {
  const { lobbyId } = payload;
  return await LobbyService.joinLobby(userId, lobbyId);
};

export const handleLeaveLobby = async (payload: any, userId: string) => {
  const { lobbyId } = payload;
  return await LobbyService.leaveLobby(userId, lobbyId);
};

export const handleUpdateLobbySettings = async (
  payload: any,
  userId: string
) => {
  const { lobbyId, settings } = payload;
  return await LobbyService.updateLobbySettings(userId, lobbyId, settings);
};

export const handleSetPlayerReady = async (payload: any, userId: string) => {
  const { lobbyId, ready } = payload;
  return await LobbyService.setPlayerReady(userId, lobbyId, ready);
};

export const handleStartGame = async (payload: any, userId: string) => {
  const { lobbyId } = payload;
  return await LobbyService.startGame(userId, lobbyId);
};

export const handleUpdateGameProgress = async (
  payload: any,
  userId: string
) => {
  const { lobbyId, score, progress, answerTime, isConsecutiveCorrect } =
    payload;
  return await LobbyService.updateGameProgress(
    userId,
    lobbyId,
    score,
    progress,
    answerTime,
    isConsecutiveCorrect
  );
};

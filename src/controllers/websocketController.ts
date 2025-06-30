import * as FriendService from "../services/friendService.js";

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

import * as FriendModel from "../models/friendModel.js";
import { FriendListService } from "./friends/friendListService.js";
import { FriendNotificationService } from "./friends/friendNotificationService.js";
import { FriendRequestService } from "./friends/friendRequestService.js";

export const sendFriendRequest = FriendRequestService.sendFriendRequest;
export const respondToFriendRequest =
  FriendRequestService.respondToFriendRequest;
export const getFriendsList = FriendListService.getFriendsList;
export const removeFriend = FriendListService.removeFriend;
export const notifyFriendsOfStatusChange =
  FriendNotificationService.notifyFriendsOfStatusChange;

export const getFriendRequests = async (userId: string) => {
  const friendRequests = await FriendModel.findFriendRequests(userId);
  return { friendRequests };
};

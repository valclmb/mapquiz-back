import { FastifyReply, FastifyRequest } from "fastify";
import { asyncHandler } from "../lib/errorHandler.js";
import { FriendService } from "../services/friendService.js";
import {
  AddFriendRequest,
  FriendRequestActionRequest,
  RemoveFriendRequest,
} from "../types/api.js";

export const addFriend = asyncHandler(
  async (request: FastifyRequest<AddFriendRequest>, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const { tag } = request.body;

    const result = await FriendService.sendFriendRequest(userId, tag);
    return reply.send(result);
  }
);

export const listFriends = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const result = await FriendService.getFriendsList(userId);
    return reply.send(result);
  }
);

export const getFriendRequests = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const requests = await FriendService.getFriendRequests(userId);
    return reply.send({ friendRequests: requests });
  }
);

export const respondToFriendRequest = asyncHandler(
  async (
    request: FastifyRequest<FriendRequestActionRequest>,
    reply: FastifyReply
  ) => {
    const userId = (request as any).user.id;
    const { id } = request.params;
    const { action } = request.body;

    const result = await FriendService.respondToFriendRequest(
      id,
      action,
      userId
    );
    return reply.send(result);
  }
);

export const removeFriend = asyncHandler(
  async (request: FastifyRequest<RemoveFriendRequest>, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const { friendId } = request.body;

    const result = await FriendService.removeFriend(userId, friendId);
    return reply.send(result);
  }
);

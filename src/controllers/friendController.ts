import { handleError } from "@/lib/errorHandler.js";
import { FastifyReply, FastifyRequest } from "fastify";
import * as FriendService from "../services/friendService.js";

interface AddFriendRequest {
  Body: { tag: string };
}

interface RemoveFriendRequest {
  Body: { friendId: string };
}

interface FriendRequestActionRequest {
  Body: { action: "accept" | "reject" };
  Params: { id: string };
}

export const addFriend = async (
  request: FastifyRequest<AddFriendRequest>,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const { tag } = request.body;

    const result = await FriendService.sendFriendRequest(userId, tag);
    return reply.send(result);
  } catch (error) {
    return handleError(error, reply, request.log);
  }
};

export const listFriends = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const result = await FriendService.getFriendsList(userId);
    return reply.send(result);
  } catch (error) {
    return handleError(error, reply, request.log);
  }
};

export const getFriendRequests = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const result = await FriendService.getFriendRequests(userId);
    return reply.send(result);
  } catch (error) {
    return handleError(error, reply, request.log);
  }
};

export const respondToFriendRequest = async (
  request: FastifyRequest<FriendRequestActionRequest>,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const { id } = request.params;
    const { action } = request.body;

    const result = await FriendService.respondToFriendRequest(
      id,
      action,
      userId
    );
    return reply.send(result);
  } catch (error) {
    return handleError(error, reply, request.log);
  }
};

export const removeFriend = async (
  request: FastifyRequest<RemoveFriendRequest>,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const { friendId } = request.body;

    const result = await FriendService.removeFriend(userId, friendId);
    return reply.send(result);
  } catch (error) {
    return handleError(error, reply, request.log);
  }
};

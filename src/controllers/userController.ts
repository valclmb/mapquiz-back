import { FastifyReply, FastifyRequest } from "fastify";
import { handleError } from "../lib/errorHandler.js";
import * as UserService from "../services/userService.js";

export const getUserTag = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const result = await UserService.getUserOrCreateTag(userId);
    return reply.send(result);
  } catch (error) {
    return handleError(error, reply, request.log);
  }
};

export const searchUsers = async (
  request: FastifyRequest,
  reply: FastifyReply
) => {
  try {
    const userId = (request as any).user.id;
    const { q } = request.query as { q: string };
    const result = await UserService.searchUsers(q, userId);
    return reply.send(result);
  } catch (error) {
    return handleError(error, reply, request.log);
  }
};

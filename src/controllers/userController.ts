import { FastifyReply, FastifyRequest } from "fastify";
import { asyncHandler } from "../lib/errorHandler.js";
import { UserService } from "../services/userService.js";

export const getUsers = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply) => {
    const result = await UserService.getUsersList();
    return reply.send(result);
  }
);

export const getUserById = asyncHandler(
  async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    const { id } = request.params;
    const user = await UserService.getUserById(id);
    return reply.send({ user });
  }
);

export const getUserByTag = asyncHandler(
  async (
    request: FastifyRequest<{ Params: { tag: string } }>,
    reply: FastifyReply
  ) => {
    const { tag } = request.params;
    const user = await UserService.getUserByTag(tag);
    return reply.send({ user });
  }
);

export const getUserTag = asyncHandler(
  async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).user.id;
    const result = await UserService.getUserOrCreateTag(userId);
    return reply.send(result);
  }
);

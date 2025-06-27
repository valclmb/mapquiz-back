import { FastifyInstance } from "fastify";
import { authRoutes } from "./auth";
import { friendsRoutes } from "./friends";
import { usersRoutes } from "./users";

export async function apiRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(friendsRoutes, { prefix: "/friends" });
}

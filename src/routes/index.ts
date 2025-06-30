import { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { friendsRoutes } from "./friends.js";
import { usersRoutes } from "./users.js";

export async function apiRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes);
  await fastify.register(usersRoutes);
  await fastify.register(friendsRoutes, { prefix: "/friends" });
}

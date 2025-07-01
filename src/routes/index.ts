import { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { friendsRoutes } from "./friends.js";
import { scoresRoutes } from "./scores.js";
import { usersRoutes } from "./users.js";

export async function apiRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes);
  await fastify.register(usersRoutes, { prefix: "/users" });
  await fastify.register(friendsRoutes, { prefix: "/friends" });
  await fastify.register(scoresRoutes, { prefix: "/scores" });
}

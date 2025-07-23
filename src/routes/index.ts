import { FastifyInstance } from "fastify";
import { authRoutes } from "./auth.js";
import { friendsRoutes } from "./friends.js";
import { lobbiesRoutes } from "./lobbies.js";
import { scoresRoutes } from "./scores.js";
import { usersRoutes } from "./users.js";
import { playerManagementRoutes } from "./lobby/playerManagement.js";

export async function apiRoutes(fastify: FastifyInstance) {
  await fastify.register(authRoutes);
  await fastify.register(usersRoutes, { prefix: "/users" });
  await fastify.register(friendsRoutes, { prefix: "/friends" });
  await fastify.register(scoresRoutes, { prefix: "/scores" });
  await fastify.register(lobbiesRoutes, { prefix: "/lobbies" });
  await fastify.register(playerManagementRoutes, { prefix: "/api" });
}

import { FastifyInstance } from "fastify";
import { addFriendRoute } from "./add.js";
import { listFriendsRoute } from "./list.js";
import { removeFriendRoute } from "./remove.js";
import { friendRequestsRoutes } from "./requests.js";

export async function friendsRoutes(fastify: FastifyInstance) {
  // Enregistrer toutes les sous-routes
  await fastify.register(addFriendRoute);
  await fastify.register(listFriendsRoute);
  await fastify.register(removeFriendRoute);
  await fastify.register(friendRequestsRoutes);
}

import { FastifyInstance } from "fastify";
import * as FriendController from "../controllers/friendController.js";
import { requireAuth } from "../middleware/auth.js";

// Types pour les routes
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

export async function friendsRoutes(fastify: FastifyInstance) {
  fastify.post<AddFriendRequest>(
    "/add",
    {
      preHandler: requireAuth,
    },
    FriendController.addFriend
  );

  fastify.get(
    "/list",
    {
      preHandler: requireAuth,
    },
    FriendController.listFriends
  );

  fastify.get(
    "/requests",
    {
      preHandler: requireAuth,
    },
    FriendController.getFriendRequests
  );

  fastify.post<FriendRequestActionRequest>(
    "/requests/:id",
    {
      preHandler: requireAuth,
    },
    FriendController.respondToFriendRequest
  );

  fastify.delete<RemoveFriendRequest>(
    "/remove",
    {
      preHandler: requireAuth,
    },
    FriendController.removeFriend
  );
}

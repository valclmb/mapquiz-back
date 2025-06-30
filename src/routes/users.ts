import { FastifyInstance } from "fastify";
import * as UserController from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/user/tag",
    {
      preHandler: requireAuth,
    },
    UserController.getUserTag
  );

  fastify.get(
    "/users/search",
    {
      preHandler: requireAuth,
    },
    UserController.searchUsers
  );
}

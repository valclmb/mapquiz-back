import { FastifyInstance } from "fastify";
import * as UserController from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/tag",
    {
      preHandler: requireAuth,
    },
    UserController.getUserTag
  );

  fastify.get(
    "/search",
    {
      preHandler: requireAuth,
    },
    UserController.searchUsers
  );
}

import { FastifyInstance } from "fastify";
import * as UserController from "../controllers/userController.js";
import { requireAuth } from "../middleware/auth.js";

export async function usersRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      preHandler: requireAuth,
    },
    UserController.getUsers
  );

  fastify.get(
    "/:id",
    {
      preHandler: requireAuth,
    },
    UserController.getUserById
  );

  fastify.get(
    "/tag/:tag",
    {
      preHandler: requireAuth,
    },
    UserController.getUserByTag
  );
}

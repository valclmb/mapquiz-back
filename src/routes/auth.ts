import { FastifyInstance } from "fastify";
import * as AuthController from "../controllers/authController.js";

export async function authRoutes(fastify: FastifyInstance) {
  fastify.route({
    method: ["GET", "POST"],
    url: "/auth/*",
    handler: AuthController.handleAuth,
  });
}

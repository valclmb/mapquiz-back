import { FastifyInstance } from "fastify";
import { BugReportController } from "../controllers/bugReportController.js";
import { optionalAuth } from "../middleware/auth.js";

export async function bugReportRoutes(fastify: FastifyInstance) {
  // Route pour créer un rapport de bug (avec authentification optionnelle)
  fastify.post("/", {
    preHandler: optionalAuth,
    handler: BugReportController.createBugReport,
  });
}

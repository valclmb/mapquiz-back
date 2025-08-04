import { FastifyInstance } from "fastify";
import { BugReportController } from "../controllers/bugReportController.js";

export async function bugReportRoutes(fastify: FastifyInstance) {
  // Route publique pour créer un rapport de bug
  fastify.post("/", {
    handler: BugReportController.createBugReport,
  });
}

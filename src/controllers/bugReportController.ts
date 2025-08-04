import { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { GitHubService } from "../services/githubService.js";

// Schéma de validation pour la création d'un rapport de bug
const createBugReportSchema = z.object({
  title: z
    .string()
    .min(1, "Le titre est requis")
    .max(200, "Le titre est trop long"),
  description: z
    .string()
    .min(10, "La description doit contenir au moins 10 caractères"),
  stepsToReproduce: z.string().optional(),
  location: z.string().optional(),
  environment: z.object({
    browser: z.string().optional(),
    browserVersion: z.string().optional(),
    operatingSystem: z.string().optional(),
    deviceType: z.string().optional(),
    screenResolution: z.string().optional(),
  }),
  userAgent: z.string().optional(),
  url: z.string().optional(),
});

export class BugReportController {
  /**
   * Créer un nouveau rapport de bug
   */
  static async createBugReport(request: FastifyRequest, reply: FastifyReply) {
    try {
      const validatedData = createBugReportSchema.parse(request.body);

      // Ajouter automatiquement les informations de l'utilisateur si connecté
      const user = (request as any).user;
      if (user) {
        (validatedData as any).reporterId = user.id;
      }

      // Ajouter automatiquement l'URL actuelle si non fournie
      if (!validatedData.url) {
        validatedData.url = request.headers.referer || request.url;
      }

      // Ajouter automatiquement le User-Agent si non fourni
      if (!validatedData.userAgent) {
        validatedData.userAgent = request.headers["user-agent"];
      }

      // Créer l'issue GitHub au lieu de sauvegarder en base de données
      const githubIssue = await GitHubService.createIssueFromBugReport(
        validatedData
      );

      return reply.status(201).send({
        success: true,
        message: githubIssue.message,
        data: {
          issueNumber: githubIssue.issueNumber,
          issueUrl: githubIssue.issueUrl,
          title: validatedData.title,
        },
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return reply.status(400).send({
          success: false,
          message: "Données invalides",
          errors: (error as any).errors,
        });
      }
      throw error;
    }
  }
}

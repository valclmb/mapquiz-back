import { FastifyReply, FastifyRequest } from "fastify";
import { BugReportController } from "../../../src/controllers/bugReportController.js";
import { GitHubService } from "../../../src/services/githubService.js";

// Mock minimal du GitHubService pour isoler la logique métier du contrôleur
jest.mock("../../../src/services/githubService.js", () => ({
  GitHubService: {
    createIssueFromBugReport: jest.fn(),
  },
}));

const mockGitHubService = GitHubService as jest.Mocked<typeof GitHubService>;

describe("BugReportController - Tests de Logique Métier Réelle", () => {
  let mockRequest: FastifyRequest;
  let mockReply: FastifyReply;
  let mockSend: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup des mocks avec retour chainable
    mockSend = jest.fn();
    mockStatus = jest.fn().mockReturnThis();

    mockReply = {
      status: mockStatus,
      send: mockSend,
    } as unknown as FastifyReply;

    // Mock du GitHubService avec réponse réaliste
    mockGitHubService.createIssueFromBugReport.mockResolvedValue({
      success: true,
      issueNumber: 123,
      issueUrl: "https://github.com/owner/repo/issues/123",
      message: "Bug report créé: Issue #123",
    });
  });

  describe("Validation Zod et Logique Métier", () => {
    it("devrait valider et enrichir automatiquement les données du bug report", async () => {
      const inputData = {
        title: "Bug critique dans la validation",
        description:
          "La validation des pays ne fonctionne pas correctement avec plus de 10 caractères",
        environment: {
          browser: "Chrome",
          browserVersion: "120.0",
          operatingSystem: "macOS 14.0",
        },
      };

      mockRequest = {
        body: inputData,
        headers: {
          "user-agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
          referer: "https://mapquiz.app/quiz",
        },
        url: "/bug-report",
        user: { id: "user-123" }, // Utilisateur connecté
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      // VALIDATION DE LA LOGIQUE MÉTIER RÉELLE
      const gitHubCallArgs =
        mockGitHubService.createIssueFromBugReport.mock.calls[0][0];

      // 1. Validation Zod correcte
      expect(gitHubCallArgs.title).toBe(inputData.title);
      expect(gitHubCallArgs.description).toBe(inputData.description);

      // 2. Enrichissement automatique des données (LOGIQUE MÉTIER)
      expect(gitHubCallArgs.userAgent).toBe(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36"
      );
      expect(gitHubCallArgs.url).toBe("https://mapquiz.app/quiz");
      expect(gitHubCallArgs.reporterId).toBe("user-123");

      // 3. Structure de l'environnement préservée
      expect(gitHubCallArgs.environment).toEqual(inputData.environment);

      // 4. Réponse correcte
      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockSend).toHaveBeenCalledWith({
        success: true,
        message: "Bug report créé: Issue #123",
        data: {
          issueNumber: 123,
          issueUrl: "https://github.com/owner/repo/issues/123",
          title: inputData.title,
        },
      });
    });

    it("devrait gérer les utilisateurs anonymes sans reporterId", async () => {
      const inputData = {
        title: "Bug anonyme",
        description:
          "Description avec plus de 10 caractères pour la validation",
        environment: { browser: "Firefox" },
      };

      mockRequest = {
        body: inputData,
        headers: {},
        url: "/bug-report",
        // Pas d'utilisateur connecté
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      const gitHubCallArgs =
        mockGitHubService.createIssueFromBugReport.mock.calls[0][0];

      // VALIDATION : pas de reporterId pour utilisateur anonyme
      expect(gitHubCallArgs.reporterId).toBeUndefined();
      expect(gitHubCallArgs.url).toBe("/bug-report"); // URL fallback
      expect(gitHubCallArgs.userAgent).toBeUndefined();
    });

    it("devrait rejeter les données invalides avec erreurs Zod détaillées", async () => {
      const invalidData = {
        title: "", // Titre vide (invalide)
        description: "Court", // Moins de 10 caractères (invalide)
        environment: { browser: "Chrome" },
      };

      mockRequest = {
        body: invalidData,
        headers: {},
        url: "/bug-report",
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      // VALIDATION DE LA GESTION D'ERREUR ZOD RÉELLE
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockSend).toHaveBeenCalledWith({
        success: false,
        message: "Données invalides",
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["title"],
            message: "Le titre est requis",
          }),
          expect.objectContaining({
            path: ["description"],
            message: "La description doit contenir au moins 10 caractères",
          }),
        ]),
      });

      // GitHubService ne doit PAS être appelé en cas d'erreur de validation
      expect(mockGitHubService.createIssueFromBugReport).not.toHaveBeenCalled();
    });

    it("devrait valider la longueur maximale du titre (200 caractères)", async () => {
      const longTitle = "A".repeat(201); // 201 caractères
      const invalidData = {
        title: longTitle,
        description: "Description valide avec plus de 10 caractères",
        environment: { browser: "Chrome" },
      };

      mockRequest = {
        body: invalidData,
        headers: {},
        url: "/bug-report",
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      // VALIDATION DE LA LIMITE ZOD RÉELLE
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockSend).toHaveBeenCalledWith({
        success: false,
        message: "Données invalides",
        errors: expect.arrayContaining([
          expect.objectContaining({
            path: ["title"],
            message: "Le titre est trop long",
          }),
        ]),
      });
    });

    it("devrait prioriser referer sur request.url pour l'URL automatique", async () => {
      const validData = {
        title: "Bug avec logique URL",
        description: "Test de la logique de fallback d'URL automatique",
        environment: { browser: "Chrome" },
      };

      mockRequest = {
        body: validData,
        headers: {
          referer: "https://mapquiz.app/game?level=hard",
        },
        url: "/bug-report", // Moins prioritaire que referer
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      const gitHubCallArgs =
        mockGitHubService.createIssueFromBugReport.mock.calls[0][0];

      // LOGIQUE MÉTIER : referer prioritaire sur request.url
      expect(gitHubCallArgs.url).toBe("https://mapquiz.app/game?level=hard");
    });

    it("devrait utiliser request.url si referer absent", async () => {
      const validData = {
        title: "Bug sans referer",
        description: "Test du fallback sur request.url quand referer absent",
        environment: { browser: "Chrome" },
      };

      mockRequest = {
        body: validData,
        headers: {}, // Pas de referer
        url: "/game/quiz",
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      const gitHubCallArgs =
        mockGitHubService.createIssueFromBugReport.mock.calls[0][0];

      // LOGIQUE MÉTIER : fallback sur request.url
      expect(gitHubCallArgs.url).toBe("/game/quiz");
    });

    it("devrait valider les champs optionnels et leur traitement", async () => {
      const completeData = {
        title: "Bug complet avec tous les champs",
        description: "Description détaillée avec plus de 10 caractères",
        stepsToReproduce: "1. Faire ceci\n2. Faire cela\n3. Observer le bug",
        location: "/game/multiplayer/lobby/123",
        environment: {
          browser: "Safari",
          browserVersion: "16.5",
          operatingSystem: "iOS 16.5",
          deviceType: "mobile",
          screenResolution: "390x844",
        },
        userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5)",
        url: "https://mapquiz.app/game/lobby/123",
      };

      mockRequest = {
        body: completeData,
        headers: {
          "user-agent": "Ceci ne devrait pas remplacer le userAgent fourni",
          referer: "Ceci ne devrait pas remplacer l'URL fournie",
        },
        url: "/bug-report",
        user: { id: "user-456" },
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      const gitHubCallArgs =
        mockGitHubService.createIssueFromBugReport.mock.calls[0][0];

      // VALIDATION : les valeurs fournies ne sont PAS remplacées
      expect(gitHubCallArgs.userAgent).toBe(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5)"
      );
      expect(gitHubCallArgs.url).toBe("https://mapquiz.app/game/lobby/123");
      expect(gitHubCallArgs.stepsToReproduce).toBe(
        "1. Faire ceci\n2. Faire cela\n3. Observer le bug"
      );
      expect(gitHubCallArgs.location).toBe("/game/multiplayer/lobby/123");
      expect(gitHubCallArgs.reporterId).toBe("user-456");

      // Validation complète de l'objet environment
      expect(gitHubCallArgs.environment).toEqual({
        browser: "Safari",
        browserVersion: "16.5",
        operatingSystem: "iOS 16.5",
        deviceType: "mobile",
        screenResolution: "390x844",
      });
    });
  });

  describe("Gestion d'Erreurs et Robustesse", () => {
    it("devrait propager les erreurs GitHub sans les masquer", async () => {
      const validData = {
        title: "Bug valide",
        description:
          "Description valide pour tester la gestion d'erreur GitHub",
        environment: { browser: "Chrome" },
      };

      mockRequest = {
        body: validData,
        headers: {},
        url: "/bug-report",
      } as any;

      // Simuler une erreur GitHub (token invalide, quota dépassé, etc.)
      mockGitHubService.createIssueFromBugReport.mockRejectedValue(
        new Error("GitHub API Error: 401 Unauthorized")
      );

      // VALIDATION : l'erreur doit être propagée, pas masquée
      await expect(
        BugReportController.createBugReport(mockRequest, mockReply)
      ).rejects.toThrow("GitHub API Error: 401 Unauthorized");

      // Pas de réponse HTTP envoyée en cas d'erreur GitHub
      expect(mockStatus).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });

    it("devrait différencier les erreurs Zod des autres erreurs", async () => {
      // Test avec une erreur Zod
      const zodErrorData = {
        title: "Titre valide",
        description: "Desc", // Trop courte
        environment: { browser: "Chrome" },
      };

      mockRequest = {
        body: zodErrorData,
        headers: {},
        url: "/bug-report",
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      // VALIDATION : erreur Zod gérée avec status 400
      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockSend).toHaveBeenCalledWith({
        success: false,
        message: "Données invalides",
        errors: expect.any(Array),
      });

      jest.clearAllMocks();

      // Test avec une erreur non-Zod (doit être propagée)
      mockGitHubService.createIssueFromBugReport.mockRejectedValue(
        new Error("Network timeout")
      );

      const validData = {
        title: "Titre valide",
        description: "Description valide avec plus de 10 caractères",
        environment: { browser: "Chrome" },
      };

      mockRequest = { body: validData, headers: {}, url: "/bug-report" } as any;

      await expect(
        BugReportController.createBugReport(mockRequest, mockReply)
      ).rejects.toThrow("Network timeout");
    });

    it("devrait valider la structure complète de l'objet environment", async () => {
      const dataWithPartialEnv = {
        title: "Test environnement partiel",
        description: "Test avec environnement ayant seulement certains champs",
        environment: {
          browser: "Firefox",
          // Autres champs manquants mais optionnels
        },
      };

      mockRequest = {
        body: dataWithPartialEnv,
        headers: {},
        url: "/bug-report",
      } as any;

      await BugReportController.createBugReport(mockRequest, mockReply);

      const gitHubCallArgs =
        mockGitHubService.createIssueFromBugReport.mock.calls[0][0];

      // VALIDATION : structure environment préservée même partielle
      expect(gitHubCallArgs.environment).toEqual({ browser: "Firefox" });
      expect(mockStatus).toHaveBeenCalledWith(201);
    });
  });
});

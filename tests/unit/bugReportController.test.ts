import { BugReportController } from "../../src/controllers/bugReportController.js";
import { GitHubService } from "../../src/services/githubService.js";

// Mock GitHubService
jest.mock("../../src/services/githubService.js");

describe("BugReportController", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createBugReport", () => {
    it("devrait créer un bug report avec succès", async () => {
      const mockRequest = {
        body: {
          title: "Test Bug",
          description: "Description du bug",
          environment: {},
        },
        headers: {
          referer: "http://localhost:3000/test",
          "user-agent": "Mozilla/5.0...",
        },
        url: "/api/bug-reports",
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      const mockGitHubResponse = {
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/test/issues/123",
        message: "Bug report créé: Issue #123",
      };

      (GitHubService.createIssueFromBugReport as jest.Mock).mockResolvedValue(
        mockGitHubResponse
      );

      await BugReportController.createBugReport(
        mockRequest as any,
        mockReply as any
      );

      expect(GitHubService.createIssueFromBugReport).toHaveBeenCalledWith({
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
        url: "http://localhost:3000/test",
        userAgent: "Mozilla/5.0...",
      });

      expect(mockReply.status).toHaveBeenCalledWith(201);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: true,
        message: "Bug report créé: Issue #123",
        data: {
          issueNumber: 123,
          issueUrl: "https://github.com/test/issues/123",
          title: "Test Bug",
        },
      });
    });

    it("devrait créer un bug report avec un utilisateur connecté", async () => {
      const mockRequest = {
        body: {
          title: "Test Bug",
          description: "Description du bug",
          environment: {},
        },
        headers: {
          referer: "http://localhost:3000/test",
          "user-agent": "Mozilla/5.0...",
        },
        url: "/api/bug-reports",
        user: { id: "user-123" },
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      const mockGitHubResponse = {
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/test/issues/123",
        message: "Bug report créé: Issue #123",
      };

      (GitHubService.createIssueFromBugReport as jest.Mock).mockResolvedValue(
        mockGitHubResponse
      );

      await BugReportController.createBugReport(
        mockRequest as any,
        mockReply as any
      );

      expect(GitHubService.createIssueFromBugReport).toHaveBeenCalledWith({
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
        url: "http://localhost:3000/test",
        userAgent: "Mozilla/5.0...",
        reporterId: "user-123",
      });
    });

    it("devrait créer un bug report sans utilisateur connecté", async () => {
      const mockRequest = {
        body: {
          title: "Test Bug",
          description: "Description du bug",
          environment: {},
        },
        headers: {
          referer: "http://localhost:3000/test",
          "user-agent": "Mozilla/5.0...",
        },
        url: "/api/bug-reports",
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      const mockGitHubResponse = {
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/test/issues/123",
        message: "Bug report créé: Issue #123",
      };

      (GitHubService.createIssueFromBugReport as jest.Mock).mockResolvedValue(
        mockGitHubResponse
      );

      await BugReportController.createBugReport(
        mockRequest as any,
        mockReply as any
      );

      expect(GitHubService.createIssueFromBugReport).toHaveBeenCalledWith({
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
        url: "http://localhost:3000/test",
        userAgent: "Mozilla/5.0...",
      });
    });

    it("devrait utiliser l'URL de la requête si pas de referer", async () => {
      const mockRequest = {
        body: {
          title: "Test Bug",
          description: "Description du bug",
          environment: {},
        },
        headers: {
          "user-agent": "Mozilla/5.0...",
        },
        url: "/api/bug-reports",
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      const mockGitHubResponse = {
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/test/issues/123",
        message: "Bug report créé: Issue #123",
      };

      (GitHubService.createIssueFromBugReport as jest.Mock).mockResolvedValue(
        mockGitHubResponse
      );

      await BugReportController.createBugReport(
        mockRequest as any,
        mockReply as any
      );

      expect(GitHubService.createIssueFromBugReport).toHaveBeenCalledWith({
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
        url: "/api/bug-reports",
        userAgent: "Mozilla/5.0...",
      });
    });

    it("devrait gérer les données sans URL fournie", async () => {
      const mockRequest = {
        body: {
          title: "Test Bug",
          description: "Description du bug",
          environment: {},
          url: "http://example.com/bug",
        },
        headers: {
          "user-agent": "Mozilla/5.0...",
        },
        url: "/api/bug-reports",
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      const mockGitHubResponse = {
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/test/issues/123",
        message: "Bug report créé: Issue #123",
      };

      (GitHubService.createIssueFromBugReport as jest.Mock).mockResolvedValue(
        mockGitHubResponse
      );

      await BugReportController.createBugReport(
        mockRequest as any,
        mockReply as any
      );

      expect(GitHubService.createIssueFromBugReport).toHaveBeenCalledWith({
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
        url: "http://example.com/bug",
        userAgent: "Mozilla/5.0...",
      });
    });

    it("devrait gérer les données sans User-Agent fourni", async () => {
      const mockRequest = {
        body: {
          title: "Test Bug",
          description: "Description du bug",
          environment: {},
        },
        headers: {
          referer: "http://localhost:3000/test",
        },
        url: "/api/bug-reports",
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      const mockGitHubResponse = {
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/test/issues/123",
        message: "Bug report créé: Issue #123",
      };

      (GitHubService.createIssueFromBugReport as jest.Mock).mockResolvedValue(
        mockGitHubResponse
      );

      await BugReportController.createBugReport(
        mockRequest as any,
        mockReply as any
      );

      expect(GitHubService.createIssueFromBugReport).toHaveBeenCalledWith({
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
        url: "http://localhost:3000/test",
        userAgent: undefined,
      });
    });

    it("devrait gérer les erreurs de validation Zod", async () => {
      const mockRequest = {
        body: {
          title: "", // Titre vide - invalide
          description: "Description du bug",
          environment: {},
        },
        headers: {
          referer: "http://localhost:3000/test",
          "user-agent": "Mozilla/5.0...",
        },
        url: "/api/bug-reports",
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await BugReportController.createBugReport(
        mockRequest as any,
        mockReply as any
      );

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        message: "Données invalides",
        errors: expect.anything(),
      });
    });

    it("devrait gérer les erreurs de validation avec description trop courte", async () => {
      const mockRequest = {
        body: {
          title: "Test Bug",
          description: "Court", // Trop court
          environment: {},
        },
        headers: {
          referer: "http://localhost:3000/test",
          "user-agent": "Mozilla/5.0...",
        },
        url: "/api/bug-reports",
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await BugReportController.createBugReport(
        mockRequest as any,
        mockReply as any
      );

      expect(mockReply.status).toHaveBeenCalledWith(400);
      expect(mockReply.send).toHaveBeenCalledWith({
        success: false,
        message: "Données invalides",
        errors: expect.anything(),
      });
    });

    it("devrait gérer les erreurs de GitHubService", async () => {
      const mockRequest = {
        body: {
          title: "Test Bug",
          description: "Description du bug",
          environment: {},
        },
        headers: {
          referer: "http://localhost:3000/test",
          "user-agent": "Mozilla/5.0...",
        },
        url: "/api/bug-reports",
      };

      const mockReply = {
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      const error = new Error("GitHub API error");
      (GitHubService.createIssueFromBugReport as jest.Mock).mockRejectedValue(
        error
      );

      await expect(
        BugReportController.createBugReport(
          mockRequest as any,
          mockReply as any
        )
      ).rejects.toThrow("GitHub API error");
    });
  });
});

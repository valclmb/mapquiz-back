import { GitHubService } from "../../src/services/githubService.js";

// Mock fetch
global.fetch = jest.fn();

describe("GitHubService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock des variables d'environnement
    process.env.GITHUB_TOKEN = "test-token";
    process.env.GITHUB_REPO_OWNER = "test-owner";
    process.env.GITHUB_REPO_NAME = "test-repo";
  });

  afterEach(() => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GITHUB_REPO_OWNER;
    delete process.env.GITHUB_REPO_NAME;
  });

  describe("createIssueFromBugReport", () => {
    it("devrait créer une issue GitHub avec succès", async () => {
      const mockBugReport = {
        title: "Test Bug",
        description: "Description du bug",
        stepsToReproduce: "1. Aller sur la page\n2. Cliquer sur le bouton",
        location: "Page d'accueil",
        environment: {
          browser: "Chrome",
          browserVersion: "138",
          operatingSystem: "macOS",
          deviceType: "Desktop",
          screenResolution: "1680x1050",
        },
        userAgent: "Mozilla/5.0...",
        url: "/test",
        reporterId: "user123",
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          number: 123,
          html_url: "https://github.com/test-owner/test-repo/issues/123",
          title: "[Bug Report] Test Bug",
        }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await GitHubService.createIssueFromBugReport(
        mockBugReport
      );

      expect(fetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/test-owner/test-repo/issues",
        {
          method: "POST",
          headers: {
            Authorization: "token test-token",
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: expect.stringContaining('"title":"[Bug Report] Test Bug"'),
        }
      );

      expect(result).toEqual({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/test-owner/test-repo/issues/123",
        message: "Bug report créé: Issue #123",
      });
    });

    it("devrait gérer les erreurs de l'API GitHub", async () => {
      const mockBugReport = {
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
      };

      const mockResponse = {
        ok: false,
        status: 401,
        text: jest.fn().mockResolvedValue("Unauthorized"),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await expect(
        GitHubService.createIssueFromBugReport(mockBugReport)
      ).rejects.toThrow("Erreur GitHub API: 401 - Unauthorized");
    });

    it("devrait échouer si le token GitHub n'est pas configuré", async () => {
      delete process.env.GITHUB_TOKEN;

      const mockBugReport = {
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
      };

      await expect(
        GitHubService.createIssueFromBugReport(mockBugReport)
      ).rejects.toThrow("GitHub token non configuré");
    });
  });

  describe("updateIssueStatus", () => {
    it("devrait mettre à jour le statut d'une issue", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({}),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      await GitHubService.updateIssueStatus(123, "in-progress");

      expect(fetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/test-owner/test-repo/issues/123",
        {
          method: "PATCH",
          headers: {
            Authorization: "token test-token",
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            labels: ["bug", "user-reported", "in-progress"],
          }),
        }
      );
    });
  });
});

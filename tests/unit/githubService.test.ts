import { GitHubService } from "../../src/services/githubService.js";

// Mock fetch
global.fetch = jest.fn();

describe("GitHubService", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("createIssueFromBugReport", () => {
    it("devrait gérer l'absence de token GitHub", async () => {
      // Ensure no GitHub token is set
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

    it("devrait gérer les erreurs de l'API GitHub", async () => {
      // Set a mock token
      process.env.GITHUB_TOKEN = "mock-token";

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

    it("devrait créer une issue avec succès", async () => {
      // Set a mock token
      process.env.GITHUB_TOKEN = "mock-token";

      const mockBugReport = {
        title: "Test Bug",
        description: "Description du bug",
        environment: {},
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          number: 123,
          html_url: "https://github.com/test/issues/123",
          title: "[Bug Report] Test Bug",
        }),
      };

      (fetch as jest.Mock).mockResolvedValue(mockResponse);

      const result = await GitHubService.createIssueFromBugReport(
        mockBugReport
      );

      expect(result).toEqual({
        success: true,
        issueNumber: 123,
        issueUrl: "https://github.com/test/issues/123",
        message: "Bug report créé: Issue #123",
      });
    });
  });
});

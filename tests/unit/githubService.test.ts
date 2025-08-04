import { GitHubService } from "../../src/services/githubService.js";

// Mock fetch
global.fetch = jest.fn();

describe("GitHubService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createIssueFromBugReport", () => {
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
  });
});

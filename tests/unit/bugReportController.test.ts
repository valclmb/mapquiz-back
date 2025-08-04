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
  });
});

import { GitHubService } from "../../../src/services/githubService.js";

// Mock de fetch
global.fetch = jest.fn();

const mockFetch = fetch as jest.MockedFunction<typeof fetch>;

describe("GitHubService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
      const bugReport = {
        title: "Test Bug",
        description: "This is a test bug",
        environment: { browser: "Chrome" },
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          number: 123,
          html_url:
            "https://github.com/your-github-username/your-repo-name/issues/123",
          title: "[Bug Report] Test Bug",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      const result = await GitHubService.createIssueFromBugReport(bugReport);

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/your-github-username/your-repo-name/issues",
        expect.objectContaining({
          method: "POST",
          headers: {
            Authorization: "token test-token",
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: expect.stringContaining("[Bug Report] Test Bug"),
        })
      );

      expect(result).toEqual({
        success: true,
        issueNumber: 123,
        issueUrl:
          "https://github.com/your-github-username/your-repo-name/issues/123",
        message: "Bug report créé: Issue #123",
      });
    });

    it("devrait échouer si le token GitHub n'est pas configuré", async () => {
      delete process.env.GITHUB_TOKEN;

      const bugReport = {
        title: "Test Bug",
        description: "This is a test bug",
        environment: { browser: "Chrome" },
      };

      await expect(
        GitHubService.createIssueFromBugReport(bugReport)
      ).rejects.toThrow("GitHub token non configuré");
    });

    it("devrait gérer les erreurs de l'API GitHub", async () => {
      const bugReport = {
        title: "Test Bug",
        description: "This is a test bug",
        environment: { browser: "Chrome" },
      };

      const mockResponse = {
        ok: false,
        status: 400,
        text: jest.fn().mockResolvedValue("Bad Request"),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        GitHubService.createIssueFromBugReport(bugReport)
      ).rejects.toThrow("Erreur GitHub API: 400 - Bad Request");
    });

    it("devrait formater correctement le body de l'issue", async () => {
      const bugReport = {
        title: "Test Bug",
        description: "This is a test bug",
        stepsToReproduce: "1. Do this\n2. Do that",
        location: "test-page",
        environment: { browser: "Chrome", browserVersion: "100.0" },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        url: "https://example.com/test?param=value",
        reporterId: "user123",
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          number: 123,
          html_url:
            "https://github.com/your-github-username/your-repo-name/issues/123",
          title: "[Bug Report] Test Bug",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await GitHubService.createIssueFromBugReport(bugReport);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(callBody.title).toBe("[Bug Report] Test Bug");
      expect(callBody.body).toContain("## 🐛 Rapport de Bug Utilisateur");
      expect(callBody.body).toContain("This is a test bug");
      expect(callBody.body).toContain("### Étapes de reproduction");
      expect(callBody.body).toContain("1. Do this");
      expect(callBody.body).toContain("### Localisation");
      expect(callBody.body).toContain("test-page");
      expect(callBody.body).toContain("**URL** : /test?param=value");
      expect(callBody.body).toContain("**Navigateur** : Chrome 100.0");
    });

    it("devrait anonymiser les données sensibles", async () => {
      const bugReport = {
        title: "Test Bug",
        description: "This is a test bug",
        environment: { browser: "Chrome" },
        userAgent:
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        url: "https://example.com/test?token=secret&user=123",
      };

      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          number: 123,
          html_url:
            "https://github.com/your-github-username/your-repo-name/issues/123",
          title: "[Bug Report] Test Bug",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await GitHubService.createIssueFromBugReport(bugReport);

      const callBody = JSON.parse(mockFetch.mock.calls[0][1]?.body as string);

      expect(callBody.body).toContain("**URL** : /test?user=123");
      expect(callBody.body).not.toContain("token=secret");
      expect(callBody.body).toContain(
        "**User-Agent** : Unknown Browser on Windows"
      );
    });
  });

  describe("updateIssueStatus", () => {
    it("devrait mettre à jour le statut d'une issue", async () => {
      const mockResponse = {
        ok: true,
        json: jest.fn().mockResolvedValue({
          number: 123,
          state: "closed",
        }),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await GitHubService.updateIssueStatus(123, "closed");

      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.github.com/repos/your-github-username/your-repo-name/issues/123",
        expect.objectContaining({
          method: "PATCH",
          headers: {
            Authorization: "token test-token",
            Accept: "application/vnd.github.v3+json",
            "Content-Type": "application/json",
          },
          body: expect.stringContaining(
            '"labels":["bug","user-reported","closed"]'
          ),
        })
      );
    });

    it("devrait gérer les erreurs lors de la mise à jour", async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        text: jest.fn().mockResolvedValue("Issue not found"),
      };

      mockFetch.mockResolvedValue(mockResponse as any);

      await expect(
        GitHubService.updateIssueStatus(123, "closed")
      ).rejects.toThrow("Erreur mise à jour issue: 404 - Issue not found");
    });
  });

  describe("anonymizeUrl", () => {
    it("devrait anonymiser les paramètres sensibles dans l'URL", () => {
      const url = "https://example.com/test?user=123&token=secret&param=value";
      const anonymized = (GitHubService as any).anonymizeUrl(url);

      expect(anonymized).toBe("/test?user=123&param=value");
    });

    it("devrait retourner l'URL inchangée si pas de paramètres sensibles", () => {
      const url = "https://example.com/test?param=value";
      const anonymized = (GitHubService as any).anonymizeUrl(url);

      expect(anonymized).toBe("/test?param=value");
    });

    it("devrait retourner undefined si pas d'URL", () => {
      const anonymized = (GitHubService as any).anonymizeUrl(undefined);

      expect(anonymized).toBeUndefined();
    });
  });

  describe("anonymizeUserAgent", () => {
    it("devrait anonymiser les informations sensibles dans le user agent", () => {
      const userAgent =
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.75 Safari/537.36";
      const anonymized = (GitHubService as any).anonymizeUserAgent(userAgent);

      expect(anonymized).toBe("Chrome/100 on Windows");
    });

    it("devrait retourner undefined si pas de user agent", () => {
      const anonymized = (GitHubService as any).anonymizeUserAgent(undefined);

      expect(anonymized).toBeUndefined();
    });
  });
});

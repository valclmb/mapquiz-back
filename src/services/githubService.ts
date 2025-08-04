interface BugReportData {
  title: string;
  description: string;
  stepsToReproduce?: string;
  location?: string;
  environment: any;
  userAgent?: string;
  url?: string;
  reporterId?: string;
}

interface GitHubIssueBody {
  title: string;
  body: string;
  labels: string[];
  assignees?: string[];
}

export class GitHubService {
  private static readonly GITHUB_API_URL = "https://api.github.com";
  private static readonly REPO_OWNER =
    process.env.GITHUB_REPO_OWNER || "valclmb";
  private static readonly REPO_NAME =
    process.env.GITHUB_REPO_NAME || "mapquiz-back";

  /**
   * Crée une issue GitHub à partir d'un bug report
   */
  static async createIssueFromBugReport(
    bugReport: BugReportData
  ): Promise<any> {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error("GitHub token non configuré");
    }

    const issueBody = this.formatBugReportAsIssue(bugReport);

    const response = await fetch(
      `${this.GITHUB_API_URL}/repos/${this.REPO_OWNER}/${this.REPO_NAME}/issues`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(issueBody),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Erreur GitHub API: ${response.status} - ${error}`);
    }

    const issue = await response.json();
    console.log(`Issue GitHub créée: #${issue.number} - ${issue.title}`);

    return {
      success: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      message: `Bug report créé: Issue #${issue.number}`,
    };
  }

  /**
   * Formate un bug report en body d'issue GitHub
   */
  private static formatBugReportAsIssue(
    bugReport: BugReportData
  ): GitHubIssueBody {
    // Anonymiser les données sensibles
    const anonymizedUrl = this.anonymizeUrl(bugReport.url);
    const anonymizedUserAgent = this.anonymizeUserAgent(bugReport.userAgent);

    const body = `## 🐛 Rapport de Bug Utilisateur

### Description
${bugReport.description}

${
  bugReport.stepsToReproduce
    ? `### Étapes de reproduction
${bugReport.stepsToReproduce}

`
    : ""
}${
      bugReport.location
        ? `### Localisation
${bugReport.location}

`
        : ""
    }### Informations techniques
- **URL** : ${anonymizedUrl || "Non spécifiée"}
- **Navigateur** : ${bugReport.environment?.browser || "Inconnu"} ${
      bugReport.environment?.browserVersion || ""
    }
- **OS** : ${bugReport.environment?.operatingSystem || "Inconnu"}
- **Appareil** : ${bugReport.environment?.deviceType || "Inconnu"}
- **Résolution** : ${bugReport.environment?.screenResolution || "Inconnue"}
- **User-Agent** : ${anonymizedUserAgent || "Non spécifié"}

### Utilisateur
- **Type** : ${
      bugReport.reporterId ? "Utilisateur connecté" : "Utilisateur anonyme"
    }

---

*Issue créée automatiquement via le système de bug report de MAP2*`;

    return {
      title: `[Bug Report] ${bugReport.title}`,
      body,
      labels: ["bug", "user-reported", "needs-triage"],
      assignees: [], // Peut être assigné manuellement
    };
  }

  /**
   * Met à jour le statut d'une issue (optionnel)
   */
  static async updateIssueStatus(
    issueNumber: number,
    status: "in-progress" | "resolved" | "closed"
  ): Promise<void> {
    const githubToken = process.env.GITHUB_TOKEN;
    if (!githubToken) {
      throw new Error("GitHub token non configuré");
    }

    const labels = {
      "in-progress": ["bug", "user-reported", "in-progress"],
      resolved: ["bug", "user-reported", "resolved"],
      closed: ["bug", "user-reported", "closed"],
    };

    const response = await fetch(
      `${this.GITHUB_API_URL}/repos/${this.REPO_OWNER}/${this.REPO_NAME}/issues/${issueNumber}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `token ${githubToken}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          labels: labels[status],
        }),
      }
    );

    if (!response.ok) {
      const error = await response.text();
      throw new Error(
        `Erreur mise à jour issue: ${response.status} - ${error}`
      );
    }
  }

  /**
   * Anonymise une URL en supprimant les paramètres sensibles
   */
  private static anonymizeUrl(url?: string): string | undefined {
    if (!url) return undefined;

    try {
      const urlObj = new URL(url, "http://localhost");
      // Supprimer les paramètres sensibles
      const sensitiveParams = [
        "token",
        "auth",
        "key",
        "password",
        "secret",
        "id",
      ];
      sensitiveParams.forEach((param) => {
        urlObj.searchParams.delete(param);
      });

      // Garder seulement le pathname et les paramètres non sensibles
      return urlObj.pathname + (urlObj.search ? urlObj.search : "");
    } catch {
      // Si l'URL est invalide, retourner le pathname seulement
      return url.split("?")[0];
    }
  }

  /**
   * Anonymise le User-Agent en gardant seulement les infos essentielles
   */
  private static anonymizeUserAgent(userAgent?: string): string | undefined {
    if (!userAgent) return undefined;

    // Extraire seulement le navigateur et l'OS
    const browserMatch = userAgent.match(/(Chrome|Firefox|Safari|Edge)\/\d+/);
    const osMatch = userAgent.match(/\((Windows|Mac|Linux|Android|iOS)/);

    const browser = browserMatch ? browserMatch[0] : "Unknown Browser";
    const os = osMatch ? osMatch[1] : "Unknown OS";

    return `${browser} on ${os}`;
  }
}

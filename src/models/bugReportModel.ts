export interface CreateBugReportData {
  title: string;
  description: string;
  stepsToReproduce: string;
  expectedBehavior: string;
  actualBehavior: string;
  environment: {
    browser?: string;
    browserVersion?: string;
    operatingSystem?: string;
    deviceType?: string;
    screenResolution?: string;
  };
  userAgent?: string;
  url?: string;
  component?: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  reporterId?: string;
  attachments?: string[];
}

import { prisma } from "../lib/database.js";

export class BugReportModel {
  /**
   * Créer un nouveau rapport de bug
   */
  static async create(data: CreateBugReportData) {
    return await prisma.bugReport.create({
      data: {
        title: data.title,
        description: data.description,
        stepsToReproduce: data.stepsToReproduce,
        expectedBehavior: data.expectedBehavior,
        actualBehavior: data.actualBehavior,
        environment: data.environment,
        userAgent: data.userAgent,
        url: data.url,
        component: data.component,
        priority: data.priority,
        reporterId: data.reporterId,
        attachments: data.attachments,
        status: "OPEN",
      },
    });
  }
}

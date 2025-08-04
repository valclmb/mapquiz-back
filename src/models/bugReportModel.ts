export interface CreateBugReportData {
  title: string;
  description: string;
  stepsToReproduce?: string;
  location?: string;
  environment: {
    browser?: string;
    browserVersion?: string;
    operatingSystem?: string;
    deviceType?: string;
    screenResolution?: string;
  };
  userAgent?: string;
  url?: string;
  reporterId?: string;
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
        location: data.location,
        environment: data.environment,
        userAgent: data.userAgent,
        url: data.url,
        reporterId: data.reporterId,
        status: "OPEN",
      },
    });
  }
}

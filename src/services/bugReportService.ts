import { AppError } from "../lib/errorHandler.js";
import {
  BugReportModel,
  CreateBugReportData,
} from "../models/bugReportModel.js";

export class BugReportService {
  /**
   * Créer un nouveau rapport de bug
   */
  static async createBugReport(data: CreateBugReportData) {
    try {
      const bugReport = await BugReportModel.create(data);
      return bugReport;
    } catch (error) {
      throw new AppError("Erreur lors de la création du rapport de bug", 500);
    }
  }
}

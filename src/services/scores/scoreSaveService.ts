import { ValidationError } from "../../lib/errors.js";
import * as ScoreModel from "../../models/scoreModel.js";
import { SaveScoreData } from "./types.js";

/**
 * Service pour l'enregistrement des scores
 */
export class ScoreSaveService {
  /**
   * Enregistre un score
   */
  static async saveScore(data: SaveScoreData) {
    // Validation simple (à enrichir si besoin)
    if (
      !data.userId ||
      typeof data.score !== "number" ||
      typeof data.totalQuestions !== "number"
    ) {
      throw new ValidationError("Paramètres de score invalides");
    }
    return await ScoreModel.createScore(data);
  }
}

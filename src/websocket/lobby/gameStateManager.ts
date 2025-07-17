import { getCountries } from "../../lib/countryService.js";

// Type pour les données de progression d'un joueur
export type PlayerProgress = {
  validatedCountries: string[];
  incorrectCountries: string[];
  score: number;
  progress: number;
  status: string;
  name: string;
  lastAnswerTime?: number;
  consecutiveCorrect?: number;
};

// Type pour l'état du jeu
export type GameState = {
  startTime: number;
  countries: any[];
  settings: {
    selectedRegions: string[];
  };
};

/**
 * Gestionnaire de l'état du jeu
 */
export class GameStateManager {
  /**
   * Génère les pays pour la partie en fonction des paramètres
   */
  static async generateCountriesForGame(settings: any): Promise<any[]> {
    const selectedRegions = settings.selectedRegions || [];

    // Récupérer tous les pays
    const allCountries = await getCountries();

    // Marquer les pays comme filtrés s'ils ne sont pas dans les régions sélectionnées
    const countriesWithFiltered = allCountries.map((country) => ({
      ...country,
      filtered:
        selectedRegions.length > 0 &&
        !selectedRegions.includes(country.properties.continent),
    }));

    return this.shuffleArray(countriesWithFiltered);
  }

  /**
   * Vérifie si un joueur a terminé la partie
   */
  static checkGameCompletion(
    playerProgress: PlayerProgress,
    totalQuestions: number
  ): boolean {
    return playerProgress.progress >= totalQuestions;
  }

  /**
   * Calcule les classements des joueurs
   */
  static calculateRankings(players: Map<string, PlayerProgress>): any[] {
    const playerArray = Array.from(players.entries()).map(([id, data]) => ({
      id,
      name: data.name,
      score: data.score,
      progress: data.progress,
      status: data.status,
    }));

    // Trier par score décroissant, puis par progression décroissante
    return playerArray.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return b.progress - a.progress;
    });
  }

  /**
   * Fonction utilitaire pour mélanger un tableau
   */
  private static shuffleArray<T>(array: T[]): T[] {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }
}

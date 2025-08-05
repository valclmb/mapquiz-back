// Types pour les scores et résultats de jeu
export interface GameResult {
  id: string;
  userId: string;
  lobbyId: string;
  score: number;
  totalQuestions: number;
  completedAt: Date;
}

export interface GameProgressRequest {
  score: number;
  progress: number;
  answerTime?: number;
  isConsecutiveCorrect?: boolean;
}

export interface PlayerProgressRequest {
  validatedCountries: string[];
  incorrectCountries: string[];
  score: number;
  progress: number;
}

// Types pour les données de base de données
export interface DatabaseGameScore {
  id: string;
  userId: string;
  score: number;
  totalQuestions: number;
  selectedRegions: string[];
  gameMode: string;
  duration?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScoreHistoryItem {
  score: number;
  duration: number;
  selectedRegions: string[];
  date: string;
}

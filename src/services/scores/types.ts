export interface SaveScoreData {
  userId: string;
  score: number;
  totalQuestions: number;
  selectedRegions: string[];
  gameMode: string;
  duration?: number;
}

export interface ChartScoreItem {
  id: string;
  date: string; // Format dd/MM
  score: number; // Pourcentage arrondi
  raw: {
    id: string;
    score: number;
    totalQuestions: number;
    selectedRegions: string[];
    gameMode: string;
    duration: number;
    createdAt: string;
  };
}

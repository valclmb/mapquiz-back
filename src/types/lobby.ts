// Types pour les lobbies
export interface LobbySettings {
  totalQuestions?: number;
  timeLimit?: number;
  difficulty?: "easy" | "medium" | "hard";
  [key: string]: any;
}

export interface LobbyPlayer {
  id: string;
  name: string;
  status: "invited" | "joined" | "ready" | "playing";
  score?: number;
  progress?: number;
}

export interface Lobby {
  id: string;
  name: string;
  hostId: string;
  hostName: string;
  status: "waiting" | "playing" | "finished";
  gameSettings: LobbySettings;
  players: LobbyPlayer[];
}

// Types pour les données de base de données
export interface DatabaseLobbyPlayer {
  userId: string;
  lobbyId: string;
  status: string;
  score?: number;
  progress?: number;
  validatedCountries?: string[];
  incorrectCountries?: string[];
  user: {
    id: string;
    name: string;
    tag?: string;
  };
}

export interface DatabaseLobby {
  id: string;
  name: string;
  hostId: string;
  status: string;
  settings: LobbySettings;
  authorizedPlayers: string[];
  gameState?: any;
  host: {
    id: string;
    name: string;
    tag?: string;
  };
  players: DatabaseLobbyPlayer[];
}

export interface PlayerRanking {
  id: string;
  name: string;
  score: number;
  rank: number;
}

export interface GameResults {
  rankings: PlayerRanking[];
  hostId: string;
}

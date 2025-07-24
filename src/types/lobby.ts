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
  presenceStatus?: "present" | "absent";
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

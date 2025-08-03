// Types pour les requêtes API

export interface AddFriendRequest {
  Body: { tag: string };
}

export interface RemoveFriendRequest {
  Body: { friendId: string };
}

export interface FriendRequestActionRequest {
  Body: { action: "accept" | "reject" };
  Params: { id: string };
}

export interface SaveScoreRequest {
  Body: {
    score: number;
    totalQuestions: number;
    selectedRegions: string[];
    gameMode: string;
    duration?: number;
  };
}

export interface CreateLobbyRequest {
  Body: {
    name: string;
    settings: {
      selectedRegions: string[];
      gameMode: string;
    };
  };
}

export interface UpdateLobbySettingsRequest {
  Body: {
    settings: {
      selectedRegions: string[];
      gameMode: string;
    };
  };
  Params: { lobbyId: string };
}

// Types pour les réponses API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

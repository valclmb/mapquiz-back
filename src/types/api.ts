import { LobbySettings } from "./lobby.js";

// Types pour les requêtes API
export interface AddFriendRequest {
  tag: string;
}

export interface RemoveFriendRequest {
  friendId: string;
}

export interface FriendRequestActionRequest {
  action: "accept" | "reject";
}

export interface CreateLobbyRequest {
  name: string;
  settings: LobbySettings;
}

export interface UpdateLobbySettingsRequest {
  settings: LobbySettings;
}

// Types pour les réponses API
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
}

// Constantes pour les types de messages WebSocket
export const WS_MESSAGE_TYPES = {
  AUTHENTICATE: "authenticate",
  PING: "ping",
  SEND_FRIEND_REQUEST: "send_friend_request",
  RESPOND_FRIEND_REQUEST: "respond_friend_request",
  CREATE_LOBBY: "create_lobby",
  INVITE_TO_LOBBY: "invite_to_lobby",
  JOIN_LOBBY: "join_lobby",
  LEAVE_LOBBY: "leave_lobby",
  UPDATE_LOBBY_SETTINGS: "update_lobby_settings",
  SET_PLAYER_READY: "set_player_ready",
  START_GAME: "start_game",
  UPDATE_GAME_PROGRESS: "update_game_progress",
  UPDATE_PLAYER_PROGRESS: "update_player_progress",
  GET_GAME_STATE: "get_game_state",
  LEAVE_GAME: "leave_game",
} as const;

// Types pour les messages WebSocket
export interface WebSocketMessage {
  type: string;
  payload: any;
}

export interface WebSocketResponse {
  type: string;
  data?: any;
  message?: string;
  error?: string;
}

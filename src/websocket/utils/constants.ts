// Constantes WebSocket
export const WEBSOCKET_CONSTANTS = {
  // Types de messages de système
  SYSTEM_MESSAGES: {
    CONNECTED: "connected",
    AUTHENTICATED: "authenticated",
    ERROR: "error",
    PONG: "pong",
  },

  // Types de messages de lobby
  LOBBY_MESSAGES: {
    LOBBY_UPDATE: "lobby_update",
    GAME_START: "game_start",
    SCORE_UPDATE: "score_update",
    GAME_END: "game_end",
  },

  // Statuts de connexion
  CONNECTION_STATUS: {
    CONNECTING: "connecting",
    CONNECTED: "connected",
    DISCONNECTED: "disconnected",
    ERROR: "error",
  },

  // Codes d'erreur
  ERROR_CODES: {
    AUTHENTICATION_FAILED: "authentication_failed",
    AUTHENTICATION_ERROR: "authentication_error",
    INVALID_MESSAGE: "invalid_message",
    LOBBY_NOT_FOUND: "lobby_not_found",
    PLAYER_NOT_FOUND: "player_not_found",
  },
} as const;

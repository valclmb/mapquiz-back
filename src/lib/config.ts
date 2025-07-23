import { AppConfig } from "../types/index.js";

/**
 * Configuration par défaut de l'application
 */
const defaultConfig: AppConfig = {
  port: 3000,
  host: "0.0.0.0",
  cors: {
    origin: [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "https://frontend-lively-star-6238.fly.dev",
    ],
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Cookie",
    ],
    credentials: true,
    maxAge: 86400,
  },
  rateLimit: {
    max: 100,
    timeWindow: "1 minute",
  },
};

/**
 * Configuration de l'environnement
 */
const envConfig: Partial<AppConfig> = {
  port: process.env.PORT ? parseInt(process.env.PORT, 10) : defaultConfig.port,
  host: process.env.HOST || defaultConfig.host,
  cors: {
    ...defaultConfig.cors,
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
      : defaultConfig.cors.origin,
  },
  rateLimit: {
    max: process.env.RATE_LIMIT_MAX
      ? parseInt(process.env.RATE_LIMIT_MAX, 10)
      : defaultConfig.rateLimit.max,
    timeWindow:
      process.env.RATE_LIMIT_WINDOW || defaultConfig.rateLimit.timeWindow,
  },
};

/**
 * Configuration finale de l'application
 */
export const config: AppConfig = {
  ...defaultConfig,
  ...envConfig,
};

/**
 * Constantes de l'application
 */
export const APP_CONSTANTS = {
  // Messages d'erreur
  ERRORS: {
    USER_NOT_FOUND: "Utilisateur non trouvé",
    LOBBY_NOT_FOUND: "Lobby non trouvé",
    PLAYER_NOT_IN_LOBBY: "Joueur non trouvé dans le lobby",
    UNAUTHORIZED: "Non autorisé",
    INVALID_REQUEST: "Requête invalide",
    FRIEND_REQUEST_NOT_FOUND: "Demande d'ami non trouvée",
    ALREADY_FRIENDS: "Vous êtes déjà amis",
    FRIEND_REQUEST_PENDING: "Demande d'ami déjà en attente",
  },

  // Statuts des lobbies
  LOBBY_STATUS: {
    WAITING: "waiting",
    PLAYING: "playing",
    FINISHED: "finished",
  },

  // Statuts des joueurs
  PLAYER_STATUS: {
    INVITED: "invited",
    JOINED: "joined",
    READY: "ready",
    PLAYING: "playing",
    DISCONNECTED: "disconnected",
  },

  // Types de messages WebSocket
  WEBSOCKET_MESSAGES: {
    CONNECTED: "connected",
    AUTHENTICATED: "authenticated",
    AUTHENTICATION_FAILED: "authentication_failed",
    AUTHENTICATION_ERROR: "authentication_error",
    ERROR: "error",
    PING: "ping",
    PONG: "pong",
  },

  // Limites
  LIMITS: {
    MAX_LOBBY_NAME_LENGTH: 50,
    MAX_PLAYERS_PER_LOBBY: 10,
    MIN_LOBBY_NAME_LENGTH: 3,
    MAX_TAG_LENGTH: 20,
    MIN_TAG_LENGTH: 3,
  },

  // Intervalles de temps (en millisecondes)
  TIMEOUTS: {
    WEBSOCKET_PING_INTERVAL: 30000, // 30 secondes
    WEBSOCKET_PONG_TIMEOUT: 10000, // 10 secondes
    GAME_SESSION_TIMEOUT: 3600000, // 1 heure
    LOBBY_CLEANUP_DELAY: 300000, // 5 minutes avant suppression d'un lobby inactif
    PLAYER_DISCONNECT_TIMEOUT: 60000, // 1 minute avant suppression d'un joueur déconnecté
  },
} as const;

/**
 * Validation de la configuration
 */
export function validateConfig(): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error("PORT doit être entre 1 et 65535");
  }

  if (config.rateLimit.max < 1) {
    throw new Error("RATE_LIMIT_MAX doit être positif");
  }

  if (
    config.rateLimit.timeWindow !== "1 minute" &&
    config.rateLimit.timeWindow !== "5 minutes" &&
    config.rateLimit.timeWindow !== "15 minutes"
  ) {
    throw new Error(
      'RATE_LIMIT_WINDOW doit être "1 minute", "5 minutes" ou "15 minutes"'
    );
  }
}

// Valider la configuration au démarrage
validateConfig();

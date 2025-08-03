/**
 * Configuration de l'application
 */
export const APP_CONFIG = {
  // Limites
  LIMITS: {
    MAX_LOBBY_NAME_LENGTH: 50,
    MAX_PLAYERS_PER_LOBBY: 10,
    MIN_LOBBY_NAME_LENGTH: 3,
    MAX_TAG_LENGTH: 20,
    MIN_TAG_LENGTH: 3,
  },

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
    JOINED: "joined",
    READY: "ready",
    PLAYING: "playing",
  },
} as const;

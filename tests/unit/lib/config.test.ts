import { APP_CONFIG } from "../../../src/lib/config.js";

describe("APP_CONFIG", () => {
  describe("LIMITS", () => {
    it("devrait avoir les bonnes limites pour les noms de lobby", () => {
      expect(APP_CONFIG.LIMITS.MAX_LOBBY_NAME_LENGTH).toBe(50);
      expect(APP_CONFIG.LIMITS.MIN_LOBBY_NAME_LENGTH).toBe(3);
    });

    it("devrait avoir les bonnes limites pour les joueurs", () => {
      expect(APP_CONFIG.LIMITS.MAX_PLAYERS_PER_LOBBY).toBe(10);
    });

    it("devrait avoir les bonnes limites pour les tags", () => {
      expect(APP_CONFIG.LIMITS.MAX_TAG_LENGTH).toBe(20);
      expect(APP_CONFIG.LIMITS.MIN_TAG_LENGTH).toBe(3);
    });
  });

  describe("ERRORS", () => {
    it("devrait avoir tous les messages d'erreur requis", () => {
      expect(APP_CONFIG.ERRORS.USER_NOT_FOUND).toBe("Utilisateur non trouvé");
      expect(APP_CONFIG.ERRORS.LOBBY_NOT_FOUND).toBe("Lobby non trouvé");
      expect(APP_CONFIG.ERRORS.PLAYER_NOT_IN_LOBBY).toBe(
        "Joueur non trouvé dans le lobby"
      );
      expect(APP_CONFIG.ERRORS.UNAUTHORIZED).toBe("Non autorisé");
      expect(APP_CONFIG.ERRORS.INVALID_REQUEST).toBe("Requête invalide");
      expect(APP_CONFIG.ERRORS.FRIEND_REQUEST_NOT_FOUND).toBe(
        "Demande d'ami non trouvée"
      );
      expect(APP_CONFIG.ERRORS.ALREADY_FRIENDS).toBe("Vous êtes déjà amis");
      expect(APP_CONFIG.ERRORS.FRIEND_REQUEST_PENDING).toBe(
        "Demande d'ami déjà en attente"
      );
    });
  });

  describe("LOBBY_STATUS", () => {
    it("devrait avoir les bons statuts de lobby", () => {
      expect(APP_CONFIG.LOBBY_STATUS.WAITING).toBe("waiting");
      expect(APP_CONFIG.LOBBY_STATUS.PLAYING).toBe("playing");
      expect(APP_CONFIG.LOBBY_STATUS.FINISHED).toBe("finished");
    });
  });

  describe("PLAYER_STATUS", () => {
    it("devrait avoir les bons statuts de joueur", () => {
      expect(APP_CONFIG.PLAYER_STATUS.JOINED).toBe("joined");
      expect(APP_CONFIG.PLAYER_STATUS.READY).toBe("ready");
      expect(APP_CONFIG.PLAYER_STATUS.PLAYING).toBe("playing");
    });
  });

  describe("Structure", () => {
    it("devrait être un objet constant", () => {
      expect(typeof APP_CONFIG).toBe("object");
      expect(APP_CONFIG).toBeDefined();
    });

    it("devrait avoir toutes les propriétés requises", () => {
      expect(APP_CONFIG).toHaveProperty("LIMITS");
      expect(APP_CONFIG).toHaveProperty("ERRORS");
      expect(APP_CONFIG).toHaveProperty("LOBBY_STATUS");
      expect(APP_CONFIG).toHaveProperty("PLAYER_STATUS");
    });
  });
});

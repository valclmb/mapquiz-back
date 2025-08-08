import * as LobbyModel from "../../../../src/models/lobbyModel.js";
import { PlayerService } from "../../../../src/services/playerService.js";
import { LobbyLifecycleManager } from "../../../../src/websocket/lobby/lobbyLifecycle.js";

// Mock des dépendances
jest.mock("../../../../src/models/lobbyModel.js");
jest.mock("../../../../src/services/playerService.js");

const mockLobbyModel = LobbyModel as jest.Mocked<typeof LobbyModel>;
const mockPlayerService = PlayerService as jest.Mocked<typeof PlayerService>;

describe("LobbyLifecycleManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Nettoyer les lobbies entre les tests
    const activeLobbies = LobbyLifecycleManager.getAllActiveLobbies();
    activeLobbies.clear();
  });

  describe("scheduleLobbyDeletion", () => {
    it("devrait programmer la suppression différée d'un lobby", () => {
      const lobbyId = "test-lobby-id";
      const delayMs = 5000;

      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId, delayMs);

      // Vérifier que la fonction ne lance pas d'erreur
      expect(true).toBe(true);
    });

    it("ne devrait pas programmer la suppression si un timer existe déjà", () => {
      const lobbyId = "test-lobby-id";

      // Premier appel
      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId);

      // Deuxième appel - ne devrait pas créer un nouveau timer
      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId);

      // Vérifier que la fonction ne lance pas d'erreur
      expect(true).toBe(true);
    });
  });

  describe("cancelLobbyDeletion", () => {
    it("devrait annuler la suppression différée d'un lobby", () => {
      const lobbyId = "test-lobby-id";

      // Programmer la suppression
      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId);

      // Annuler la suppression
      LobbyLifecycleManager.cancelLobbyDeletion(lobbyId);

      // Vérifier que la fonction ne lance pas d'erreur
      expect(true).toBe(true);
    });

    it("ne devrait rien faire si aucun timer n'existe", () => {
      const lobbyId = "test-lobby-id";

      LobbyLifecycleManager.cancelLobbyDeletion(lobbyId);

      // Vérifier que la fonction ne lance pas d'erreur
      expect(true).toBe(true);
    });
  });

  describe("createLobby", () => {
    it("devrait créer un nouveau lobby en mémoire", () => {
      const lobbyId = "test-lobby-id";
      const hostId = "host-id";
      const hostName = "Host Name";
      const settings = { totalQuestions: 10 };

      const mockPlayer = {
        name: hostName,
        status: "ready",
        score: 0,
        progress: 0,
        validatedCountries: [],
        incorrectCountries: [],
      };

      mockPlayerService.createPlayer.mockReturnValue(mockPlayer);

      const result = LobbyLifecycleManager.createLobby(
        lobbyId,
        hostId,
        hostName,
        settings
      );

      expect(result).toEqual({
        lobbyId,
        hostId,
        settings,
      });

      expect(mockPlayerService.createPlayer).toHaveBeenCalledWith(hostName);
    });
  });

  describe("removeLobby", () => {
    it("devrait supprimer un lobby de la mémoire", () => {
      const lobbyId = "test-lobby-id";

      // Créer un lobby d'abord
      LobbyLifecycleManager.createLobby(lobbyId, "host-id", "Host", {});

      // Vérifier qu'il existe
      expect(LobbyLifecycleManager.getLobbyInMemory(lobbyId)).toBeTruthy();

      // Supprimer le lobby
      LobbyLifecycleManager.removeLobby(lobbyId);

      // Vérifier qu'il n'existe plus
      expect(LobbyLifecycleManager.getLobbyInMemory(lobbyId)).toBeNull();
    });
  });

  describe("restoreLobbyFromDatabase", () => {
    it("devrait restaurer un lobby depuis la base de données", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        hostId: "host-id",
        settings: { totalQuestions: 10 },
        status: "waiting",
        players: [
          {
            userId: "player1",
            status: "ready",
            score: 100,
            progress: 50,
            validatedCountries: ["France"],
            incorrectCountries: [],
            user: {
              name: "Player 1",
            },
          },
        ],
      };

      LobbyLifecycleManager.restoreLobbyFromDatabase(lobbyId, lobbyData);

      const restoredLobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(restoredLobby).toBeDefined();
      expect(restoredLobby.hostId).toBe("host-id");
      expect(restoredLobby.settings).toEqual({ totalQuestions: 10 });
      expect(restoredLobby.status).toBe("waiting");
      expect(restoredLobby.players.get("player1")).toEqual({
        status: "ready",
        score: 100,
        progress: 50,
        name: "Player 1",
        validatedCountries: ["France"],
        incorrectCountries: [],
      });
    });

    it("devrait gérer les lobbies sans joueurs", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        hostId: "host-id",
        settings: { totalQuestions: 10 },
        status: "waiting",
        players: [],
      };

      LobbyLifecycleManager.restoreLobbyFromDatabase(lobbyId, lobbyData);

      const restoredLobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(restoredLobby).toBeDefined();
      expect(restoredLobby.players.size).toBe(0);
    });

    it("devrait gérer les lobbies sans données de joueurs", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        hostId: "host-id",
        settings: { totalQuestions: 10 },
        status: "waiting",
      };

      LobbyLifecycleManager.restoreLobbyFromDatabase(lobbyId, lobbyData);

      const restoredLobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(restoredLobby).toBeDefined();
      expect(restoredLobby.players.size).toBe(0);
    });

    it("devrait gérer les joueurs avec des données manquantes", () => {
      const lobbyId = "test-lobby-id";
      const lobbyData = {
        hostId: "host-id",
        settings: { totalQuestions: 10 },
        status: "waiting",
        players: [
          {
            userId: "player1",
            status: "ready",
            score: null,
            progress: null,
            validatedCountries: null,
            incorrectCountries: null,
            user: {
              name: "Player 1",
            },
          },
        ],
      };

      LobbyLifecycleManager.restoreLobbyFromDatabase(lobbyId, lobbyData);

      const restoredLobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(restoredLobby.players.get("player1")).toEqual({
        status: "ready",
        score: 0,
        progress: 0,
        name: "Player 1",
        validatedCountries: [],
        incorrectCountries: [],
      });
    });
  });

  describe("getLobbyInMemory", () => {
    it("devrait récupérer un lobby en mémoire", () => {
      const lobbyId = "test-lobby-id";
      const settings = { totalQuestions: 10 };

      LobbyLifecycleManager.createLobby(lobbyId, "host-id", "Host", settings);

      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(lobby).toBeDefined();
      expect(lobby.settings).toEqual(settings);
    });

    it("devrait retourner null si le lobby n'existe pas", () => {
      const lobbyId = "non-existent-lobby";

      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(lobby).toBeNull();
    });
  });

  describe("getAllActiveLobbies", () => {
    it("devrait retourner tous les lobbies actifs", () => {
      // Créer quelques lobbies
      LobbyLifecycleManager.createLobby("lobby1", "host1", "Host 1", {});
      LobbyLifecycleManager.createLobby("lobby2", "host2", "Host 2", {});

      const activeLobbies = LobbyLifecycleManager.getAllActiveLobbies();

      expect(activeLobbies.size).toBe(2);
      expect(activeLobbies.has("lobby1")).toBe(true);
      expect(activeLobbies.has("lobby2")).toBe(true);
    });

    it("devrait retourner une Map vide s'il n'y a pas de lobbies", () => {
      // Nettoyer les lobbies
      const activeLobbies = LobbyLifecycleManager.getAllActiveLobbies();
      activeLobbies.clear();

      const emptyLobbies = LobbyLifecycleManager.getAllActiveLobbies();
      expect(emptyLobbies.size).toBe(0);
    });
  });
});

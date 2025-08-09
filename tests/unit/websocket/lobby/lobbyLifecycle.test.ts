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

    // Mock par défaut pour PlayerService.createPlayer
    mockPlayerService.createPlayer.mockImplementation((name: string) => ({
      status: "joined",
      score: 0,
      progress: 0,
      name,
      validatedCountries: [],
      incorrectCountries: [],
    }));
  });

  describe("scheduleLobbyDeletion", () => {
    it("devrait programmer la suppression différée d'un lobby", () => {
      const lobbyId = "test-lobby-id";
      const delayMs = 5000;

      // Créer un lobby d'abord
      LobbyLifecycleManager.createLobby(lobbyId, "host-id", "Host", {});
      expect(LobbyLifecycleManager.getLobbyInMemory(lobbyId)).toBeTruthy();

      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId, delayMs);

      // Vérifier que le lobby existe toujours immédiatement après la programmation
      expect(LobbyLifecycleManager.getLobbyInMemory(lobbyId)).toBeTruthy();
    });

    it("ne devrait pas programmer la suppression si un timer existe déjà", () => {
      const lobbyId = "test-lobby-id";

      // Créer un lobby d'abord
      LobbyLifecycleManager.createLobby(lobbyId, "host-id", "Host", {});

      // Premier appel
      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId);

      // Deuxième appel - ne devrait pas créer un nouveau timer
      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId);

      // Vérifier que le lobby existe toujours
      expect(LobbyLifecycleManager.getLobbyInMemory(lobbyId)).toBeTruthy();
    });
  });

  describe("cancelLobbyDeletion", () => {
    it("devrait annuler la suppression différée d'un lobby", () => {
      const lobbyId = "test-lobby-id";

      // Créer un lobby d'abord
      LobbyLifecycleManager.createLobby(lobbyId, "host-id", "Host", {});

      // Programmer la suppression
      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId);

      // Annuler la suppression
      LobbyLifecycleManager.cancelLobbyDeletion(lobbyId);

      // Vérifier que le lobby existe toujours
      expect(LobbyLifecycleManager.getLobbyInMemory(lobbyId)).toBeTruthy();
    });

    it("ne devrait rien faire si aucun timer n'existe", () => {
      const lobbyId = "test-lobby-id";

      // Ne pas créer de lobby, juste essayer d'annuler
      LobbyLifecycleManager.cancelLobbyDeletion(lobbyId);

      // Vérifier qu'aucune erreur n'est levée
      expect(LobbyLifecycleManager.getLobbyInMemory(lobbyId)).toBeNull();
    });
  });

  describe("createLobby", () => {
    it("devrait créer un lobby avec les paramètres fournis", () => {
      const lobbyId = "test-lobby-id";
      const hostId = "host-id";
      const hostName = "Test Host";
      const settings = { totalQuestions: 10 };

      LobbyLifecycleManager.createLobby(lobbyId, hostId, hostName, settings);

      expect(mockPlayerService.createPlayer).toHaveBeenCalledWith(hostName);

      // Vérifier que le lobby a été créé en mémoire
      const createdLobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      expect(createdLobby).toBeDefined();
      expect(createdLobby.hostId).toBe(hostId);
      expect(createdLobby.settings).toEqual(settings);
      expect(createdLobby.players.has(hostId)).toBe(true);
      expect(createdLobby.players.get(hostId)?.name).toBe(hostName);
      expect(createdLobby.players.get(hostId)?.status).toBe("joined");
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
      expect(restoredLobby.hostId).toBe("host-id");
      expect(restoredLobby.settings).toEqual({ totalQuestions: 10 });
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
      expect(restoredLobby.hostId).toBe("host-id");
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
      expect(lobby.hostId).toBe("host-id");
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
      expect(activeLobbies.get("lobby1")?.hostId).toBe("host1");
      expect(activeLobbies.get("lobby2")?.hostId).toBe("host2");
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

import { prisma } from "../../../src/lib/database.js";
import * as lobbyModel from "../../../src/models/lobbyModel.js";

// Mock de Prisma
jest.mock("../../../src/lib/database.js", () => ({
  prisma: {
    gameLobby: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findMany: jest.fn(),
    },
    lobbyPlayer: {
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
    },
    multiplayerGameResult: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

const mockPrisma = prisma as jest.Mocked<typeof prisma>;

describe("LobbyModel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createLobby", () => {
    it("devrait créer un lobby avec succès", async () => {
      const mockLobby = {
        id: "lobby-id",
        name: "Test Lobby",
        hostId: "host-id",
        gameSettings: { maxPlayers: 4 },
        authorizedPlayers: ["host-id"],
        host: { id: "host-id", name: "Host" },
        players: [
          {
            userId: "host-id",
            status: "joined",
            user: { id: "host-id", name: "Host" },
          },
        ],
      };
      (mockPrisma.gameLobby.create as jest.Mock).mockResolvedValue(mockLobby);

      const result = await lobbyModel.createLobby("host-id", "Test Lobby", {
        maxPlayers: 4,
      });

      expect(mockPrisma.gameLobby.create).toHaveBeenCalledWith({
        data: {
          name: "Test Lobby",
          hostId: "host-id",
          gameSettings: { maxPlayers: 4 },
          authorizedPlayers: ["host-id"],
          players: {
            create: {
              userId: "host-id",
              status: "joined",
            },
          },
        },
        include: {
          host: true,
          players: {
            include: {
              user: true,
            },
          },
        },
      });
      expect(result).toEqual(mockLobby);
    });

    it("devrait créer un lobby avec un nom par défaut", async () => {
      const mockLobby = {
        id: "lobby-id",
        name: "Lobby de host-id",
        hostId: "host-id",
        gameSettings: { maxPlayers: 4 },
        authorizedPlayers: ["host-id"],
        host: { id: "host-id", name: "Host" },
        players: [],
      };
      (mockPrisma.gameLobby.create as jest.Mock).mockResolvedValue(mockLobby);

      const result = await lobbyModel.createLobby("host-id", "", {
        maxPlayers: 4,
      });

      expect(mockPrisma.gameLobby.create).toHaveBeenCalledWith({
        data: {
          name: "Lobby de host-id",
          hostId: "host-id",
          gameSettings: { maxPlayers: 4 },
          authorizedPlayers: ["host-id"],
          players: {
            create: {
              userId: "host-id",
              status: "joined",
            },
          },
        },
        include: {
          host: true,
          players: {
            include: {
              user: true,
            },
          },
        },
      });
      expect(result).toEqual(mockLobby);
    });
  });

  describe("getLobby", () => {
    it("devrait trouver un lobby par ID", async () => {
      const mockLobby = {
        id: "lobby-id",
        name: "Test Lobby",
        hostId: "host-id",
        gameSettings: { maxPlayers: 4 },
        authorizedPlayers: ["host-id"],
        host: { id: "host-id", name: "Host" },
        players: [],
      };
      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(
        mockLobby
      );

      const result = await lobbyModel.getLobby("lobby-id");

      expect(mockPrisma.gameLobby.findUnique).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
        include: {
          host: true,
          players: {
            include: {
              user: true,
            },
          },
        },
      });
      expect(result).toEqual(mockLobby);
    });

    it("devrait retourner null si le lobby n'existe pas", async () => {
      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await lobbyModel.getLobby("invalid-id");

      expect(result).toBeNull();
    });
  });

  describe("addPlayerToLobby", () => {
    it("devrait ajouter un joueur au lobby", async () => {
      const mockPlayer = {
        id: "player-id",
        userId: "user-id",
        lobbyId: "lobby-id",
        status: "joined",
      };
      (mockPrisma.lobbyPlayer.create as jest.Mock).mockResolvedValue(
        mockPlayer
      );

      const result = await lobbyModel.addPlayerToLobby("lobby-id", "user-id");

      expect(mockPrisma.lobbyPlayer.create).toHaveBeenCalledWith({
        data: {
          lobbyId: "lobby-id",
          userId: "user-id",
          status: "joined",
        },
      });
      expect(result).toEqual(mockPlayer);
    });
  });

  describe("removePlayerFromLobby", () => {
    it("devrait supprimer un joueur du lobby", async () => {
      const mockPlayer = {
        id: "player-id",
        userId: "user-id",
        lobbyId: "lobby-id",
        status: "left",
      };
      (mockPrisma.lobbyPlayer.delete as jest.Mock).mockResolvedValue(
        mockPlayer
      );

      const result = await lobbyModel.removePlayerFromLobby(
        "lobby-id",
        "user-id"
      );

      expect(mockPrisma.lobbyPlayer.delete).toHaveBeenCalledWith({
        where: {
          lobbyId_userId: {
            lobbyId: "lobby-id",
            userId: "user-id",
          },
        },
      });
      expect(result).toEqual(mockPlayer);
    });

    it("devrait gérer les erreurs lors de la suppression", async () => {
      const error = new Error("Joueur non trouvé");
      (error as any).code = "P2025";
      (mockPrisma.lobbyPlayer.delete as jest.Mock).mockRejectedValue(error);

      const result = await lobbyModel.removePlayerFromLobby(
        "lobby-id",
        "invalid-user"
      );
      expect(result).toBeNull();
    });

    it("devrait gérer les erreurs de base de données", async () => {
      const error = new Error("Erreur de base de données");
      (mockPrisma.lobbyPlayer.delete as jest.Mock).mockRejectedValue(error);

      await expect(
        lobbyModel.removePlayerFromLobby("lobby-id", "user-id")
      ).rejects.toThrow("Erreur de base de données");
    });
  });

  describe("updatePlayerStatus", () => {
    it("devrait mettre à jour le statut d'un joueur", async () => {
      const mockPlayer = {
        id: "player-id",
        userId: "user-id",
        lobbyId: "lobby-id",
        status: "ready",
      };
      (mockPrisma.lobbyPlayer.update as jest.Mock).mockResolvedValue(
        mockPlayer
      );

      const result = await lobbyModel.updatePlayerStatus(
        "lobby-id",
        "user-id",
        "ready"
      );

      expect(mockPrisma.lobbyPlayer.update).toHaveBeenCalledWith({
        where: {
          lobbyId_userId: {
            lobbyId: "lobby-id",
            userId: "user-id",
          },
        },
        data: { status: "ready" },
      });
      expect(result).toEqual(mockPlayer);
    });

    it("devrait gérer les erreurs lors de la mise à jour", async () => {
      const error = new Error("Joueur non trouvé");
      (error as any).code = "P2025";
      (mockPrisma.lobbyPlayer.update as jest.Mock).mockRejectedValue(error);

      const result = await lobbyModel.updatePlayerStatus(
        "lobby-id",
        "invalid-user",
        "ready"
      );
      expect(result).toBeNull();
    });
  });

  describe("updatePlayerGameData", () => {
    it("devrait mettre à jour les données de jeu d'un joueur", async () => {
      const mockPlayer = {
        id: "player-id",
        userId: "user-id",
        lobbyId: "lobby-id",
        score: 85,
        progress: 50,
        validatedCountries: ["France", "Germany"],
        incorrectCountries: ["Spain"],
      };
      (mockPrisma.lobbyPlayer.update as jest.Mock).mockResolvedValue(
        mockPlayer
      );

      const result = await lobbyModel.updatePlayerGameData(
        "lobby-id",
        "user-id",
        85,
        50,
        ["France", "Germany"],
        ["Spain"]
      );

      expect(mockPrisma.lobbyPlayer.update).toHaveBeenCalledWith({
        where: {
          lobbyId_userId: {
            lobbyId: "lobby-id",
            userId: "user-id",
          },
        },
        data: {
          score: 85,
          progress: 50,
          validatedCountries: ["France", "Germany"],
          incorrectCountries: ["Spain"],
        },
      });
      expect(result).toEqual(mockPlayer);
    });

    it("devrait gérer les erreurs lors de la mise à jour", async () => {
      const error = new Error("Joueur non trouvé");
      (error as any).code = "P2025";
      (mockPrisma.lobbyPlayer.update as jest.Mock).mockRejectedValue(error);

      const result = await lobbyModel.updatePlayerGameData(
        "lobby-id",
        "invalid-user",
        85,
        50,
        ["France"],
        ["Spain"]
      );
      expect(result).toBeNull();
    });
  });

  describe("updateLobbySettings", () => {
    it("devrait mettre à jour les paramètres du lobby", async () => {
      const mockLobby = {
        id: "lobby-id",
        name: "Test Lobby",
        hostId: "host-id",
        gameSettings: { maxPlayers: 6, timeLimit: 300 },
      };
      (mockPrisma.gameLobby.update as jest.Mock).mockResolvedValue(mockLobby);

      const result = await lobbyModel.updateLobbySettings("lobby-id", {
        maxPlayers: 6,
        timeLimit: 300,
      });

      expect(mockPrisma.gameLobby.update).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
        data: {
          gameSettings: { maxPlayers: 6, timeLimit: 300 },
        },
      });
      expect(result).toEqual(mockLobby);
    });
  });

  describe("updateLobbyStatus", () => {
    it("devrait mettre à jour le statut du lobby", async () => {
      const mockLobby = {
        id: "lobby-id",
        name: "Test Lobby",
        hostId: "host-id",
        status: "playing",
        gameSettings: { maxPlayers: 4 },
        authorizedPlayers: ["host-id"],
        host: { id: "host-id", name: "Host" },
        players: [],
      };
      (mockPrisma.gameLobby.update as jest.Mock).mockResolvedValue(mockLobby);

      const result = await lobbyModel.updateLobbyStatus("lobby-id", "playing");

      expect(mockPrisma.gameLobby.update).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
        data: { status: "playing" },
      });
      expect(result).toEqual(mockLobby);
    });
  });

  describe("updateLobbyHost", () => {
    it("devrait mettre à jour l'hôte du lobby", async () => {
      const mockLobby = {
        id: "lobby-id",
        name: "Test Lobby",
        hostId: "new-host-id",
        gameSettings: { maxPlayers: 4 },
      };
      (mockPrisma.gameLobby.update as jest.Mock).mockResolvedValue(mockLobby);

      const result = await lobbyModel.updateLobbyHost(
        "lobby-id",
        "new-host-id"
      );

      expect(mockPrisma.gameLobby.update).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
        data: {
          hostId: "new-host-id",
        },
      });
      expect(result).toEqual(mockLobby);
    });
  });

  describe("areAllPlayersReady", () => {
    it("devrait retourner true si tous les joueurs sont prêts", async () => {
      const mockPlayers = [{ status: "ready" }, { status: "ready" }];
      (mockPrisma.lobbyPlayer.findMany as jest.Mock).mockResolvedValue(
        mockPlayers
      );

      const result = await lobbyModel.areAllPlayersReady("lobby-id", "host-id");

      expect(mockPrisma.lobbyPlayer.findMany).toHaveBeenCalledWith({
        where: { lobbyId: "lobby-id" },
      });
      expect(result).toBe(true);
    });

    it("devrait retourner false si un joueur n'est pas prêt", async () => {
      const mockPlayers = [{ status: "ready" }, { status: "joined" }];
      (mockPrisma.lobbyPlayer.findMany as jest.Mock).mockResolvedValue(
        mockPlayers
      );

      const result = await lobbyModel.areAllPlayersReady("lobby-id", "host-id");

      expect(result).toBe(false);
    });
  });

  describe("saveGameState", () => {
    it("devrait sauvegarder l'état du jeu", async () => {
      const mockLobby = {
        id: "lobby-id",
        name: "Test Lobby",
        gameState: { startTime: "2023-01-01", currentQuestion: 1 },
      };
      (mockPrisma.gameLobby.update as jest.Mock).mockResolvedValue(mockLobby);

      const gameState = { startTime: "2023-01-01", currentQuestion: 1 };
      const result = await lobbyModel.saveGameState("lobby-id", gameState);

      expect(mockPrisma.gameLobby.update).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
        data: { gameState },
      });
      expect(result).toEqual(mockLobby);
    });
  });

  describe("saveGameResult", () => {
    it("devrait sauvegarder un résultat de jeu", async () => {
      const mockResult = {
        id: "result-id",
        lobbyId: "lobby-id",
        userId: "user-id",
        score: 85,
        totalQuestions: 10,
        completionTime: 300,
        position: 1,
      };
      (mockPrisma.multiplayerGameResult.create as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await lobbyModel.saveGameResult(
        "lobby-id",
        "user-id",
        85,
        10,
        300,
        1
      );

      expect(mockPrisma.multiplayerGameResult.create).toHaveBeenCalledWith({
        data: {
          lobbyId: "lobby-id",
          userId: "user-id",
          score: 85,
          totalQuestions: 10,
          completionTime: 300,
          position: 1,
        },
      });
      expect(result).toEqual(mockResult);
    });

    it("devrait sauvegarder un résultat sans temps de completion", async () => {
      const mockResult = {
        id: "result-id",
        lobbyId: "lobby-id",
        userId: "user-id",
        score: 85,
        totalQuestions: 10,
        completionTime: null,
        position: null,
      };
      (mockPrisma.multiplayerGameResult.create as jest.Mock).mockResolvedValue(
        mockResult
      );

      const result = await lobbyModel.saveGameResult(
        "lobby-id",
        "user-id",
        85,
        10
      );

      expect(mockPrisma.multiplayerGameResult.create).toHaveBeenCalledWith({
        data: {
          lobbyId: "lobby-id",
          userId: "user-id",
          score: 85,
          totalQuestions: 10,
          completionTime: undefined,
          position: undefined,
        },
      });
      expect(result).toEqual(mockResult);
    });
  });

  describe("deleteLobby", () => {
    it("devrait supprimer un lobby", async () => {
      const mockLobby = {
        id: "lobby-id",
        name: "Test Lobby",
        hostId: "host-id",
        status: "waiting",
        gameSettings: { maxPlayers: 4 },
        authorizedPlayers: ["host-id"],
        host: { id: "host-id", name: "Host" },
        players: [],
      };
      (mockPrisma.gameLobby.delete as jest.Mock).mockResolvedValue(mockLobby);

      const result = await lobbyModel.deleteLobby("lobby-id");

      expect(mockPrisma.gameLobby.delete).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
      });
      expect(result).toEqual(mockLobby);
    });
  });

  describe("findUserLobbies", () => {
    it("devrait récupérer les lobbies d'un utilisateur", async () => {
      const mockLobbies = [
        {
          id: "lobby1",
          name: "Lobby 1",
          hostId: "host-id",
          status: "waiting",
          gameSettings: { maxPlayers: 4 },
          authorizedPlayers: ["host-id"],
          host: { id: "host-id", name: "Host" },
          players: [],
        },
        {
          id: "lobby2",
          name: "Lobby 2",
          hostId: "host-id",
          status: "playing",
          gameSettings: { maxPlayers: 4 },
          authorizedPlayers: ["host-id"],
          host: { id: "host-id", name: "Host" },
          players: [],
        },
      ];
      (mockPrisma.gameLobby.findMany as jest.Mock).mockResolvedValue(
        mockLobbies
      );

      const result = await lobbyModel.findUserLobbies("host-id");

      expect(mockPrisma.gameLobby.findMany).toHaveBeenCalledWith({
        where: {
          players: {
            some: {
              userId: "host-id",
            },
          },
        },
        include: {
          host: true,
          players: {
            include: {
              user: true,
            },
          },
        },
      });
      expect(result).toEqual(mockLobbies);
    });
  });

  describe("getPlayerInLobby", () => {
    it("devrait trouver un joueur dans un lobby", async () => {
      const mockPlayer = {
        id: "player-id",
        userId: "user-id",
        lobbyId: "lobby-id",
        status: "joined",
        user: { id: "user-id", name: "User" },
      };
      (mockPrisma.lobbyPlayer.findUnique as jest.Mock).mockResolvedValue(
        mockPlayer
      );

      const result = await lobbyModel.getPlayerInLobby("lobby-id", "user-id");

      expect(mockPrisma.lobbyPlayer.findUnique).toHaveBeenCalledWith({
        where: {
          lobbyId_userId: {
            lobbyId: "lobby-id",
            userId: "user-id",
          },
        },
        include: {
          user: true,
        },
      });
      expect(result).toEqual(mockPlayer);
    });

    it("devrait retourner null si le joueur n'existe pas", async () => {
      (mockPrisma.lobbyPlayer.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await lobbyModel.getPlayerInLobby(
        "lobby-id",
        "invalid-user"
      );

      expect(result).toBeNull();
    });
  });

  describe("addAuthorizedPlayer", () => {
    it("devrait ajouter un joueur autorisé au lobby", async () => {
      const mockLobby = {
        id: "lobby-id",
        authorizedPlayers: ["host-id"],
      };
      const updatedLobby = {
        id: "lobby-id",
        authorizedPlayers: ["host-id", "new-user-id"],
      };

      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(
        mockLobby
      );
      (mockPrisma.gameLobby.update as jest.Mock).mockResolvedValue(
        updatedLobby
      );

      const result = await lobbyModel.addAuthorizedPlayer(
        "lobby-id",
        "new-user-id"
      );

      expect(mockPrisma.gameLobby.findUnique).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
      });
      expect(mockPrisma.gameLobby.update).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
        data: { authorizedPlayers: ["host-id", "new-user-id"] },
      });
      expect(result).toEqual(updatedLobby);
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        lobbyModel.addAuthorizedPlayer("invalid-lobby-id", "user-id")
      ).rejects.toThrow("Lobby non trouvé");
    });

    it("ne devrait pas ajouter un joueur déjà autorisé", async () => {
      const mockLobby = {
        id: "lobby-id",
        authorizedPlayers: ["host-id", "existing-user-id"],
      };

      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(
        mockLobby
      );

      const result = await lobbyModel.addAuthorizedPlayer(
        "lobby-id",
        "existing-user-id"
      );

      expect(mockPrisma.gameLobby.update).not.toHaveBeenCalled();
      expect(result).toEqual(mockLobby);
    });
  });

  describe("updateLobbyAuthorizedPlayers", () => {
    it("devrait ajouter un joueur autorisé", async () => {
      const mockLobby = {
        authorizedPlayers: ["host-id"],
      };

      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(
        mockLobby
      );
      (mockPrisma.gameLobby.update as jest.Mock).mockResolvedValue({});

      await lobbyModel.updateLobbyAuthorizedPlayers(
        "lobby-id",
        "new-user-id",
        "add"
      );

      expect(mockPrisma.gameLobby.update).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
        data: {
          authorizedPlayers: ["host-id", "new-user-id"],
        },
      });
    });

    it("devrait retirer un joueur autorisé", async () => {
      const mockLobby = {
        authorizedPlayers: ["host-id", "user-to-remove"],
      };

      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(
        mockLobby
      );
      (mockPrisma.gameLobby.update as jest.Mock).mockResolvedValue({});

      await lobbyModel.updateLobbyAuthorizedPlayers(
        "lobby-id",
        "user-to-remove",
        "remove"
      );

      expect(mockPrisma.gameLobby.update).toHaveBeenCalledWith({
        where: { id: "lobby-id" },
        data: {
          authorizedPlayers: ["host-id"],
        },
      });
    });

    it("devrait échouer si le lobby n'existe pas", async () => {
      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        lobbyModel.updateLobbyAuthorizedPlayers(
          "invalid-lobby-id",
          "user-id",
          "add"
        )
      ).rejects.toThrow("Lobby non trouvé");
    });

    it("ne devrait pas ajouter un joueur déjà présent", async () => {
      const mockLobby = {
        authorizedPlayers: ["host-id", "existing-user-id"],
      };

      (mockPrisma.gameLobby.findUnique as jest.Mock).mockResolvedValue(
        mockLobby
      );

      await lobbyModel.updateLobbyAuthorizedPlayers(
        "lobby-id",
        "existing-user-id",
        "add"
      );

      expect(mockPrisma.gameLobby.update).not.toHaveBeenCalled();
    });
  });
});

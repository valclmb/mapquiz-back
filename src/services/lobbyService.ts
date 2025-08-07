import * as LobbyModel from "../models/lobbyModel.js";
import * as UserModel from "../models/userModel.js";
import type { LobbySettings, PlayerRanking } from "../types/lobby.js";
import { sendToUser } from "../websocket/core/connectionManager.js";
import { LobbyLifecycleManager } from "../websocket/lobby/lobbyLifecycle.js";

/**
 * Service principal pour la gestion des lobbies
 * Contient toute la logique métier (base de données, validation)
 */
export class LobbyService {
  /**
   * Crée un nouveau lobby en base de données
   */
  static async createLobby(
    hostId: string,
    name: string,
    settings: LobbySettings = {}
  ): Promise<{
    success: boolean;
    lobbyId: string;
    hostId: string;
    settings: LobbySettings;
    lobby?: unknown;
    players?: unknown[];
    message?: string;
  }> {
    try {
      console.log(`🔍 Vérification de l'utilisateur: ${hostId}`);

      // Vérifier que l'utilisateur existe
      const user = await UserModel.findUserById(hostId);
      if (!user) {
        console.log(`❌ Utilisateur non trouvé: ${hostId}`);
        return {
          success: false,
          lobbyId: "",
          hostId: "",
          settings: {},
          message: "Utilisateur non trouvé",
        };
      }

      console.log(`✅ Utilisateur trouvé: ${user.name}`);

      // Créer le lobby en base de données
      const lobby = await LobbyModel.createLobby(
        hostId,
        name || `Lobby de ${user.name || hostId}`,
        settings
      );

      console.log(`✅ Lobby créé en base de données: ${lobby.id}`);

      return {
        success: true,
        lobbyId: lobby.id,
        hostId: hostId,
        settings: settings,
        lobby: lobby,
        players: [
          {
            id: hostId,
            name: user.name || "User",
            status: "joined",
          },
        ],
      };
    } catch (error) {
      console.error("❌ Erreur lors de la création du lobby:", error);
      return {
        success: false,
        lobbyId: "",
        hostId: "",
        settings: {},
        message: error instanceof Error ? error.message : "Erreur inconnue",
      };
    }
  }

  /**
   * Démarre une partie (mise à jour en base de données)
   */
  static async startGame(lobbyId: string): Promise<boolean> {
    try {
      // Mettre à jour le statut du lobby en base de données
      await LobbyModel.updateLobbyStatus(lobbyId, "playing");

      // Mettre à jour le statut de tous les joueurs en base de données
      const lobby = await LobbyModel.getLobby(lobbyId);
      if (lobby && lobby.players) {
        for (const player of lobby.players) {
          await LobbyModel.updatePlayerStatus(
            lobbyId,
            player.userId,
            "playing"
          );
        }
      }

      return true;
    } catch (error) {
      console.error("Erreur lors du démarrage du jeu:", error);
      return false;
    }
  }

  /**
   * Met à jour le score d'un joueur en base de données
   */
  static async updatePlayerScore(
    lobbyId: string,
    playerId: string,
    score: number,
    progress: number,
    validatedCountries: string[],
    incorrectCountries: string[]
  ): Promise<boolean> {
    try {
      await LobbyModel.updatePlayerGameData(
        lobbyId,
        playerId,
        score,
        progress,
        validatedCountries,
        incorrectCountries
      );
      return true;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du score:", error);
      return false;
    }
  }

  /**
   * Met à jour la progression d'un joueur en base de données
   */
  static async updatePlayerProgress(
    lobbyId: string,
    playerId: string,
    validatedCountries: string[],
    incorrectCountries: string[],
    score: number,
    totalQuestions: number
  ): Promise<boolean> {
    try {
      const progress =
        totalQuestions > 0
          ? ((validatedCountries.length + incorrectCountries.length) /
              totalQuestions) *
            100
          : 0;

      await LobbyModel.updatePlayerGameData(
        lobbyId,
        playerId,
        score,
        Math.min(progress, 100),
        validatedCountries,
        incorrectCountries
      );
      return true;
    } catch (error) {
      console.error("Erreur lors de la mise à jour de la progression:", error);
      return false;
    }
  }

  /**
   * Met à jour le statut d'un joueur en base de données
   */
  static async updatePlayerStatus(
    lobbyId: string,
    playerId: string,
    status: string
  ): Promise<boolean> {
    try {
      await LobbyModel.updatePlayerStatus(lobbyId, playerId, status);
      return true;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut:", error);
      return false;
    }
  }

  /**
   * Met à jour le statut du lobby en base de données
   */
  static async updateLobbyStatus(
    lobbyId: string,
    status: string
  ): Promise<boolean> {
    try {
      await LobbyModel.updateLobbyStatus(lobbyId, status);
      return true;
    } catch (error) {
      console.error("Erreur lors de la mise à jour du statut du lobby:", error);
      return false;
    }
  }

  /**
   * Sauvegarde l'état du jeu en base de données
   */
  static async saveGameState(
    lobbyId: string,
    gameState: Record<string, unknown>
  ): Promise<boolean> {
    try {
      await LobbyModel.saveGameState(lobbyId, gameState);
      return true;
    } catch (error) {
      console.error("Erreur lors de la sauvegarde de l'état du jeu:", error);
      return false;
    }
  }

  /**
   * Vérifie si tous les joueurs sont prêts
   */
  static async areAllPlayersReady(
    lobbyId: string,
    hostId: string
  ): Promise<boolean> {
    try {
      return await LobbyModel.areAllPlayersReady(lobbyId, hostId);
    } catch (error) {
      console.error("Erreur lors de la vérification des joueurs prêts:", error);
      return false;
    }
  }

  /**
   * Récupère un lobby depuis la base de données
   */
  static async getLobby(lobbyId: string) {
    return await LobbyModel.getLobby(lobbyId);
  }

  /**
   * Supprime un lobby de la base de données
   */
  static async deleteLobby(lobbyId: string): Promise<boolean> {
    try {
      await LobbyModel.deleteLobby(lobbyId);
      return true;
    } catch (error) {
      console.error("Erreur lors de la suppression du lobby:", error);
      return false;
    }
  }

  /**
   * Récupère les résultats d'une partie terminée
   */
  static async getGameResults(lobbyId: string, userId: string) {
    try {
      // Vérifier que le joueur est dans le lobby
      const player = await LobbyModel.getPlayerInLobby(lobbyId, userId);
      if (!player) {
        throw new Error("Vous n'êtes pas dans ce lobby");
      }

      // Récupérer le lobby
      const lobby = await LobbyModel.getLobby(lobbyId);
      if (!lobby) {
        throw new Error("Lobby non trouvé");
      }

      // Vérifier que la partie est terminée
      if (lobby.status !== "finished") {
        throw new Error("La partie n'est pas encore terminée");
      }

      // Récupérer tous les joueurs avec leurs scores
      const players = lobby.players;

      // Créer le classement
      const rankings: PlayerRanking[] = players
        .map((player) => ({
          id: player.userId,
          name: player.user.name,
          score: player.score || 0,
          rank: 0, // Sera calculé ci-dessous
        }))
        .sort((a: PlayerRanking, b: PlayerRanking) => b.score - a.score); // Tri par score décroissant

      // Assigner les rangs
      rankings.forEach((player: PlayerRanking, index: number) => {
        player.rank = index + 1;
      });

      return {
        rankings,
        hostId: lobby.hostId,
      };
    } catch (error) {
      console.error("Erreur lors de la récupération des résultats:", error);
      throw error;
    }
  }

  /**
   * Met à jour les paramètres d'un lobby
   */
  static async updateLobbySettings(
    userId: string,
    lobbyId: string,
    settings: LobbySettings
  ): Promise<boolean> {
    try {
      // Vérifier que l'utilisateur est bien l'hôte du lobby
      const lobby = await LobbyModel.getLobby(lobbyId);
      if (!lobby || lobby.hostId !== userId) {
        throw new Error("Non autorisé à modifier les paramètres de ce lobby");
      }

      // Mettre à jour les paramètres du lobby dans la base de données
      await LobbyModel.updateLobbySettings(lobbyId, settings);

      // Mettre à jour le lobby en mémoire
      const lobbyInMemory = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      if (lobbyInMemory) {
        lobbyInMemory.settings = settings;
      }

      return true;
    } catch (error) {
      console.error(
        "Erreur lors de la mise à jour des paramètres du lobby:",
        error
      );
      return false;
    }
  }

  /**
   * Invite un ami dans un lobby
   */
  static async inviteToLobby(
    hostId: string,
    lobbyId: string,
    friendId: string
  ) {
    // Vérifier que l'utilisateur est bien l'hôte du lobby
    const lobby = await LobbyModel.getLobby(lobbyId);
    if (!lobby || lobby.hostId !== hostId) {
      throw new Error("Non autorisé à inviter des joueurs dans ce lobby");
    }

    // Vérifier si le joueur est déjà dans le lobby
    const existingPlayer = await LobbyModel.getPlayerInLobby(lobbyId, friendId);

    // Si le joueur est déjà dans le lobby, ne pas renvoyer d'invitation
    if (existingPlayer) {
      return { success: true, message: "Joueur déjà dans le lobby" };
    }

    // Ajouter l'utilisateur à la liste des joueurs autorisés
    await LobbyModel.addAuthorizedPlayer(lobbyId, friendId);

    // Envoyer une notification à l'ami
    sendToUser(friendId, {
      type: "lobby_invitation",
      payload: {
        lobbyId,
        hostId,
        hostName: lobby.host.name,
        lobbyName: lobby.name,
      },
    });

    return { success: true, message: "Invitation envoyée" };
  }

  /**
   * Ajoute un joueur à un lobby
   */
  static async addPlayerToLobby(
    lobbyId: string,
    userId: string,
    status: string = "joined"
  ): Promise<boolean> {
    try {
      await LobbyModel.addPlayerToLobby(lobbyId, userId);
      return true;
    } catch (error) {
      console.error("Erreur lors de l'ajout du joueur au lobby:", error);
      return false;
    }
  }
}

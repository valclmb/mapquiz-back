import { prisma } from "../../lib/database.js";
import { sendToUser } from "../core/connectionManager.js";
import { LobbyLifecycleManager } from "./lobbyLifecycle.js";

/**
 * Gestionnaire de diffusion des messages WebSocket
 */
export class BroadcastManager {
  /**
   * Diffuse une mise à jour du lobby à tous les joueurs
   */
  static async broadcastLobbyUpdate(
    lobbyId: string,
    lobbyData: any
  ): Promise<void> {
    // Récupérer tous les joueurs du lobby depuis la base de données
    const allLobbyPlayers = await prisma.lobbyPlayer.findMany({
      where: { lobbyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Fusionner les données de la base avec celles en mémoire
    const allPlayers = allLobbyPlayers.map((player: any) => {
      const memoryPlayer = lobbyData.players.get(player.user.id);
      return {
        id: player.user.id,
        name: player.user.name,
        status: memoryPlayer ? memoryPlayer.status : player.status,
        // Priorité aux données de la base de données pour la progression
        score: player.score || 0,
        progress: player.progress || 0,
        validatedCountries: player.validatedCountries || [],
        incorrectCountries: player.incorrectCountries || [],
      };
    });

    const message = {
      type: "lobby_update",
      payload: {
        lobbyId,
        players: allPlayers,
        hostId: lobbyData.hostId,
        settings: lobbyData.settings,
        status: lobbyData.status || "waiting",
      },
    };

    // Diffuser à tous les joueurs du lobby
    for (const player of allLobbyPlayers) {
      sendToUser(player.user.id, message);
    }
  }

  /**
   * Diffuse le début d'une partie à tous les joueurs
   */
  static broadcastGameStart(lobbyId: string, lobbyData: any): void {
    const { countries, ...gameStateWithoutCountries } =
      lobbyData.gameState || {};

    const message = {
      type: "game_start",
      data: {
        lobbyId,
        startTime: lobbyData.gameState?.startTime || new Date().toISOString(),
        totalQuestions: lobbyData.settings?.totalQuestions || 10, // Valeur par défaut
        settings: lobbyData.gameState?.settings || lobbyData.settings || {},
        gameState: gameStateWithoutCountries,
      },
    };

    for (const [playerId] of lobbyData.players) {
      sendToUser(playerId, message);
    }
  }

  /**
   * Diffuse une mise à jour de progression des joueurs
   */
  static async broadcastPlayerProgressUpdate(
    lobbyId: string,
    lobbyData: any
  ): Promise<void> {
    // Récupérer tous les joueurs du lobby depuis la base de données pour avoir les noms
    const allLobbyPlayers = await prisma.lobbyPlayer.findMany({
      where: { lobbyId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    // Fusionner les données de la base avec celles en mémoire
    const players = allLobbyPlayers.map((player: any) => {
      const memoryPlayer = lobbyData.players.get(player.user.id);
      return {
        id: player.user.id,
        name: player.user.name, // Utiliser le nom depuis la base de données
        score: memoryPlayer ? memoryPlayer.score : player.score || 0,
        progress: memoryPlayer ? memoryPlayer.progress : player.progress || 0,
        validatedCountries: memoryPlayer
          ? memoryPlayer.validatedCountries || []
          : player.validatedCountries || [],
        incorrectCountries: memoryPlayer
          ? memoryPlayer.incorrectCountries || []
          : player.incorrectCountries || [],
      };
    });

    const message = {
      type: "update_player_progress",
      payload: {
        lobbyId,
        players,
      },
    };

    for (const [playerId] of lobbyData.players) {
      sendToUser(playerId, message);
    }
  }

  /**
   * Diffuse la fin de partie à tous les joueurs
   */
  static broadcastGameEnd(lobbyId: string): void {
    const message = {
      type: "game_end",
      payload: {
        lobbyId,
      },
    };

    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (lobby) {
      for (const [playerId] of lobby.players) {
        sendToUser(playerId, message);
      }
    }
  }

  /**
   * Diffuse une mise à jour de score à tous les joueurs
   */
  static broadcastScoreUpdate(
    lobbyId: string,
    lobbyData: any,
    updatedPlayerId: string
  ): void {
    const players = Array.from(lobbyData.players.entries()).map(
      (entry: any) => {
        const [id, data] = entry;
        return {
          id,
          name: data.name,
          score: data.score,
          progress: data.progress,
        };
      }
    );

    const message = {
      type: "update_player_progress",
      payload: {
        lobbyId,
        players,
        updatedPlayerId,
      },
    };

    for (const [playerId] of lobbyData.players) {
      sendToUser(playerId, message);
    }
  }

  /**
   * Diffuse qu'un joueur a quitté la partie
   */
  static broadcastPlayerLeftGame(
    lobbyId: string,
    playerId: string,
    playerName: string
  ): void {
    const message = {
      type: "player_left_game",
      payload: {
        lobbyId,
        playerId,
        playerName,
        timestamp: Date.now(),
      },
    };

    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (lobby) {
      for (const [remainingPlayerId] of lobby.players) {
        if (remainingPlayerId !== playerId) {
          sendToUser(remainingPlayerId, message);
        }
      }
    }
  }
}

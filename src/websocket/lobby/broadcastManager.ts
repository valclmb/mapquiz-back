import { sendToUser } from "../core/connectionManager.js";
import { getLobbyInMemory } from "./lobbyManager.js";

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
    console.log("BroadcastManager.broadcastLobbyUpdate - lobbyData:", {
      lobbyId,
      status: lobbyData.status,
      hostId: lobbyData.hostId,
      playersCount: lobbyData.players.size,
    });

    // Récupérer tous les joueurs du lobby depuis la base de données pour avoir les données les plus récentes
    const { prisma } = await import("../../lib/database.js");
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

    console.log("🔍 broadcastLobbyUpdate - Données DB vs Mémoire:", {
      dbPlayers: allLobbyPlayers.map((p: any) => ({
        id: p.user.id,
        status: p.status,
      })),
      memoryPlayers: Array.from(lobbyData.players.entries()).map(
        (entry: any) => ({ id: entry[0], status: entry[1].status })
      ),
    });

    // Dans broadcastLobbyUpdate, simplifie la récupération des joueurs :
    const allPlayers = allLobbyPlayers.map((player: any) => {
      const memoryPlayer = lobbyData.players.get(player.user.id);
      return {
        id: player.user.id,
        name: player.user.name,
        status: memoryPlayer ? memoryPlayer.status : player.status,
        score: memoryPlayer ? memoryPlayer.score : player.score || 0,
        progress: memoryPlayer ? memoryPlayer.progress : player.progress || 0,
        validatedCountries: memoryPlayer
          ? memoryPlayer.validatedCountries
          : player.validatedCountries || [],
        incorrectCountries: memoryPlayer
          ? memoryPlayer.incorrectCountries
          : player.incorrectCountries || [],
        // isDisconnected, leftLobbyAt, presenceStatus supprimés
      };
    });

    try {
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

      console.log("BroadcastManager.broadcastLobbyUpdate - message envoyé:", {
        type: message.type,
        payload: message.payload,
        playersCount: allPlayers.length,
      });

      // Diffuser à tous les joueurs du lobby
      for (const player of allLobbyPlayers) {
        sendToUser(player.user.id, message);
      }
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des joueurs déconnectés:",
        error
      );

      // En cas d'erreur, envoyer seulement les joueurs actifs
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

      for (const [playerId] of lobbyData.players) {
        sendToUser(playerId, message);
      }
    }
  }

  /**
   * Diffuse le début d'une partie à tous les joueurs
   */
  static broadcastGameStart(lobbyId: string, lobbyData: any): void {
    console.log("BroadcastManager.broadcastGameStart - lobbyData:", {
      lobbyId,
      gameState: lobbyData.gameState,
      countriesCount: lobbyData.gameState?.countries?.length,
      settings: lobbyData.gameState?.settings,
    });

    // On retire countries de gameState avant d'envoyer
    const { countries, ...gameStateWithoutCountries } =
      lobbyData.gameState || {};

    const message = {
      type: "game_start",
      data: {
        lobbyId,
        startTime: lobbyData.gameState.startTime,
        totalQuestions: lobbyData.settings.totalQuestions,
        settings: lobbyData.gameState.settings,
        gameState: gameStateWithoutCountries, // n’envoie plus les pays
      },
    };

    console.log("BroadcastManager.broadcastGameStart - message envoyé:", {
      type: message.type,
      dataKeys: Object.keys(message.data),
      gameStateKeys: Object.keys(message.data.gameState || {}),
      countriesCount: message.data.gameState?.countries?.length,
    });

    for (const [playerId] of lobbyData.players) {
      sendToUser(playerId, message);
    }
  }

  /**
   * Diffuse une mise à jour de progression des joueurs
   */
  static broadcastPlayerProgressUpdate(lobbyId: string, lobbyData: any): void {
    const players = Array.from(lobbyData.players.entries()).map(
      (entry: any) => {
        const [id, data] = entry;
        return {
          id,
          name: data.name,
          // Suppression du statut pendant le jeu - pas besoin de l'afficher
          // status: data.status,
          score: data.score,
          progress: data.progress,
          validatedCountries: data.validatedCountries || [],
          incorrectCountries: data.incorrectCountries || [],
        };
      }
    );

    console.log(`🔍 broadcastPlayerProgressUpdate - Données diffusées:`, {
      lobbyId,
      players: players.map((p) => ({
        id: p.id,
        name: p.name,
        // Suppression du statut pendant le jeu - pas besoin de l'afficher
        // status: p.status,
        score: p.score,
        progress: p.progress,
      })),
    });

    const message = {
      type: "player_progress_update",
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
   * Diffuse les résultats finaux du jeu
   */
  static broadcastGameResults(lobbyId: string, rankings: any[]): void {
    const message = {
      type: "game_results",
      payload: {
        lobbyId,
        rankings,
      },
    };

    // Envoyer à tous les joueurs du lobby
    const lobby = getLobbyInMemory(lobbyId);
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
          // Suppression du statut pendant le jeu - pas besoin de l'afficher
          // status: data.status,
        };
      }
    );

    const message = {
      type: "score_update",
      data: {
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
   * Diffuse la fin de partie avec les classements
   */
  static broadcastGameEnd(lobbyId: string, rankings: any[]): void {
    const message = {
      type: "game_end",
      data: {
        lobbyId,
        rankings,
        endTime: Date.now(),
      },
    };

    // Envoyer à tous les joueurs qui étaient dans le lobby
    for (const ranking of rankings) {
      sendToUser(ranking.id, message);
    }
  }

  /**
   * Envoie un message spécifique à un joueur
   */
  static sendToPlayer(playerId: string, message: any): boolean {
    return sendToUser(playerId, message);
  }

  /**
   * Envoie un message d'erreur à un joueur
   */
  static sendErrorToPlayer(playerId: string, errorMessage: string): boolean {
    return sendToUser(playerId, {
      type: "error",
      message: errorMessage,
    });
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

    // Envoyer à tous les joueurs restants dans le lobby
    const lobby = getLobbyInMemory(lobbyId);
    if (lobby) {
      for (const [remainingPlayerId] of lobby.players) {
        if (remainingPlayerId !== playerId) {
          sendToUser(remainingPlayerId, message);
        }
      }
    }
  }
}

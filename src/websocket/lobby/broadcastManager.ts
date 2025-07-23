import { sendToUser } from "../core/connectionManager.js";
import { getLobbyInMemory } from "./lobbyManager.js";

/**
 * Gestionnaire de diffusion des messages WebSocket
 */
export class BroadcastManager {
  /**
   * Diffuse une mise à jour du lobby à tous les joueurs
   */
  static broadcastLobbyUpdate(lobbyId: string, lobbyData: any): void {
    console.log("BroadcastManager.broadcastLobbyUpdate - lobbyData:", {
      lobbyId,
      status: lobbyData.status,
      hostId: lobbyData.hostId,
      playersCount: lobbyData.players.size,
    });

    const players = Array.from(lobbyData.players.entries()).map(
      (entry: any) => {
        const [id, data] = entry;
        return {
          id,
          name: data.name,
          status: data.status,
          score: data.score || 0,
          progress: data.progress || 0,
          validatedCountries: data.validatedCountries || [],
          incorrectCountries: data.incorrectCountries || [],
        };
      }
    );

    const message = {
      type: "lobby_update",
      payload: {
        lobbyId,
        players,
        hostId: lobbyData.hostId,
        settings: lobbyData.settings,
        status: lobbyData.status || "waiting", // Fallback si status est undefined
      },
    };

    console.log("BroadcastManager.broadcastLobbyUpdate - message envoyé:", {
      type: message.type,
      payload: message.payload,
    });

    for (const [playerId] of lobbyData.players) {
      sendToUser(playerId, message);
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

    const message = {
      type: "game_start",
      data: {
        lobbyId,
        startTime: lobbyData.gameState.startTime,
        totalQuestions: lobbyData.settings.totalQuestions,
        settings: lobbyData.gameState.settings,
        gameState: lobbyData.gameState, // Ajouter l'état complet du jeu
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
          status: data.status,
          score: data.score,
          progress: data.progress,
          validatedCountries: data.validatedCountries || [],
          incorrectCountries: data.incorrectCountries || [],
        };
      }
    );

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
          status: data.status,
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

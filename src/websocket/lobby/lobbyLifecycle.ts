import * as LobbyModel from "../../models/lobbyModel.js";
import { PlayerService } from "../../services/playerService.js";

// Map des lobbies actifs : lobbyId -> {players, gameState}
const activeLobbies = new Map();

// Map pour stocker les timers de suppression différée
const lobbyDeletionTimers = new Map<string, NodeJS.Timeout>();

/**
 * Gestionnaire du cycle de vie des lobbies
 */
export class LobbyLifecycleManager {
  /**
   * Programme la suppression différée d'un lobby
   */
  static scheduleLobbyDeletion(
    lobbyId: string,
    delayMs: number = 3 * 60 * 1000
  ): void {
    if (lobbyDeletionTimers.has(lobbyId)) return;

    const timer = setTimeout(async () => {
      try {
        await LobbyModel.deleteLobby(lobbyId);
        activeLobbies.delete(lobbyId);
        console.log(
          `Lobby ${lobbyId} supprimé après 3 minutes d'inactivité (vide)`
        );
      } catch (e) {
        console.error(
          `Erreur lors de la suppression différée du lobby ${lobbyId}:`,
          e
        );
      }
      lobbyDeletionTimers.delete(lobbyId);
    }, delayMs);

    lobbyDeletionTimers.set(lobbyId, timer);
  }

  /**
   * Annule la suppression différée d'un lobby
   */
  static cancelLobbyDeletion(lobbyId: string): void {
    const timer = lobbyDeletionTimers.get(lobbyId);
    if (timer) {
      clearTimeout(timer);
      lobbyDeletionTimers.delete(lobbyId);
      console.log(`Suppression différée annulée pour le lobby ${lobbyId}`);
    }
  }

  /**
   * Crée un nouveau lobby en mémoire
   */
  static createLobby(
    lobbyId: string,
    hostId: string,
    hostName: string,
    settings: any
  ): { lobbyId: string; hostId: string; settings: any } {
    console.log(
      `Création du lobby ${lobbyId} en mémoire avec l'hôte ${hostId}`
    );

    activeLobbies.set(lobbyId, {
      players: new Map([[hostId, PlayerService.createPlayer(hostName)]]),
      hostId: hostId,
      settings,
      status: "waiting",
      gameState: null,
    });

    return { lobbyId, hostId, settings };
  }

  /**
   * Supprime un lobby de la mémoire
   */
  static removeLobby(lobbyId: string): void {
    console.log(`Suppression du lobby ${lobbyId} de la mémoire`);
    activeLobbies.delete(lobbyId);
  }

  /**
   * Restaure un lobby depuis la base de données
   */
  static restoreLobbyFromDatabase(lobbyId: string, lobbyData: any): void {
    // Convertir les données de la base en format Map
    const players = new Map();
    if (lobbyData.players && Array.isArray(lobbyData.players)) {
      lobbyData.players.forEach((player: any) => {
        players.set(player.userId, {
          status: player.status,
          score: player.score || 0,
          progress: player.progress || 0,
          name: player.user.name,
          validatedCountries: player.validatedCountries || [],
          incorrectCountries: player.incorrectCountries || [],
        });
      });
    }

    activeLobbies.set(lobbyId, {
      players,
      hostId: lobbyData.hostId,
      settings: lobbyData.settings,
      status: lobbyData.status,
      gameState: lobbyData.gameState,
    });

    console.log(`Lobby ${lobbyId} restauré depuis la base de données`);
  }

  /**
   * Récupère un lobby en mémoire
   */
  static getLobbyInMemory(lobbyId: string): any {
    const lobby = activeLobbies.get(lobbyId);
    if (!lobby) {
      console.log(
        `Lobby ${lobbyId} non trouvé en mémoire. Lobbies actifs:`,
        Array.from(activeLobbies.keys())
      );
    }
    return lobby || null;
  }

  /**
   * Récupère tous les lobbies actifs
   */
  static getAllActiveLobbies(): Map<string, any> {
    return activeLobbies;
  }
}

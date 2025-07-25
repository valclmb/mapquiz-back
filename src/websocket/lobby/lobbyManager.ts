import * as LobbyModel from "../../models/lobbyModel.js";
import { BroadcastManager } from "./broadcastManager.js";
import { GameManager } from "./gameManager.js";
import { LobbyLifecycleManager } from "./lobbyLifecycle.js";
import { PlayerManager } from "./playerManager.js";

/**
 * Gestionnaire principal des lobbies - Coordinateur des autres gestionnaires
 */
export class LobbyManager {
  /**
   * Crée un nouveau lobby
   */
  static createLobby(
    lobbyId: string,
    hostId: string,
    hostName: string,
    settings: any
  ): { lobbyId: string; hostId: string; settings: any } {
    return LobbyLifecycleManager.createLobby(
      lobbyId,
      hostId,
      hostName,
      settings
    );
  }

  /**
   * Ajoute un joueur au lobby
   */
  static async addPlayerToLobby(
    lobbyId: string,
    playerId: string,
    playerName: string
  ): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) return false;

    // Si le lobby était vide et en attente de suppression, on annule le timer
    if (lobby.players.size === 0) {
      LobbyLifecycleManager.cancelLobbyDeletion(lobbyId);
    }

    lobby.players.set(playerId, PlayerManager.createPlayer(playerName));
    return true;
  }

  /**
   * Met à jour le statut d'un joueur
   */
  static async updatePlayerStatus(
    lobbyId: string,
    playerId: string,
    status: string
  ): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      console.log(`Lobby ${lobbyId} non trouvé en mémoire`);
      return false;
    }

    if (!lobby.players.has(playerId)) {
      console.log(
        `Joueur ${playerId} non trouvé dans le lobby ${lobbyId} en mémoire. Joueurs présents:`,
        Array.from(lobby.players.keys())
      );
      return false;
    }

    const playerData = lobby.players.get(playerId);
    lobby.players.set(
      playerId,
      PlayerManager.updatePlayerStatus(playerData, status)
    );

    // Sauvegarder le statut en base de données
    try {
      await LobbyModel.updatePlayerStatus(lobbyId, playerId, status);
      console.log(`Statut sauvegardé en DB pour ${playerId}: ${status}`);
    } catch (error) {
      console.error(
        `Erreur lors de la sauvegarde du statut en DB pour ${playerId}:`,
        error
      );
    }

    // Toujours diffuser la mise à jour du lobby
    await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

    // Si le statut est "ready", vérifier si tous les joueurs sont prêts
    if (status === "ready") {
      (async () => {
        try {
          console.log(
            `Vérification si tous les joueurs sont prêts pour le lobby ${lobbyId} (${
              lobby.players.size
            } joueur${lobby.players.size > 1 ? "s" : ""})`
          );

          const allReady = await LobbyModel.areAllPlayersReady(
            lobbyId,
            lobby.hostId
          );

          console.log(`Tous les joueurs sont prêts: ${allReady}`);

          if (allReady) {
            console.log(
              `Démarrage automatique de la partie pour le lobby ${lobbyId}`
            );
            await GameManager.startGame(lobbyId);
          }
        } catch (error) {
          console.error(
            `Erreur lors de la vérification des joueurs prêts:`,
            error
          );
        }
      })();
    }

    return true;
  }

  /**
   * Démarre une partie
   */
  static async startGame(lobbyId: string): Promise<boolean> {
    return GameManager.startGame(lobbyId);
  }

  /**
   * Met à jour le score d'un joueur
   */
  static async updatePlayerScore(
    lobbyId: string,
    playerId: string,
    score: number,
    progress: number,
    answerTime?: number,
    isConsecutiveCorrect?: boolean
  ): Promise<boolean> {
    return GameManager.updatePlayerScore(
      lobbyId,
      playerId,
      score,
      progress,
      answerTime,
      isConsecutiveCorrect
    );
  }

  /**
   * Met à jour la progression détaillée du joueur
   */
  static async updatePlayerProgress(
    lobbyId: string,
    playerId: string,
    validatedCountries: string[],
    incorrectCountries: string[],
    score: number,
    totalQuestions: number
  ): Promise<boolean> {
    return GameManager.updatePlayerProgress(
      lobbyId,
      playerId,
      validatedCountries,
      incorrectCountries,
      score,
      totalQuestions
    );
  }

  /**
   * Supprime un lobby
   */
  static removeLobby(lobbyId: string): void {
    LobbyLifecycleManager.removeLobby(lobbyId);
  }

  /**
   * Supprime un joueur du lobby
   */
  static async removePlayerFromLobby(
    lobbyId: string,
    playerId: string
  ): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) return false;

    lobby.players.delete(playerId);

    // Si plus de joueurs, supprimer le lobby
    if (lobby.players.size === 0) {
      LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId);
    } else {
      // Si l'hôte part, transférer l'hôte au premier joueur restant
      if (playerId === lobby.hostId) {
        const firstPlayer = lobby.players.keys().next().value;
        lobby.hostId = firstPlayer;
      }
      await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
    }

    return true;
  }

  /**
   * Retire un joueur déconnecté du lobby (sans supprimer le lobby)
   */
  static async removeDisconnectedPlayerFromLobby(
    lobbyId: string,
    playerId: string
  ): Promise<boolean> {
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) return false;

    lobby.players.delete(playerId);

    // Ne pas supprimer le lobby même s'il n'y a plus de joueurs en mémoire
    // Le lobby reste actif pour permettre aux joueurs de revenir
    await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

    return true;
  }

  /**
   * Récupère un lobby en mémoire
   */
  static getLobbyInMemory(lobbyId: string): any {
    return LobbyLifecycleManager.getLobbyInMemory(lobbyId);
  }

  /**
   * Récupère l'état du jeu
   */
  static getGameState(lobbyId: string, userId: string): any {
    console.log(
      `LobbyManager.getGameState - Début pour lobbyId: ${lobbyId}, userId: ${userId}`
    );

    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (!lobby) {
      console.log(
        `LobbyManager.getGameState - Lobby ${lobbyId} non trouvé en mémoire`
      );
      return null;
    }

    console.log(
      `LobbyManager.getGameState - Lobby trouvé, statut: ${lobby.status}`
    );

    // Vérifier que l'utilisateur est dans le lobby
    if (!lobby.players.has(userId)) {
      console.log(
        `LobbyManager.getGameState - Utilisateur ${userId} non trouvé dans le lobby`
      );
      return null;
    }

    const players = Array.from(lobby.players.entries()).map((entry: any) => {
      const [id, data] = entry;
      return {
        id,
        name: data.name,
        status: data.status,
        score: data.score,
        progress: data.progress,
        validatedCountries: data.validatedCountries,
        incorrectCountries: data.incorrectCountries,
      };
    });

    return {
      lobbyId,
      status: String(lobby.status),
      hostId: lobby.hostId,
      settings: lobby.settings,
      players,
      startTime: lobby.gameState?.startTime,
    };
  }

  /**
   * Restaure un lobby depuis la base de données
   */
  static restoreLobbyFromDatabase(lobbyId: string, lobbyData: any): void {
    LobbyLifecycleManager.restoreLobbyFromDatabase(lobbyId, lobbyData);
  }

  /**
   * Redémarre un lobby
   */
  static async restartLobby(lobbyId: string): Promise<boolean> {
    return GameManager.restartLobby(lobbyId);
  }
}

// Exports pour compatibilité avec l'ancien code
export const createLobby = LobbyManager.createLobby;
export const addPlayerToLobby = LobbyManager.addPlayerToLobby;
export const updatePlayerStatus = LobbyManager.updatePlayerStatus;
export const startGame = LobbyManager.startGame;
export const updatePlayerScore = LobbyManager.updatePlayerScore;
export const updatePlayerProgress = LobbyManager.updatePlayerProgress;
export const removeLobby = LobbyManager.removeLobby;
export const removePlayerFromLobby = LobbyManager.removePlayerFromLobby;
export const removeDisconnectedPlayerFromLobby =
  LobbyManager.removeDisconnectedPlayerFromLobby;
export const getLobbyInMemory = LobbyManager.getLobbyInMemory;
export const getGameState = LobbyManager.getGameState;
export const restoreLobbyFromDatabase = LobbyManager.restoreLobbyFromDatabase;
export const restartLobby = LobbyManager.restartLobby;

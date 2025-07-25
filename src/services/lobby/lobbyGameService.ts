import { APP_CONSTANTS } from "../../lib/config.js";
import { LobbyError } from "../../lib/errors.js";
import {
  validateGameProgressRequest,
  validateLobbyId,
  validatePlayerProgressRequest,
} from "../../lib/validation.js";
import * as LobbyModel from "../../models/lobbyModel.js";
import * as UserModel from "../../models/userModel.js";
import { BroadcastManager } from "../../websocket/lobby/broadcastManager.js";
import * as LobbyManager from "../../websocket/lobby/lobbyManager.js";
import { LobbyPlayerService } from "./lobbyPlayerService.js";

/**
 * Service dédié à la gestion du jeu dans les lobbies
 */
export class LobbyGameService {
  /**
   * Démarre une partie
   */
  static async startGame(userId: string, lobbyId: string) {
    console.log(
      `LobbyGameService.startGame - Début pour userId: ${userId}, lobbyId: ${lobbyId}`
    );

    // Vérifier que l'utilisateur est bien l'hôte du lobby
    const lobby = await LobbyModel.getLobby(lobbyId);
    console.log(`LobbyGameService.startGame - Lobby récupéré:`, {
      lobbyId: lobby?.id,
      hostId: lobby?.hostId,
      status: lobby?.status,
      playersCount: lobby?.players?.length,
    });

    if (!lobby || lobby.hostId !== userId) {
      console.log(
        `LobbyGameService.startGame - Erreur: utilisateur ${userId} n'est pas l'hôte du lobby ${lobbyId}`
      );
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    // S'assurer que l'hôte est marqué comme prêt en base de données
    console.log(
      `LobbyGameService.startGame - Mise à jour du statut de l'hôte en BDD`
    );
    await LobbyModel.updatePlayerStatus(
      lobbyId,
      userId,
      APP_CONSTANTS.PLAYER_STATUS.READY
    );

    // Vérifier qu'il y a au moins 1 joueur (permettre les parties solo)
    const players = await LobbyPlayerService.getLobbyPlayers(lobbyId);
    console.log(
      `LobbyGameService.startGame - Nombre de joueurs: ${players.length}`
    );

    if (players.length < 1) {
      console.log(
        `LobbyGameService.startGame - Erreur: il faut au moins 1 joueur pour démarrer`
      );
      throw new LobbyError(
        "Il faut au moins 1 joueur pour démarrer une partie"
      );
    }

    // Vérifier que tous les joueurs sont prêts
    console.log(
      `LobbyGameService.startGame - Vérification que tous les joueurs sont prêts`
    );
    const allReady = await LobbyPlayerService.areAllPlayersReady(
      lobbyId,
      userId
    );
    console.log(
      `LobbyGameService.startGame - Tous les joueurs sont prêts: ${allReady}`
    );

    if (!allReady) {
      console.log(
        `LobbyGameService.startGame - Erreur: tous les joueurs ne sont pas prêts`
      );
      throw new LobbyError("Tous les joueurs ne sont pas prêts");
    }

    // Mettre à jour le statut du lobby dans la base de données
    console.log(
      `LobbyGameService.startGame - Mise à jour du statut du lobby en BDD`
    );
    await LobbyModel.updateLobbyStatus(
      lobbyId,
      APP_CONSTANTS.LOBBY_STATUS.PLAYING
    );

    // Démarrer la partie directement en mémoire (éviter la double exécution)
    console.log(
      `LobbyGameService.startGame - Démarrage de la partie en mémoire`
    );
    const success = await LobbyManager.startGame(lobbyId);
    console.log(
      `LobbyGameService.startGame - Résultat du démarrage: ${success}`
    );

    if (!success) {
      console.log(
        `LobbyGameService.startGame - Erreur: impossible de démarrer la partie`
      );
      throw new LobbyError("Impossible de démarrer la partie");
    }

    console.log(`LobbyGameService.startGame - Partie démarrée avec succès`);
    return { success: true, message: "Partie démarrée" };
  }

  /**
   * Met à jour la progression du jeu
   */
  static async updateGameProgress(
    userId: string,
    lobbyId: string,
    score: number,
    answerTime?: number,
    isConsecutiveCorrect?: boolean
  ) {
    // Valider les données d'entrée
    const validatedData = validateGameProgressRequest({
      score,
      progress: 0, // La progression sera calculée automatiquement
      answerTime,
      isConsecutiveCorrect,
    });

    try {
      // Vérifier que le joueur est bien dans le lobby
      await LobbyPlayerService.verifyPlayerInLobby(userId, lobbyId);

      // Récupérer le lobby pour obtenir les paramètres du jeu
      const lobby = await LobbyModel.getLobby(lobbyId);
      if (!lobby || !lobby.gameSettings) {
        throw new LobbyError("Paramètres de jeu non trouvés");
      }

      const gameSettings = lobby.gameSettings as any;
      const totalQuestions = gameSettings.totalQuestions || 0;

      // Calculer la progression basée sur le score
      const progress = totalQuestions > 0 ? (score / totalQuestions) * 100 : 0;

      // Mettre à jour le score et la progression en mémoire
      const updated = await LobbyManager.updatePlayerScore(
        lobbyId,
        userId,
        validatedData.score,
        progress,
        validatedData.answerTime,
        validatedData.isConsecutiveCorrect
      );

      if (!updated) {
        console.warn(
          `Impossible de mettre à jour le score pour le joueur ${userId} dans le lobby ${lobbyId}`
        );
        throw new LobbyError("Joueur non trouvé dans le lobby");
      }

      // Si le joueur a terminé, enregistrer son résultat
      if (progress >= 100) {
        await this.saveGameResult(lobbyId, userId, validatedData.score);
      }

      return { success: true };
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour du score pour le joueur ${userId} dans le lobby ${lobbyId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Met à jour la progression détaillée du joueur
   */
  static async updatePlayerProgress(
    userId: string,
    lobbyId: string,
    validatedCountries: string[],
    incorrectCountries: string[],
    score: number,
    totalQuestions: number
  ) {
    // Valider les données d'entrée
    const validatedData = validatePlayerProgressRequest({
      validatedCountries,
      incorrectCountries,
      score,
      progress: 0, // La progression sera calculée automatiquement
    });

    try {
      // Vérifier que le joueur est bien dans le lobby
      await LobbyPlayerService.verifyPlayerInLobby(userId, lobbyId);

      // Mettre à jour la progression détaillée en mémoire
      const updated = await LobbyManager.updatePlayerProgress(
        lobbyId,
        userId,
        validatedData.validatedCountries,
        validatedData.incorrectCountries,
        validatedData.score,
        totalQuestions
      );

      if (!updated) {
        console.warn(
          `Impossible de mettre à jour la progression pour le joueur ${userId} dans le lobby ${lobbyId}`
        );
        throw new LobbyError("Joueur non trouvé dans le lobby");
      }

      // La sauvegarde en base de données est maintenant gérée par LobbyManager.updatePlayerProgress

      return { success: true };
    } catch (error) {
      console.error(
        `Erreur lors de la mise à jour de la progression pour le joueur ${userId} dans le lobby ${lobbyId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Met à jour les paramètres du lobby
   */
  static async updateLobbySettings(
    userId: string,
    lobbyId: string,
    settings: any
  ) {
    // Vérifier que l'utilisateur est bien l'hôte du lobby
    const lobby = await LobbyModel.getLobby(lobbyId);
    if (!lobby || lobby.hostId !== userId) {
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    // Mettre à jour les paramètres du lobby dans la base de données
    await LobbyModel.updateLobbySettings(lobbyId, settings);

    // Mettre à jour le lobby en mémoire

    const lobbyInMemory = LobbyManager.getLobbyInMemory(lobbyId);
    if (lobbyInMemory) {
      lobbyInMemory.settings = settings;
    }

    return { success: true, message: "Paramètres mis à jour" };
  }

  /**
   * Enregistre le résultat d'une partie
   */
  private static async saveGameResult(
    lobbyId: string,
    userId: string,
    score: number
  ) {
    const lobby = await LobbyModel.getLobby(lobbyId);
    if (lobby && lobby.gameSettings && typeof lobby.gameSettings === "object") {
      const totalQuestions =
        "totalQuestions" in lobby.gameSettings
          ? (lobby.gameSettings.totalQuestions as number)
          : 0;

      await LobbyModel.saveGameResult(lobbyId, userId, score, totalQuestions);
    }
  }

  /**
   * Récupère l'état du jeu
   */
  static async getGameState(lobbyId: string, userId: string) {
    const validatedLobbyId = validateLobbyId(lobbyId);

    // D'abord essayer de récupérer depuis la mémoire
    let gameState = LobbyManager.getGameState(validatedLobbyId, userId);

    // Si pas trouvé en mémoire, essayer de le restaurer depuis la base de données
    if (!gameState) {
      console.log(
        `État du jeu non trouvé en mémoire pour le lobby ${lobbyId}, tentative de restauration depuis la DB`
      );
      gameState = await this.restoreGameStateFromDatabase(
        validatedLobbyId,
        userId
      );
    }

    if (!gameState) {
      console.log(`Aucun état de jeu trouvé pour le lobby ${lobbyId}`);
      return null;
    }

    return gameState;
  }

  /**
   * Récupère l'état du lobby (sans l'état du jeu complet)
   */
  static async getLobbyState(lobbyId: string, userId: string) {
    const validatedLobbyId = validateLobbyId(lobbyId);

    console.log(
      `LobbyGameService.getLobbyState - Début pour lobbyId: ${lobbyId}, userId: ${userId}`
    );

    try {
      // Récupérer le lobby depuis la base de données d'abord
      const lobby = await LobbyModel.getLobby(validatedLobbyId);
      if (!lobby) {
        console.log(
          `LobbyGameService.getLobbyState - Lobby ${lobbyId} non trouvé en base de données`
        );
        throw new LobbyError(APP_CONSTANTS.ERRORS.LOBBY_NOT_FOUND);
      }

      console.log(`LobbyGameService.getLobbyState - Lobby trouvé en BDD:`, {
        lobbyId: lobby.id,
        status: lobby.status,
        hostId: lobby.hostId,
        playersCount: lobby.players.length,
        authorizedPlayers: lobby.authorizedPlayers,
        players: lobby.players.map((p) => ({
          id: p.userId,
          name: p.user.name,
          status: p.status,
        })),
      });

      // Vérifier que l'utilisateur est dans le lobby
      const player = await LobbyModel.getPlayerInLobby(
        validatedLobbyId,
        userId
      );

      if (!player) {
        console.log(
          `LobbyGameService.getLobbyState - Utilisateur ${userId} non trouvé dans le lobby ${lobbyId}`
        );
        console.log(
          `LobbyGameService.getLobbyState - Joueurs dans le lobby:`,
          lobby.players.map((p) => ({
            id: p.userId,
            name: p.user.name,
            status: p.status,
          }))
        );

        // Si l'utilisateur n'est pas dans le lobby, vérifier s'il est autorisé
        if (
          !lobby.authorizedPlayers.includes(userId) &&
          lobby.hostId !== userId
        ) {
          console.log(
            `LobbyGameService.getLobbyState - Utilisateur ${userId} non autorisé à accéder au lobby ${lobbyId}`
          );
          throw new LobbyError("Vous n'êtes pas autorisé à accéder à ce lobby");
        }

        // L'utilisateur est autorisé mais pas encore dans le lobby
        // On peut quand même lui montrer l'état du lobby pour qu'il puisse rejoindre
        console.log(
          `LobbyGameService.getLobbyState - Utilisateur ${userId} autorisé mais pas encore dans le lobby ${lobbyId}, affichage de l'état de base`
        );
      } else {
        console.log(
          `LobbyGameService.getLobbyState - Utilisateur ${userId} trouvé dans le lobby avec le statut: ${player.status}`
        );
      }

      // Récupérer l'état en mémoire
      const lobbyInMemory = LobbyManager.getLobbyInMemory(validatedLobbyId);
      if (!lobbyInMemory) {
        console.log(
          `LobbyGameService.getLobbyState - Lobby ${lobbyId} non trouvé en mémoire, retour des infos de base`
        );
        // Si pas en mémoire, retourner les infos de base avec tous les joueurs (connectés et déconnectés)
        const allPlayers = lobby.players.map((p) => ({
          id: p.userId,
          name: p.user.name,
          score: p.score,
          progress: p.progress,
          status: p.status,
        }));

        console.log(
          `LobbyGameService.getLobbyState - Joueurs depuis la BDD:`,
          allPlayers
        );

        return {
          lobbyId: lobby.id,
          status: lobby.status,
          hostId: lobby.hostId,
          players: allPlayers,
          settings: lobby.gameSettings,
        };
      }

      console.log(
        `LobbyGameService.getLobbyState - Lobby trouvé en mémoire, joueurs:`,
        Array.from(lobbyInMemory.players.keys())
      );

      // Retourner l'état complet du lobby (sans les pays)
      const players = [];
      const playerIdsInMemory = new Set();

      // D'abord, ajouter tous les joueurs en mémoire
      for (const [playerId, playerData] of lobbyInMemory.players.entries()) {
        playerIdsInMemory.add(playerId);
        players.push({
          id: playerId,
          name: playerData.name,
          score: playerData.score,
          progress: playerData.progress,
          status: playerData.status,
        });
      }

      // Ensuite, ajouter TOUS les joueurs depuis la base de données
      // qui ne sont PAS déjà en mémoire (qu'ils soient présents ou absents)
      const dbPlayers = lobby.players.filter(
        (p) => !playerIdsInMemory.has(p.userId)
      );

      for (const player of dbPlayers) {
        players.push({
          id: player.userId,
          name: player.user.name,
          score: player.score,
          progress: player.progress,
          status: player.status,
        });
      }

      const result = {
        lobbyId: lobby.id,
        status: lobby.status,
        hostId: lobby.hostId,
        players,
        settings: lobbyInMemory.settings,
      };

      console.log(
        `LobbyGameService.getLobbyState - État du lobby retourné avec succès:`,
        {
          lobbyId: result.lobbyId,
          status: result.status,
          playersCount: result.players.length,
          players: result.players.map((p) => ({
            id: p.id,
            name: p.name,
            status: p.status,
          })),
        }
      );

      return result;
    } catch (error) {
      console.error(
        `Erreur lors de la récupération de l'état du lobby ${lobbyId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Restaure l'état du jeu depuis la base de données
   */
  private static async restoreGameStateFromDatabase(
    lobbyId: string,
    userId: string
  ) {
    try {
      console.log(
        `Tentative de restauration de l'état du jeu pour le lobby ${lobbyId}`
      );

      // Récupérer le lobby depuis la base de données
      const lobby = await LobbyModel.getLobbyWithGameState(lobbyId);
      if (!lobby) {
        console.log(`Lobby ${lobbyId} non trouvé en base de données`);
        return null;
      }

      console.log(`Lobby trouvé en DB, statut: ${lobby.status}`);

      // Vérifier que l'utilisateur fait partie du lobby
      const userInLobby = lobby.players.find((p) => p.userId === userId);
      if (!userInLobby) {
        console.log(
          `Utilisateur ${userId} non trouvé dans le lobby ${lobbyId}`
        );
        return null;
      }

      // Si le lobby est en statut "playing", on peut restaurer l'état
      if (lobby.status === APP_CONSTANTS.LOBBY_STATUS.PLAYING) {
        // Vérifier qu'il y a un état de jeu sauvegardé
        if (!lobby.gameState) {
          console.log(
            `Aucun état de jeu sauvegardé pour le lobby ${lobbyId}, mais le lobby est en cours`
          );
          // Même sans gameState, on peut essayer de restaurer le lobby en mémoire
          // pour permettre au joueur de continuer sa partie
          LobbyManager.restoreLobbyFromDatabase(lobbyId, lobby);
          return null;
        }

        // Reconstruire l'état du jeu
        const gameState = {
          ...(lobby.gameState as any),
          settings: lobby.gameSettings,
          players: lobby.players.map((p) => ({
            id: p.userId,
            name: p.user.name,
            score: p.score || 0,
            progress: p.progress || 0,
            status: p.status || "joined",
            validatedCountries: p.validatedCountries || [],
            incorrectCountries: p.incorrectCountries || [],
          })),
        };

        // Restaurer le lobby en mémoire
        LobbyManager.restoreLobbyFromDatabase(lobbyId, lobby);

        console.log(
          `État du jeu restauré avec succès pour le lobby ${lobbyId}`
        );
        return gameState;
      } else {
        console.log(
          `Lobby ${lobbyId} n'est pas en cours (statut: ${lobby.status})`
        );
        return null;
      }
    } catch (error) {
      console.error("Erreur lors de la restauration de l'état du jeu:", error);
      return null;
    }
  }

  /**
   * Quitte une partie en cours
   */
  static async leaveGame(userId: string, lobbyId: string) {
    console.log(
      `LobbyGameService.leaveGame - Début pour userId: ${userId}, lobbyId: ${lobbyId}`
    );

    // Vérifier que le joueur est bien dans le lobby
    await LobbyPlayerService.verifyPlayerInLobby(userId, lobbyId);

    try {
      // Récupérer les informations du joueur avant de le supprimer
      const user = await UserModel.findUserById(userId);
      const playerName = user?.name || "Joueur inconnu";

      // Supprimer le joueur du lobby dans la base de données d'abord
      const removedPlayer = await LobbyModel.removePlayerFromLobby(
        lobbyId,
        userId
      );

      // Si le joueur n'existait pas dans la base de données, ne pas continuer
      if (!removedPlayer) {
        console.log(
          `Joueur ${userId} n'était pas dans le lobby ${lobbyId}, arrêt de leaveGame`
        );
        return { success: true, message: "Joueur non trouvé dans le lobby" };
      }

      console.log(`Joueur ${userId} supprimé de la base de données`);

      // Diffuser que le joueur a quitté la partie
      BroadcastManager.broadcastPlayerLeftGame(lobbyId, userId, playerName);

      // Supprimer le joueur du lobby en mémoire
      const memoryRemoved = LobbyManager.removePlayerFromLobby(lobbyId, userId);
      console.log(`Joueur ${userId} supprimé de la mémoire: ${memoryRemoved}`);

      // Si c'était l'hôte, terminer la partie
      const lobby = await LobbyModel.getLobby(lobbyId);
      if (lobby && lobby.hostId === userId) {
        console.log(`L'hôte ${userId} a quitté, terminaison de la partie`);
        await LobbyModel.updateLobbyStatus(lobbyId, "finished");
        LobbyManager.removeLobby(lobbyId);
      }

      return { success: true, message: "Partie quittée" };
    } catch (error) {
      console.error(
        `Erreur lors de la sortie du joueur ${userId} du lobby ${lobbyId}:`,
        error
      );

      // En cas d'erreur, essayer de restaurer la cohérence
      try {
        // Vérifier si le joueur est encore en mémoire
        const lobbyInMemory = LobbyManager.getLobbyInMemory(lobbyId);
        if (lobbyInMemory && !lobbyInMemory.players.has(userId)) {
          // Le joueur a été supprimé de la mémoire mais pas de la DB
          // Le remettre en mémoire pour éviter les incohérences
          const user = await UserModel.findUserById(userId);
          if (user) {
            LobbyManager.addPlayerToLobby(lobbyId, userId, user.name);
            console.log(`Joueur ${userId} restauré en mémoire après erreur`);
          }
        }
      } catch (restoreError) {
        console.error(
          "Erreur lors de la restauration de cohérence:",
          restoreError
        );
      }

      throw error;
    }
  }

  /**
   * Récupère les résultats de la partie
   */
  static async getGameResults(lobbyId: string, userId: string) {
    console.log(
      `LobbyGameService.getGameResults - Début pour userId: ${userId}, lobbyId: ${lobbyId}`
    );

    // Vérifier que le joueur est bien dans le lobby
    await LobbyPlayerService.verifyPlayerInLobby(userId, lobbyId);

    try {
      const lobby = await LobbyModel.getLobby(lobbyId);
      if (!lobby) {
        throw new LobbyError("Lobby non trouvé");
      }

      console.log(
        `LobbyGameService.getGameResults - Statut du lobby en BDD: ${lobby.status}`
      );

      // Vérifier que la partie est terminée
      if (lobby.status !== APP_CONSTANTS.LOBBY_STATUS.FINISHED) {
        console.log(
          `LobbyGameService.getGameResults - Partie non terminée, statut: ${lobby.status}, attendu: finished`
        );
        throw new LobbyError("La partie n'est pas encore terminée");
      }

      // Récupérer les joueurs avec leurs scores
      const players = await LobbyModel.getLobbyPlayers(lobbyId);

      // Créer le classement
      const rankings = players
        .map((player) => ({
          id: player.userId,
          name: player.user.name,
          score: player.score,
          rank: 0, // Sera calculé ci-dessous
        }))
        .sort((a, b) => b.score - a.score); // Tri par score décroissant

      // Assigner les rangs
      rankings.forEach((player, index) => {
        player.rank = index + 1;
      });

      console.log(
        `LobbyGameService.getGameResults - Résultats récupérés: ${rankings.length} joueurs`
      );

      return {
        rankings,
        hostId: lobby.hostId,
      };
    } catch (error) {
      console.error(
        `Erreur lors de la récupération des résultats pour le lobby ${lobbyId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Redémarre une partie
   */
  static async restartGame(userId: string, lobbyId: string) {
    console.log(
      `LobbyGameService.restartGame - Début pour userId: ${userId}, lobbyId: ${lobbyId}`
    );

    // Vérifier que l'utilisateur est bien l'hôte du lobby
    const lobby = await LobbyModel.getLobby(lobbyId);
    console.log(`LobbyGameService.restartGame - Lobby récupéré:`, {
      lobbyId: lobby?.id,
      hostId: lobby?.hostId,
      userId: userId,
      isHost: lobby?.hostId === userId,
      lobbyExists: !!lobby,
    });

    if (!lobby || lobby.hostId !== userId) {
      console.log(
        `LobbyGameService.restartGame - Erreur: utilisateur ${userId} n'est pas l'hôte du lobby ${lobbyId}`
      );
      throw new LobbyError(APP_CONSTANTS.ERRORS.UNAUTHORIZED);
    }

    try {
      // Réinitialiser le statut du lobby
      await LobbyModel.updateLobbyStatus(
        lobbyId,
        APP_CONSTANTS.LOBBY_STATUS.WAITING
      );

      // Réinitialiser les scores et statuts des joueurs
      const players = await LobbyPlayerService.getLobbyPlayers(lobbyId);
      for (const player of players) {
        await LobbyModel.updatePlayerStatus(
          lobbyId,
          player.id,
          APP_CONSTANTS.PLAYER_STATUS.JOINED
        );
        await LobbyModel.updatePlayerGameData(
          lobbyId,
          player.id,
          0, // score
          0, // progress
          [], // validatedCountries
          [] // incorrectCountries
        );
      }

      // Réinitialiser l'état du jeu en mémoire
      LobbyManager.restartLobby(lobbyId);

      // Restaurer les joueurs depuis la base de données vers la mémoire
      const updatedLobby = await LobbyModel.getLobby(lobbyId);
      if (updatedLobby) {
        LobbyManager.restoreLobbyFromDatabase(lobbyId, updatedLobby);
        console.log(
          `LobbyGameService.restartGame - Joueurs restaurés depuis la base de données: ${updatedLobby.players?.length || 0} joueurs`
        );

        // Vérifier que tous les joueurs sont bien en mémoire

        const lobbyInMemory = LobbyManager.getLobbyInMemory(lobbyId);
        if (lobbyInMemory) {
          console.log(
            `LobbyGameService.restartGame - Lobby en mémoire après restauration: ${lobbyInMemory.players.size} joueurs`
          );
        }
      }

      console.log(
        `LobbyGameService.restartGame - Partie redémarrée avec succès pour le lobby ${lobbyId}`
      );

      return { success: true, message: "Partie redémarrée" };
    } catch (error) {
      console.error(
        `Erreur lors du redémarrage de la partie pour le lobby ${lobbyId}:`,
        error
      );
      throw error;
    }
  }
}

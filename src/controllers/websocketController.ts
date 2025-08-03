import { FriendService } from "../services/friendService.js";
import { GameService } from "../services/gameService.js";

import * as LobbyModel from "../models/lobbyModel.js";
import { LobbyService } from "../services/lobbyService.js";
import { PlayerService } from "../services/playerService.js";
import { sendToUser } from "../websocket/core/connectionManager.js";
import { BroadcastManager } from "../websocket/lobby/broadcastManager.js";
import { LobbyLifecycleManager } from "../websocket/lobby/lobbyLifecycle.js";

export const handleSendFriendRequest = async (payload: any, userId: string) => {
  const { receiverTag } = payload;

  if (!receiverTag) {
    throw new Error("receiverTag requis");
  }

  return await FriendService.sendFriendRequest(userId, receiverTag);
};

export const handleRespondFriendRequest = async (
  payload: any,
  userId: string
) => {
  const { requestId, action } = payload;

  if (!requestId || !action) {
    throw new Error("requestId et action requis");
  }

  return await FriendService.respondToFriendRequest(requestId, action, userId);
};

export const handleCreateLobby = async (payload: any, userId: string) => {
  const { name, settings } = payload;

  try {
    // 1. Créer le lobby en base de données via le service
    const result = await LobbyService.createLobby(userId, name, settings);

    if (!result.success) {
      return result;
    }

    console.log(`Lobby créé en base de données: ${result.lobbyId}`);

    // 2. Créer le lobby en mémoire pour la gestion en temps réel
    LobbyLifecycleManager.createLobby(
      result.lobbyId,
      userId,
      result.players?.[0]?.name || "User",
      settings
    );
    console.log(`Lobby créé en mémoire: ${result.lobbyId}`);

    return result;
  } catch (error) {
    console.error("Erreur lors de la création du lobby:", error);
    return { success: false, lobbyId: "", hostId: "", settings: {} };
  }
};

export const handleInviteToLobby = async (payload: any, userId: string) => {
  const { lobbyId, friendId } = payload;
  return await LobbyService.inviteToLobby(userId, lobbyId, friendId);
};

export const handleJoinLobby = async (payload: any, userId: string) => {
  const { lobbyId } = payload;

  let lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);

  // Si le lobby n'est pas en mémoire, essayer de le restaurer depuis la DB
  if (!lobby) {
    const lobbyFromDB = await LobbyService.getLobby(lobbyId);
    if (lobbyFromDB) {
      LobbyLifecycleManager.restoreLobbyFromDatabase(lobbyId, lobbyFromDB);
      lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    }
  }

  if (!lobby) {
    return { success: false };
  }

  // Si le lobby était vide et en attente de suppression, on annule le timer
  if (lobby.players.size === 0) {
    LobbyLifecycleManager.cancelLobbyDeletion(lobbyId);
  }

  lobby.players.set(userId, PlayerService.createPlayer("User"));

  // Ajouter le joueur en base de données aussi
  try {
    await LobbyService.addPlayerToLobby(lobbyId, userId, "joined");
  } catch (error) {
    console.error("Erreur lors de l'ajout du joueur en DB:", error);
  }

  return { success: true };
};

export const handleLeaveLobby = async (payload: any, userId: string) => {
  const { lobbyId } = payload;

  const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
  if (!lobby) return { success: false };

  lobby.players.delete(userId);

  // Si plus de joueurs, supprimer le lobby
  if (lobby.players.size === 0) {
    LobbyLifecycleManager.scheduleLobbyDeletion(lobbyId);
  } else {
    // Si l'hôte part, transférer l'hôte au premier joueur restant
    if (userId === lobby.hostId) {
      const firstPlayer = lobby.players.keys().next().value;
      lobby.hostId = firstPlayer;
    }
    await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
  }

  return { success: true };
};

export const handleUpdateLobbySettings = async (
  payload: any,
  userId: string
) => {
  const { lobbyId, settings } = payload;

  const success = await LobbyService.updateLobbySettings(
    userId,
    lobbyId,
    settings
  );

  // Broadcast du lobby_update après la mise à jour des paramètres
  if (success) {
    const lobbyInMemory = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (lobbyInMemory) {
      await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobbyInMemory);
    }
  }

  return { success };
};

export const handleSetPlayerReady = async (payload: any, userId: string) => {
  const { lobbyId, ready } = payload;
  const status = ready ? "ready" : "joined";

  const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
  if (!lobby) return { success: false };

  if (!lobby.players.has(userId)) return { success: false };

  const playerData = lobby.players.get(userId);
  lobby.players.set(
    userId,
    PlayerService.updatePlayerStatus(playerData, status)
  );

  // Sauvegarder le statut en base de données
  await LobbyService.updatePlayerStatus(lobbyId, userId, status);

  // Vérifier si tous les joueurs sont prêts pour démarrer automatiquement
  if (ready) {
    try {
      const allReady = PlayerService.areAllPlayersReady(
        lobby.players,
        lobby.hostId
      );

      if (allReady) {
        await GameService.startGame(lobbyId);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification des joueurs prêts:", error);
    }
  }

  return { success: true };
};

export const handleStartGame = async (payload: any, userId: string) => {
  const { lobbyId } = payload;
  const success = await GameService.startGame(lobbyId);
  return { success };
};

export const handleUpdateGameProgress = async (
  payload: any,
  userId: string
) => {
  const { lobbyId, score, progress, answerTime, isConsecutiveCorrect } =
    payload;
  const success = await GameService.updatePlayerScore(
    lobbyId,
    userId,
    score,
    progress,
    answerTime,
    isConsecutiveCorrect
  );
  return { success };
};

export const handleUpdatePlayerProgress = async (
  payload: any,
  userId: string
) => {
  const {
    lobbyId,
    validatedCountries,
    incorrectCountries,
    score,
    totalQuestions,
  } = payload;
  const success = await GameService.updatePlayerProgress(
    lobbyId,
    userId,
    validatedCountries,
    incorrectCountries,
    score,
    totalQuestions
  );
  return { success };
};

export const handleRestartGame = async (payload: any, userId: string) => {
  const { lobbyId } = payload;

  // Vérifier que l'utilisateur est l'hôte du lobby
  const lobby = await LobbyService.getLobby(lobbyId);
  if (!lobby || lobby.hostId !== userId) {
    throw new Error("Seul l'hôte peut redémarrer la partie");
  }

  const success = await GameService.restartLobby(lobbyId);

  // Broadcast du lobby_update après le restart
  if (success) {
    const lobbyInMemory = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (lobbyInMemory) {
      await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobbyInMemory);

      // Envoyer un message game_restarted à tous les joueurs
      const restartMessage = {
        type: "game_restarted",
        payload: {
          lobbyId,
          message: "Partie remise à zéro, retour au lobby d'attente.",
        },
      };

      for (const [playerId] of lobbyInMemory.players) {
        // Utiliser la fonction sendToUser importée
        sendToUser(playerId, restartMessage);
      }
    }
  }

  return { success };
};

export const handleLeaveGame = async (payload: any, userId: string) => {
  const { lobbyId } = payload;

  const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
  if (!lobby) return { success: false };

  lobby.players.delete(userId);

  // Ne pas supprimer le lobby même s'il n'y a plus de joueurs en mémoire
  // Le lobby reste actif pour permettre aux joueurs de revenir
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

  return { success: true };
};

export const handleRemovePlayer = async (payload: any, userId: string) => {
  const { lobbyId, playerId } = payload;

  if (!lobbyId) {
    throw new Error("lobbyId requis");
  }
  if (!playerId) {
    throw new Error("playerId requis");
  }

  try {
    // Vérifier que l'utilisateur est l'hôte du lobby
    const lobbyFromDB = await LobbyService.getLobby(lobbyId);
    if (!lobbyFromDB) {
      throw new Error("Lobby non trouvé");
    }

    if (lobbyFromDB.hostId !== userId) {
      throw new Error("Seul l'hôte peut supprimer des joueurs");
    }

    if (lobbyFromDB.hostId === playerId) {
      throw new Error("L'hôte ne peut pas se supprimer lui-même");
    }

    // Supprimer le joueur du lobby en base de données
    await LobbyModel.removePlayerFromLobby(lobbyId, playerId);

    // Supprimer le joueur du lobby en mémoire
    const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
    if (lobby) {
      lobby.players.delete(playerId);
    }

    // Retirer le joueur de la liste des joueurs autorisés
    await LobbyModel.updateLobbyAuthorizedPlayers(lobbyId, playerId, "remove");

    // Diffuser la mise à jour du lobby
    if (lobby) {
      await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
    }

    // Envoyer un message au joueur supprimé pour qu'il quitte le lobby
    sendToUser(playerId, {
      type: "player_removed",
      payload: {
        lobbyId,
        message: "Vous avez été expulsé du lobby par l'hôte",
      },
    });

    return {
      lobbyId,
      playerId,
      message: "Joueur supprimé avec succès",
    };
  } catch (error) {
    console.error(
      `Erreur lors de la suppression du joueur ${playerId} du lobby ${lobbyId}:`,
      error
    );
    throw new Error(
      `Impossible de supprimer le joueur: ${
        error instanceof Error ? error.message : "Erreur inconnue"
      }`
    );
  }
};

export const handleUpdatePlayerStatus = async (
  payload: any,
  userId: string
) => {
  const { lobbyId, status } = payload;

  // Si le statut est "ready", utiliser handleSetPlayerReady
  if (status === "ready") {
    return await handleSetPlayerReady({ lobbyId, ready: true }, userId);
  }

  // Sinon, logique normale pour les autres statuts
  const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
  if (!lobby) return { success: false };

  if (!lobby.players.has(userId)) return { success: false };

  const playerData = lobby.players.get(userId);
  lobby.players.set(
    userId,
    PlayerService.updatePlayerStatus(playerData, status)
  );

  // Sauvegarder le statut en base de données
  await LobbyService.updatePlayerStatus(lobbyId, userId, status);

  return { success: true };
};

/**
 * Gère la récupération de l'état du jeu avec restauration depuis la DB si nécessaire
 */
export const handleGetGameState = async (payload: any, userId: string) => {
  const { lobbyId } = payload;
  if (!lobbyId) {
    throw new Error("lobbyId requis");
  }

  console.log(
    `Demande d'état du jeu pour le lobby ${lobbyId} par l'utilisateur ${userId}`
  );

  try {
    // Récupérer l'état du jeu depuis la mémoire
    let gameState = await getGameStateFromMemory(lobbyId, userId);

    // Si pas en mémoire, essayer de restaurer depuis la DB
    if (!gameState) {
      console.log(
        `Lobby ${lobbyId} non trouvé en mémoire, tentative de restauration depuis la DB`
      );
      const lobbyFromDB = await LobbyService.getLobby(lobbyId);

      if (lobbyFromDB && lobbyFromDB.status === "playing") {
        // Restaurer le lobby en mémoire
        LobbyLifecycleManager.restoreLobbyFromDatabase(lobbyId, lobbyFromDB);
        gameState = await getGameStateFromMemory(lobbyId, userId);
        console.log(`Lobby ${lobbyId} restauré depuis la DB`);
      }
    }

    // Broadcast pour synchroniser le frontend
    try {
      const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
      if (lobby) {
        console.log(
          `Broadcast de la mise à jour du lobby ${lobbyId} après get_game_state`
        );
        await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
      }
    } catch (broadcastError) {
      console.error("Erreur lors du broadcast:", broadcastError);
    }

    if (!gameState) {
      console.log(`Aucun état de jeu trouvé pour le lobby ${lobbyId}`);
      return {
        lobbyId,
        gameState: null,
        message: "Aucun état de jeu disponible",
      };
    }

    console.log(`État du jeu récupéré avec succès pour le lobby ${lobbyId}`);
    return {
      lobbyId,
      gameState,
    };
  } catch (error) {
    console.error(
      `Erreur lors de la récupération de l'état du jeu pour le lobby ${lobbyId}:`,
      error
    );
    throw new Error(
      `Impossible de récupérer l'état du jeu: ${
        error instanceof Error ? error.message : "Erreur inconnue"
      }`
    );
  }
};

/**
 * Gère la récupération de l'état du lobby
 */
export const handleGetLobbyState = async (payload: any, userId: string) => {
  const { lobbyId } = payload;
  if (!lobbyId) {
    throw new Error("lobbyId requis");
  }

  console.log(
    `WebSocketMessageHandler.handleGetLobbyState - Début pour lobbyId: ${lobbyId}, userId: ${userId}`
  );

  try {
    const lobbyState = await LobbyService.getLobby(lobbyId);

    console.log(
      `WebSocketMessageHandler.handleGetLobbyState - État du lobby récupéré avec succès pour ${lobbyId}`
    );

    return {
      lobbyId,
      lobbyState,
    };
  } catch (error) {
    console.error(
      `WebSocketMessageHandler.handleGetLobbyState - Erreur lors de la récupération de l'état du lobby ${lobbyId}:`,
      error
    );

    let errorMessage = "Impossible de récupérer l'état du lobby";
    if (error instanceof Error) {
      if (error.message.includes("non trouvé")) {
        errorMessage = "Lobby non trouvé";
      } else if (error.message.includes("pas autorisé")) {
        errorMessage = "Vous n'êtes pas autorisé à accéder à ce lobby";
      } else {
        errorMessage = error.message;
      }
    }

    throw new Error(errorMessage);
  }
};

/**
 * Gère la récupération des résultats de jeu
 */
export const handleGetGameResults = async (payload: any, userId: string) => {
  const { lobbyId } = payload;
  if (!lobbyId) {
    throw new Error("lobbyId requis");
  }

  try {
    const results = await LobbyService.getGameResults(lobbyId, userId);

    return {
      lobbyId,
      rankings: results.rankings,
      hostId: results.hostId,
    };
  } catch (error) {
    console.error(
      `Erreur lors de la récupération des résultats pour le lobby ${lobbyId}:`,
      error
    );
    throw new Error(
      `Impossible de récupérer les résultats: ${
        error instanceof Error ? error.message : "Erreur inconnue"
      }`
    );
  }
};

/**
 * Récupère l'état du jeu depuis la mémoire
 */
async function getGameStateFromMemory(
  lobbyId: string,
  userId: string
): Promise<any> {
  console.log(
    `getGameStateFromMemory - Début pour lobbyId: ${lobbyId}, userId: ${userId}`
  );

  const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
  if (!lobby) {
    console.log(
      `getGameStateFromMemory - Lobby ${lobbyId} non trouvé en mémoire`
    );
    return null;
  }

  // Vérifier que l'utilisateur est dans le lobby
  if (!lobby.players.has(userId)) {
    return null;
  }

  // Récupérer les données complètes depuis la base de données pour avoir les progressions à jour
  const lobbyFromDB = await LobbyService.getLobby(lobbyId);
  if (!lobbyFromDB) {
    return null;
  }

  // Fusionner les données en mémoire avec celles de la base de données
  const players = lobbyFromDB.players.map((player: any) => {
    const memoryPlayer = lobby.players.get(player.userId);
    return {
      id: player.userId,
      name: player.user.name,
      status: memoryPlayer ? memoryPlayer.status : player.status,
      score: player.score || 0,
      progress: player.progress || 0,
      validatedCountries: player.validatedCountries || [],
      incorrectCountries: player.incorrectCountries || [],
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

import { FriendService } from "../services/friendService.js";
import { GameService } from "../services/gameService.js";

import { LobbyService } from "../services/lobbyService.js";
import { PlayerService } from "../services/playerService.js";
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

  const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
  if (!lobby) return { success: false };

  // Si le lobby était vide et en attente de suppression, on annule le timer
  if (lobby.players.size === 0) {
    LobbyLifecycleManager.cancelLobbyDeletion(lobbyId);
  }

  lobby.players.set(userId, PlayerService.createPlayer("User"));

  // Broadcast pour informer les autres joueurs
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

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
  // TODO: Implémenter la logique de mise à jour des paramètres
  return { success: true };
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
      const allReady = await LobbyService.areAllPlayersReady(
        lobbyId,
        lobby.hostId
      );
      if (allReady) {
        console.log(
          `Démarrage automatique de la partie pour le lobby ${lobbyId}`
        );
        await GameService.startGame(lobbyId);
      }
    } catch (error) {
      console.error("Erreur lors de la vérification des joueurs prêts:", error);
    }
  }

  // Broadcast pour informer les autres joueurs APRÈS le retour
  // Cela sera géré par le messageHandler qui enverra d'abord le success
  setTimeout(async () => {
    await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
  }, 0);

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
  const success = await GameService.restartLobby(lobbyId);
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

  const lobby = LobbyLifecycleManager.getLobbyInMemory(lobbyId);
  if (!lobby) return { success: false };

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

  return { success: true };
};

export const handleUpdatePlayerStatus = async (
  payload: any,
  userId: string
) => {
  const { lobbyId, status } = payload;

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

  // Broadcast pour informer les autres joueurs
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

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
    let gameState = getGameStateFromMemory(lobbyId, userId);

    // Si pas en mémoire, essayer de restaurer depuis la DB
    if (!gameState) {
      console.log(
        `Lobby ${lobbyId} non trouvé en mémoire, tentative de restauration depuis la DB`
      );
      const lobbyFromDB = await LobbyService.getLobby(lobbyId);

      if (lobbyFromDB && lobbyFromDB.status === "playing") {
        // Restaurer le lobby en mémoire
        LobbyLifecycleManager.restoreLobbyFromDatabase(lobbyId, lobbyFromDB);
        gameState = getGameStateFromMemory(lobbyId, userId);
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
 * Récupère l'état du jeu depuis la mémoire
 */
function getGameStateFromMemory(lobbyId: string, userId: string): any {
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

  console.log(`getGameStateFromMemory - Lobby trouvé, statut: ${lobby.status}`);

  // Vérifier que l'utilisateur est dans le lobby
  if (!lobby.players.has(userId)) {
    console.log(
      `getGameStateFromMemory - Utilisateur ${userId} non trouvé dans le lobby`
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

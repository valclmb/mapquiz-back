import { BroadcastManager } from "./broadcastManager.js";
import { GameStateManager } from "./gameStateManager.js";
import { PlayerManager } from "./playerManager.js";

// Map des lobbies actifs : lobbyId -> {players, gameState}
const activeLobbies = new Map();

// Créer un nouveau lobby
export function createLobby(
  lobbyId: string,
  hostId: string,
  hostName: string,
  settings: any
) {
  console.log(`Création du lobby ${lobbyId} en mémoire avec l'hôte ${hostId}`);
  activeLobbies.set(lobbyId, {
    players: new Map([[hostId, PlayerManager.createPlayer(hostName)]]),
    hostId: hostId,
    settings,
    status: "waiting",
    gameState: null,
  });

  return { lobbyId, hostId, settings };
}

// Ajouter un joueur au lobby
export async function addPlayerToLobby(
  lobbyId: string,
  playerId: string,
  playerName: string
) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return false;

  lobby.players.set(playerId, PlayerManager.createPlayer(playerName));
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
  return true;
}

// Mettre à jour le statut d'un joueur
export async function updatePlayerStatus(
  lobbyId: string,
  playerId: string,
  status: string
) {
  const lobby = activeLobbies.get(lobbyId);
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
    const { updatePlayerStatus } = await import("../../models/lobbyModel.js");
    await updatePlayerStatus(lobbyId, playerId, status);
    console.log(`Statut sauvegardé en DB pour ${playerId}: ${status}`);
  } catch (error) {
    console.error(
      `Erreur lors de la sauvegarde du statut en DB pour ${playerId}:`,
      error
    );
  }

  // Toujours diffuser la mise à jour du lobby
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

  // Si le statut est "ready", vérifier si tous les joueurs sont prêts en base de données
  // Permettre le démarrage automatique même avec 1 joueur (pour les tests solo)
  if (status === "ready") {
    // Utiliser une IIFE asynchrone pour gérer l'asynchronicité
    (async () => {
      try {
        console.log(
          `Vérification si tous les joueurs sont prêts pour le lobby ${lobbyId} (${lobby.players.size} joueur${lobby.players.size > 1 ? "s" : ""})`
        );

        // Importer le service pour vérifier en base de données
        const { LobbyPlayerService } = await import(
          "../../services/lobby/lobbyPlayerService.js"
        );
        const allReady = await LobbyPlayerService.areAllPlayersReady(
          lobbyId,
          lobby.hostId
        );

        console.log(`Tous les joueurs sont prêts: ${allReady}`);

        if (allReady) {
          console.log(
            `Démarrage automatique de la partie pour le lobby ${lobbyId}`
          );
          await startGame(lobbyId);
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

// Démarrer une partie
export async function startGame(lobbyId: string) {
  console.log("🚀 LobbyManager.startGame - DÉBUT pour le lobby:", lobbyId);

  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) {
    console.log(
      "❌ LobbyManager.startGame - Lobby non trouvé en mémoire:",
      lobbyId
    );
    return false;
  }

  console.log("✅ LobbyManager.startGame - Lobby trouvé, début du traitement");

  // Mettre à jour le statut du lobby en base de données
  try {
    const { updateLobbyStatus } = await import("../../models/lobbyModel.js");
    await updateLobbyStatus(lobbyId, "playing");
    console.log(`Statut du lobby ${lobbyId} mis à jour en base de données`);
  } catch (error) {
    console.error(
      `Erreur lors de la mise à jour du statut du lobby ${lobbyId}:`,
      error
    );
  }

  // --- SUPPRESSION DE TOUTE LOGIQUE COUNTRIES ---

  lobby.status = "playing";
  lobby.gameState = {
    startTime: Date.now(),
    settings: {
      selectedRegions: lobby.settings.selectedRegions || [],
    },
  };

  console.log("LobbyManager.startGame - gameState créé:", {
    startTime: lobby.gameState.startTime,
    settings: lobby.gameState.settings,
  });

  // Réinitialiser tous les joueurs pour la nouvelle partie
  lobby.players = PlayerManager.resetPlayersForNewGame(lobby.players);

  console.log(
    `LobbyManager.startGame - Joueurs après reset:`,
    Array.from(lobby.players.keys())
  );

  // Mettre à jour le statut "playing" de tous les joueurs en mémoire ET en base de données
  try {
    console.log(
      `🔍 startGame - Joueurs avant mise à jour:`,
      Array.from(lobby.players.entries()).map((entry: any) => ({
        id: entry[0],
        status: entry[1].status,
      }))
    );

    for (const [playerId, playerData] of lobby.players) {
      console.log(
        `🔍 startGame - Mise à jour du joueur ${playerId} de ${playerData.status} vers playing`
      );

      // Mettre à jour en mémoire
      lobby.players.set(
        playerId,
        PlayerManager.updatePlayerStatus(playerData, "playing")
      );

      // Mettre à jour en base de données
      const { updatePlayerStatus } = await import("../../models/lobbyModel.js");
      await updatePlayerStatus(lobbyId, playerId, "playing");

      console.log(`✅ startGame - Joueur ${playerId} mis à jour vers playing`);
    }

    console.log(
      `🔍 startGame - Joueurs après mise à jour:`,
      Array.from(lobby.players.entries()).map((entry: any) => ({
        id: entry[0],
        status: entry[1].status,
      }))
    );
    console.log(
      `Statut "playing" mis à jour en mémoire et en DB pour tous les joueurs du lobby ${lobbyId}`
    );
  } catch (error) {
    console.error(`Erreur lors de la mise à jour du statut "playing":`, error);
  }

  // Sauvegarder l'état du jeu en base de données
  try {
    const { saveGameState } = await import("../../models/lobbyModel.js");
    await saveGameState(lobbyId, lobby.gameState);
    console.log(
      `État du jeu sauvegardé en base de données pour le lobby ${lobbyId}`
    );
  } catch (error) {
    console.error(
      `Erreur lors de la sauvegarde de l'état du jeu pour le lobby ${lobbyId}:`,
      error
    );
  }

  console.log(`LobbyManager.startGame - Broadcast du début de partie`);
  BroadcastManager.broadcastGameStart(lobbyId, lobby);

  // Diffuser aussi la mise à jour du lobby avec le nouveau statut "playing"
  console.log(`LobbyManager.startGame - Broadcast de la mise à jour du lobby`);
  console.log(
    `LobbyManager.startGame - Statut du lobby avant broadcast:`,
    lobby.status
  );
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
  return true;
}

// Mettre à jour le score d'un joueur
export async function updatePlayerScore(
  lobbyId: string,
  playerId: string,
  score: number,
  progress: number,
  answerTime?: number,
  isConsecutiveCorrect?: boolean
) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby || !lobby.players.has(playerId)) return false;

  const playerData = lobby.players.get(playerId);
  const updatedPlayer = PlayerManager.updatePlayerScore(
    playerData,
    score,
    progress,
    answerTime,
    isConsecutiveCorrect
  );

  lobby.players.set(playerId, updatedPlayer);

  // Sauvegarder en base de données
  try {
    const { updatePlayerGameData } = await import("../../models/lobbyModel.js");
    await updatePlayerGameData(
      lobbyId,
      playerId,
      updatedPlayer.score,
      updatedPlayer.progress,
      updatedPlayer.validatedCountries || [],
      updatedPlayer.incorrectCountries || [],
      updatedPlayer.status
    );
  } catch (error) {
    console.error(
      `Erreur lors de la sauvegarde du score en DB pour ${playerId}:`,
      error
    );
  }

  // Vérifier si le joueur a terminé la partie
  if (updatedPlayer.progress >= 100) {
    console.log(
      `Joueur ${playerId} a terminé avec ${updatedPlayer.progress}% de progression`
    );
    checkGameCompletion(lobbyId, playerId);
  }

  BroadcastManager.broadcastScoreUpdate(lobbyId, lobby, playerId);
  return true;
}

// Mettre à jour la progression détaillée du joueur
export async function updatePlayerProgress(
  lobbyId: string,
  playerId: string,
  validatedCountries: string[],
  incorrectCountries: string[],
  score: number,
  totalQuestions: number
) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby || !lobby.players.has(playerId)) return false;

  const playerData = lobby.players.get(playerId);
  console.log(`🔍 updatePlayerProgress - Statut du joueur avant mise à jour:`, {
    playerId,
    currentStatus: playerData?.status,
    currentScore: playerData?.score,
    currentProgress: playerData?.progress,
  });

  const updatedPlayer = PlayerManager.updatePlayerProgress(
    playerData,
    validatedCountries,
    incorrectCountries,
    score,
    totalQuestions
  );

  lobby.players.set(playerId, updatedPlayer);

  // Sauvegarder en base de données
  try {
    const { updatePlayerGameData } = await import("../../models/lobbyModel.js");
    console.log(`🔍 updatePlayerProgress - Avant sauvegarde DB:`, {
      playerId,
      status: updatedPlayer.status,
      score: updatedPlayer.score,
      progress: updatedPlayer.progress,
    });

    await updatePlayerGameData(
      lobbyId,
      playerId,
      updatedPlayer.score,
      updatedPlayer.progress,
      updatedPlayer.validatedCountries,
      updatedPlayer.incorrectCountries,
      updatedPlayer.status
    );

    console.log(
      `✅ updatePlayerProgress - Après sauvegarde DB: status=${updatedPlayer.status}`
    );
  } catch (error) {
    console.error(
      `❌ Erreur lors de la sauvegarde de la progression en DB pour ${playerId}:`,
      error
    );
  }

  // Vérifier si le joueur a terminé la partie
  if (updatedPlayer.progress >= 100) {
    console.log(
      `LobbyManager.updatePlayerProgress - Joueur ${playerId} a terminé avec ${updatedPlayer.progress}% de progression`
    );
    checkGameCompletion(lobbyId, playerId);
  }

  BroadcastManager.broadcastPlayerProgressUpdate(lobbyId, lobby);
  return true;
}

// Vérifier si la partie est terminée
function checkGameCompletion(lobbyId: string, playerId: string) {
  console.log(
    `LobbyManager.checkGameCompletion - Début pour lobbyId: ${lobbyId}, playerId: ${playerId}`
  );

  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) {
    console.log(
      `LobbyManager.checkGameCompletion - Lobby ${lobbyId} non trouvé`
    );
    return;
  }

  // Marquer le joueur comme ayant terminé
  const playerData = lobby.players.get(playerId);
  if (playerData) {
    lobby.players.set(playerId, { ...playerData, status: "finished" });
    console.log(
      `LobbyManager.checkGameCompletion - Joueur ${playerId} marqué comme finished`
    );
  }

  // Vérifier si tous les joueurs ont terminé
  let allFinished = true;
  const playerStatuses = [];
  for (const [id, data] of lobby.players.entries()) {
    playerStatuses.push({ id, status: data.status, progress: data.progress });
    if (data.status !== "finished") {
      allFinished = false;
    }
  }

  console.log(
    `LobbyManager.checkGameCompletion - Statuts des joueurs:`,
    playerStatuses
  );
  console.log(
    `LobbyManager.checkGameCompletion - Tous les joueurs ont terminé: ${allFinished}`
  );

  if (allFinished) {
    console.log(`LobbyManager.checkGameCompletion - Fin de jeu déclenchée !`);
    endGame(lobbyId).catch((error) => {
      console.error("Erreur lors de la fin de jeu:", error);
    });
  }
}

// Terminer la partie
async function endGame(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  lobby.status = "finished";
  const rankings = GameStateManager.calculateRankings(lobby.players);

  // Mettre à jour le statut du lobby en base de données
  try {
    const { updateLobbyStatus } = await import("../../models/lobbyModel.js");
    await updateLobbyStatus(lobbyId, "finished");
    console.log(
      `Statut du lobby ${lobbyId} mis à jour en base de données vers 'finished'`
    );
  } catch (error) {
    console.error(
      `Erreur lors de la mise à jour du statut du lobby ${lobbyId} en base de données:`,
      error
    );
  }

  console.log("LobbyManager.endGame - Fin de jeu, rankings:", rankings);
  BroadcastManager.broadcastGameResults(lobbyId, rankings);
  // Diffuser un lobby_update avec le status finished pour synchroniser le frontend
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
}

// Supprimer un lobby
export function removeLobby(lobbyId: string) {
  console.log(`Suppression du lobby ${lobbyId} de la mémoire`);
  activeLobbies.delete(lobbyId);
}

// Supprimer un joueur du lobby
export async function removePlayerFromLobby(lobbyId: string, playerId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return false;

  lobby.players.delete(playerId);

  // Si plus de joueurs, supprimer le lobby
  if (lobby.players.size === 0) {
    removeLobby(lobbyId);
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

// Retirer un joueur déconnecté du lobby (sans supprimer le lobby)
export async function removeDisconnectedPlayerFromLobby(
  lobbyId: string,
  playerId: string
) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return false;

  lobby.players.delete(playerId);

  // Ne pas supprimer le lobby même s'il n'y a plus de joueurs en mémoire
  // Le lobby reste actif pour permettre aux joueurs de revenir
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

  return true;
}

// Récupérer un lobby en mémoire (sans vérification d'utilisateur)
export function getLobbyInMemory(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) {
    console.log(
      `Lobby ${lobbyId} non trouvé en mémoire. Lobbies actifs:`,
      Array.from(activeLobbies.keys())
    );
  }
  return lobby || null;
}

// Récupérer l'état du jeu
export function getGameState(lobbyId: string, userId: string) {
  console.log(
    `LobbyManager.getGameState - Début pour lobbyId: ${lobbyId}, userId: ${userId}`
  );

  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) {
    console.log(
      `LobbyManager.getGameState - Lobby ${lobbyId} non trouvé en mémoire`
    );
    return null;
  }

  console.log(
    `LobbyManager.getGameState - Lobby trouvé, statut: ${lobby.status}`
  );
  console.log(
    `LobbyManager.getGameState - Joueurs en mémoire:`,
    Array.from(lobby.players.keys())
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

  // Construction explicite de l'objet retourné
  return {
    lobbyId,
    status: String(lobby.status),
    hostId: lobby.hostId,
    settings: lobby.settings,
    players,
    startTime: lobby.gameState?.startTime,
    // Ajoute ici d'autres champs de gameState si besoin
  };
}

// Restaurer un lobby depuis la base de données
export function restoreLobbyFromDatabase(lobbyId: string, lobbyData: any) {
  if (activeLobbies.has(lobbyId)) {
    console.log(`Lobby ${lobbyId} déjà actif, pas de restauration nécessaire`);
    return;
  }

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

// Redémarrer un lobby
export async function restartLobby(lobbyId: string) {
  console.log(`LobbyManager.restartLobby - Redémarrage du lobby ${lobbyId}`);

  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) {
    console.log(`Lobby ${lobbyId} non trouvé en mémoire`);
    return false;
  }

  // Réinitialiser le statut du lobby
  lobby.status = "waiting";
  lobby.gameState = null;

  // Réinitialiser tous les joueurs
  for (const [playerId, playerData] of lobby.players) {
    lobby.players.set(playerId, {
      ...playerData,
      status: "joined", // Remettre en "joined" au lieu de "not_ready"
      score: 0,
      progress: 0,
      validatedCountries: [],
      incorrectCountries: [],
      completionTime: null,
    });

    // PATCH: Remettre à zéro en base de données aussi
    try {
      const { updatePlayerGameData } = await import(
        "../../models/lobbyModel.js"
      );
      await updatePlayerGameData(
        lobbyId,
        playerId,
        0, // score
        0, // progress
        [], // validatedCountries
        [], // incorrectCountries
        "joined" // status
      );
    } catch (error) {
      console.error(`Erreur lors du reset du joueur ${playerId} en DB:`, error);
    }
  }

  // Diffuser la mise à jour du lobby
  await BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

  console.log(`Lobby ${lobbyId} redémarré avec succès`);
  return true;
}

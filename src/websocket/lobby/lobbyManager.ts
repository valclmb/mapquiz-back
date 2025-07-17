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
export function addPlayerToLobby(
  lobbyId: string,
  playerId: string,
  playerName: string
) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return false;

  lobby.players.set(playerId, PlayerManager.createPlayer(playerName));
  BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
  return true;
}

// Mettre à jour le statut d'un joueur
export function updatePlayerStatus(
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

  // Toujours diffuser la mise à jour du lobby
  BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);

  // Si le statut est "ready", vérifier si tous les joueurs sont prêts en base de données
  if (status === "ready") {
    // Utiliser une IIFE asynchrone pour gérer l'asynchronicité
    (async () => {
      try {
        console.log(
          `Vérification si tous les joueurs sont prêts pour le lobby ${lobbyId}`
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
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return false;

  console.log("LobbyManager.startGame - début pour le lobby:", lobbyId);

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

  // Générer les pays pour la partie
  console.log(
    "LobbyManager.startGame - génération des pays avec settings:",
    lobby.settings
  );
  const countries = await GameStateManager.generateCountriesForGame(
    lobby.settings
  );
  console.log("LobbyManager.startGame - pays générés:", {
    count: countries.length,
    firstCountry: countries[0],
  });

  // Ajouter totalQuestions aux settings
  lobby.settings.totalQuestions = countries.length;

  lobby.status = "playing";
  lobby.gameState = {
    startTime: Date.now(),
    countries: countries,
    settings: {
      selectedRegions: lobby.settings.selectedRegions || [],
    },
  };

  console.log("LobbyManager.startGame - gameState créé:", {
    startTime: lobby.gameState.startTime,
    countriesCount: lobby.gameState.countries.length,
    settings: lobby.gameState.settings,
  });

  // Réinitialiser tous les joueurs pour la nouvelle partie
  lobby.players = PlayerManager.resetPlayersForNewGame(lobby.players);

  console.log(
    `LobbyManager.startGame - Joueurs après reset:`,
    Array.from(lobby.players.keys())
  );

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
  return true;
}

// Mettre à jour le score d'un joueur
export function updatePlayerScore(
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

  // Vérifier si le joueur a terminé la partie
  if (
    GameStateManager.checkGameCompletion(
      updatedPlayer,
      lobby.settings.totalQuestions
    )
  ) {
    checkGameCompletion(lobbyId, playerId);
  }

  BroadcastManager.broadcastScoreUpdate(lobbyId, lobby, playerId);
  return true;
}

// Mettre à jour la progression détaillée du joueur
export function updatePlayerProgress(
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
  const updatedPlayer = PlayerManager.updatePlayerProgress(
    playerData,
    validatedCountries,
    incorrectCountries,
    score,
    totalQuestions
  );

  lobby.players.set(playerId, updatedPlayer);

  // Vérifier si le joueur a terminé la partie
  if (
    GameStateManager.checkGameCompletion(
      updatedPlayer,
      lobby.settings.totalQuestions
    )
  ) {
    checkGameCompletion(lobbyId, playerId);
  }

  BroadcastManager.broadcastPlayerProgressUpdate(lobbyId, lobby);
  return true;
}

// Vérifier si la partie est terminée
function checkGameCompletion(lobbyId: string, playerId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  // Marquer le joueur comme ayant terminé
  const playerData = lobby.players.get(playerId);
  if (playerData) {
    lobby.players.set(playerId, { ...playerData, status: "finished" });
  }

  // Vérifier si tous les joueurs ont terminé
  let allFinished = true;
  for (const [id, data] of lobby.players.entries()) {
    if (data.status !== "finished") {
      allFinished = false;
      break;
    }
  }

  if (allFinished) {
    endGame(lobbyId);
  }
}

// Terminer la partie
function endGame(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  lobby.status = "finished";
  const rankings = GameStateManager.calculateRankings(lobby.players);

  BroadcastManager.broadcastGameEnd(lobbyId, rankings);
}

// Supprimer un lobby
export function removeLobby(lobbyId: string) {
  activeLobbies.delete(lobbyId);
}

// Supprimer un joueur du lobby
export function removePlayerFromLobby(lobbyId: string, playerId: string) {
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
    BroadcastManager.broadcastLobbyUpdate(lobbyId, lobby);
  }

  return true;
}

// Récupérer un lobby en mémoire (sans vérification d'utilisateur)
export function getLobbyInMemory(lobbyId: string) {
  return activeLobbies.get(lobbyId) || null;
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

  return {
    lobbyId,
    status: lobby.status,
    hostId: lobby.hostId,
    settings: lobby.settings,
    gameState: lobby.gameState,
    players,
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
      players.set(player.id, {
        status: player.status,
        score: player.score || 0,
        progress: player.progress || 0,
        name: player.name,
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

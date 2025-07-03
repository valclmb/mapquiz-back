import { sendToUser } from "./connectionManager.js";

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
    players: new Map([
      [hostId, { status: "joined", score: 0, progress: 0, name: hostName }], // Changer "host" en "joined"
    ]),
    hostId: hostId, // Ajouter explicitement l'ID de l'hôte
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

  lobby.players.set(playerId, {
    status: "joined",
    score: 0,
    progress: 0,
    name: playerName,
  });
  broadcastLobbyUpdate(lobbyId);
  return true;
}

// Mettre à jour le statut d'un joueur
export function updatePlayerStatus(
  lobbyId: string,
  playerId: string,
  status: string
) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby || !lobby.players.has(playerId)) return false;

  const playerData = lobby.players.get(playerId);
  lobby.players.set(playerId, { ...playerData, status });

  // Toujours diffuser la mise à jour du lobby
  broadcastLobbyUpdate(lobbyId);

  // Si tous les joueurs sont prêts, on peut démarrer la partie
  if (status === "ready" && areAllPlayersReady(lobbyId)) {
    // Utiliser une IIFE asynchrone pour gérer l'asynchronicité
    (async () => {
      await startGame(lobbyId);
    })();
  }

  return true;
}

// Vérifier si tous les joueurs sont prêts
function areAllPlayersReady(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return false;

  for (const [playerId, playerData] of lobby.players.entries()) {
    // L'hôte est toujours considéré comme prêt
    if (playerId === lobby.hostId) continue;

    // Les autres joueurs doivent être explicitement prêts
    if (playerData.status !== "ready") {
      return false;
    }
  }

  return true;
}

// Démarrer une partie
async function startGame(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return false;

  // Générer les pays pour la partie
  const countries = await generateCountriesForGame(lobby.settings);

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

  // Mettre à jour tous les joueurs
  for (const [playerId, playerData] of lobby.players.entries()) {
    lobby.players.set(playerId, {
      ...playerData,
      status: "playing",
      score: 0,
      progress: 0,
    });
  }

  broadcastGameStart(lobbyId);
  return true;
}

// Générer les pays pour la partie en fonction des paramètres
import { getCountries } from "../lib/countryService.js";

async function generateCountriesForGame(settings: any) {
  // Récupérer les pays en fonction des régions sélectionnées
  const selectedRegions = settings.selectedRegions || [];
  const countries = await getCountries(selectedRegions);

  return countries;
}

// Fonction utilitaire pour mélanger un tableau
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
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

  // Calculer le score avec bonus de vitesse
  let finalScore = score;

  // Si on a des informations sur le temps de réponse et les réponses consécutives
  if (answerTime !== undefined) {
    // Bonus de vitesse: plus rapide = plus de points
    // Temps de base: 10 secondes
    const speedBonus = Math.max(0, Math.floor(5 - answerTime / 2000));

    // Bonus pour réponses consécutives correctes
    const consecutiveBonus = isConsecutiveCorrect ? 2 : 0;

    // Ajouter les bonus au score
    finalScore += speedBonus + consecutiveBonus;

    // Stocker le score calculé
    lobby.players.set(playerId, {
      ...playerData,
      score: finalScore,
      progress,
      lastAnswerTime: answerTime,
      consecutiveCorrect: isConsecutiveCorrect
        ? (playerData.consecutiveCorrect || 0) + 1
        : 0,
    });
  } else {
    // Si on n'a pas d'informations sur le temps, utiliser le score tel quel
    lobby.players.set(playerId, { ...playerData, score: finalScore, progress });
  }

  // Vérifier si la partie est terminée
  if (progress >= 100) {
    checkGameCompletion(lobbyId, playerId);
  } else {
    broadcastScoreUpdate(lobbyId);
  }

  return true;
}

// Vérifier si la partie est terminée
function checkGameCompletion(lobbyId: string, playerId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  const playerData = lobby.players.get(playerId);
  if (!playerData) return;

  // Marquer ce joueur comme ayant terminé
  lobby.players.set(playerId, { ...playerData, status: "finished" });

  // Vérifier si tous les joueurs ont terminé
  let allFinished = true;
  for (const [_, data] of lobby.players.entries()) {
    if (data.status !== "finished") {
      allFinished = false;
      break;
    }
  }

  if (allFinished) {
    endGame(lobbyId);
  } else {
    broadcastScoreUpdate(lobbyId);
  }
}

// Terminer la partie
function endGame(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  lobby.status = "finished";

  // Calculer le classement
  const rankings = calculateRankings(lobbyId);

  // Envoyer les résultats finaux à tous les joueurs
  broadcastGameEnd(lobbyId, rankings);
}

// Calculer le classement des joueurs
function calculateRankings(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return [];

  // Convertir la Map en tableau pour pouvoir trier
  const entries = Array.from(lobby.players.entries()) as Array<[string, any]>;
  const players = entries.map(([id, data]) => ({
    id,
    ...data,
  }));

  // Trier par score (décroissant) puis par temps (croissant)
  players.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.completionTime - b.completionTime;
  });

  // Ajouter le rang
  return players.map((player, index) => ({
    ...player,
    rank: index + 1,
  }));
}

// Diffuser une mise à jour du lobby à tous les joueurs
function broadcastLobbyUpdate(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  const entries = Array.from(lobby.players.entries()) as Array<[string, any]>;
  const playersList = entries.map(([id, data]) => ({
    id,
    status: data.status,
    name: data.name || id, // Utiliser l'ID comme fallback si le nom n'est pas disponible
  }));

  const message = {
    type: "lobby_update",
    payload: {
      lobbyId,
      status: lobby.status,
      players: playersList,
      settings: lobby.settings,
      hostId: lobby.hostId, // Ajouter l'ID de l'hôte
    },
  };

  // Envoyer à tous les joueurs du lobby
  for (const playerId of lobby.players.keys()) {
    sendToUser(playerId, message);
  }
}

// Diffuser le début de la partie
function broadcastGameStart(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  const message = {
    type: "game_start",
    payload: {
      lobbyId,
      gameState: lobby.gameState,
    },
  };

  // Envoyer à tous les joueurs du lobby
  for (const playerId of lobby.players.keys()) {
    sendToUser(playerId, message);
  }
}

// Diffuser une mise à jour des scores
function broadcastScoreUpdate(lobbyId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  // Use a more explicit approach with type assertion
  const entries = Array.from(lobby.players.entries()) as Array<[string, any]>;
  const playerScores = entries.map(([id, data]) => ({
    id,
    score: data.score,
    progress: data.progress,
    status: data.status,
  }));

  const message = {
    type: "score_update",
    payload: {
      lobbyId,
      players: playerScores,
    },
  };

  // Envoyer à tous les joueurs du lobby
  for (const playerId of lobby.players.keys()) {
    sendToUser(playerId, message);
  }
}

// Diffuser la fin de la partie
function broadcastGameEnd(lobbyId: string, rankings: any[]) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return;

  const message = {
    type: "game_end",
    payload: {
      lobbyId,
      rankings,
    },
  };

  // Envoyer à tous les joueurs du lobby avec vérification
  for (const playerId of lobby.players.keys()) {
    try {
      const sent = sendToUser(playerId, message);
      if (!sent) {
        console.warn(
          `Impossible d'envoyer le message de fin de partie à ${playerId}`
        );
      }
    } catch (error) {
      console.error(`Erreur lors de l'envoi du message à ${playerId}:`, error);
    }
  }
}

// Supprimer un lobby
export function removeLobby(lobbyId: string) {
  return activeLobbies.delete(lobbyId);
}

// Supprimer un joueur d'un lobby
export function removePlayerFromLobby(lobbyId: string, playerId: string) {
  const lobby = activeLobbies.get(lobbyId);
  if (!lobby) return false;

  const result = lobby.players.delete(playerId);

  // Si le lobby est vide, le supprimer
  if (lobby.players.size === 0) {
    activeLobbies.delete(lobbyId);
  } else {
    broadcastLobbyUpdate(lobbyId);
  }

  return result;
}

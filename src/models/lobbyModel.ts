import { prisma } from "../lib/database.js";

/**
 * Modèle ultra-simplifié pour la gestion des lobbies
 */

// Créer un lobby
export const createLobby = async (
  hostId: string,
  name: string,
  settings: any
) => {
  return await prisma.gameLobby.create({
    data: {
      name: name || `Lobby de ${hostId}`,
      hostId,
      gameSettings: settings,
      authorizedPlayers: [hostId],
      players: {
        create: {
          userId: hostId,
          status: "joined",
        },
      },
    },
    include: {
      host: true,
      players: {
        include: {
          user: true,
        },
      },
    },
  });
};

// Récupérer un lobby
export const getLobby = async (lobbyId: string) => {
  return await prisma.gameLobby.findUnique({
    where: { id: lobbyId },
    include: {
      host: true,
      players: {
        include: {
          user: true,
        },
      },
    },
  });
};

// Ajouter un joueur au lobby
export const addPlayerToLobby = async (lobbyId: string, userId: string) => {
  return await prisma.lobbyPlayer.create({
    data: {
      lobbyId,
      userId,
      status: "joined",
    },
  });
};

// Supprimer un joueur du lobby
export const removePlayerFromLobby = async (
  lobbyId: string,
  userId: string
) => {
  return await prisma.lobbyPlayer.delete({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId,
      },
    },
  });
};

// Mettre à jour le statut d'un joueur
export const updatePlayerStatus = async (
  lobbyId: string,
  userId: string,
  status: string
) => {
  return await prisma.lobbyPlayer.update({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId,
      },
    },
    data: { status },
  });
};

// Mettre à jour les données de jeu d'un joueur
export const updatePlayerGameData = async (
  lobbyId: string,
  userId: string,
  score: number,
  progress: number,
  validatedCountries: string[],
  incorrectCountries: string[]
) => {
  return await prisma.lobbyPlayer.update({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId,
      },
    },
    data: {
      score,
      progress,
      validatedCountries,
      incorrectCountries,
    },
  });
};

// Mettre à jour les paramètres du lobby
export const updateLobbySettings = async (lobbyId: string, settings: any) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: {
      gameSettings: settings,
    },
  });
};

// Mettre à jour le statut du lobby
export const updateLobbyStatus = async (lobbyId: string, status: string) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: { status },
  });
};

// Vérifier si tous les joueurs sont prêts
export const areAllPlayersReady = async (lobbyId: string, hostId: string) => {
  const players = await prisma.lobbyPlayer.findMany({
    where: { lobbyId },
  });

  // Tous les joueurs, y compris l'hôte, doivent être prêts
  return players.every((player: any) => player.status === "ready");
};

// Sauvegarder l'état du jeu
export const saveGameState = async (lobbyId: string, gameState: any) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: { gameState },
  });
};

// Sauvegarder un résultat de jeu
export const saveGameResult = async (
  lobbyId: string,
  userId: string,
  score: number,
  totalQuestions: number,
  completionTime?: number,
  position?: number
) => {
  return await prisma.multiplayerGameResult.create({
    data: {
      lobbyId,
      userId,
      score,
      totalQuestions,
      completionTime,
      position,
    },
  });
};

// Supprimer un lobby
export const deleteLobby = async (lobbyId: string) => {
  return await prisma.gameLobby.delete({
    where: { id: lobbyId },
  });
};

// Récupérer les lobbies d'un utilisateur
export const findUserLobbies = async (userId: string) => {
  return await prisma.gameLobby.findMany({
    where: {
      players: {
        some: {
          userId,
        },
      },
    },
    include: {
      host: true,
      players: {
        include: {
          user: true,
        },
      },
    },
  });
};

// Récupérer un joueur dans un lobby
export const getPlayerInLobby = async (lobbyId: string, userId: string) => {
  return await prisma.lobbyPlayer.findUnique({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId,
      },
    },
    include: {
      user: true,
    },
  });
};

// Ajouter un joueur autorisé au lobby
export const addAuthorizedPlayer = async (lobbyId: string, userId: string) => {
  const lobby = await prisma.gameLobby.findUnique({
    where: { id: lobbyId },
  });

  if (!lobby) {
    throw new Error("Lobby non trouvé");
  }

  const authorizedPlayers = lobby.authorizedPlayers || [];
  if (!authorizedPlayers.includes(userId)) {
    authorizedPlayers.push(userId);
  }

  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: { authorizedPlayers },
  });
};

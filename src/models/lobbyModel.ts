import { prisma } from "../lib/database.js";
import type { LobbySettings } from "../types/lobby.js";

/**
 * Modèle ultra-simplifié pour la gestion des lobbies
 */

// Créer un lobby
export const createLobby = async (
  hostId: string,
  name: string,
  settings: LobbySettings
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
  try {
    return await prisma.lobbyPlayer.delete({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
    });
  } catch (error) {
    // Si le joueur n'existe pas, on considère que c'est OK
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }
    throw error;
  }
};

// Mettre à jour le statut d'un joueur
export const updatePlayerStatus = async (
  lobbyId: string,
  userId: string,
  status: string
) => {
  try {
    return await prisma.lobbyPlayer.update({
      where: {
        lobbyId_userId: {
          lobbyId,
          userId,
        },
      },
      data: { status },
    });
  } catch (error) {
    // Si le joueur n'existe pas, on considère que c'est OK
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }
    throw error;
  }
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
  try {
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
  } catch (error) {
    // Si le joueur n'existe pas, on considère que c'est OK
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "P2025"
    ) {
      return null;
    }
    throw error;
  }
};

// Mettre à jour les paramètres du lobby
export const updateLobbySettings = async (
  lobbyId: string,
  settings: LobbySettings
) => {
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

// Mettre à jour l'hôte du lobby
export const updateLobbyHost = async (lobbyId: string, newHostId: string) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: {
      hostId: newHostId,
    },
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
export const saveGameState = async (
  lobbyId: string,
  gameState: Record<string, unknown>
) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: { gameState: gameState as any },
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
    return await prisma.gameLobby.update({
      where: { id: lobbyId },
      data: { authorizedPlayers },
    });
  }

  return lobby;
};

/**
 * Met à jour la liste des joueurs autorisés (ajouter ou retirer)
 */
export const updateLobbyAuthorizedPlayers = async (
  lobbyId: string,
  userId: string,
  action: "add" | "remove"
) => {
  const lobby = await prisma.gameLobby.findUnique({
    where: { id: lobbyId },
    select: { authorizedPlayers: true },
  });

  if (!lobby) {
    throw new Error("Lobby non trouvé");
  }

  let newAuthorizedPlayers: string[];

  if (action === "add") {
    // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
    if (!lobby.authorizedPlayers.includes(userId)) {
      newAuthorizedPlayers = [...lobby.authorizedPlayers, userId];
    } else {
      return; // Déjà dans la liste
    }
  } else {
    // Retirer l'utilisateur de la liste
    newAuthorizedPlayers = lobby.authorizedPlayers.filter(
      (id: string) => id !== userId
    );
  }

  await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: {
      authorizedPlayers: newAuthorizedPlayers,
    },
  });

  console.log(
    `Utilisateur ${userId} ${
      action === "add" ? "ajouté à" : "retiré de"
    } la liste des joueurs autorisés du lobby ${lobbyId}`
  );
};

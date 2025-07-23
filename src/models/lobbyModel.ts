import { prisma } from "../lib/database.js";

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
      authorizedPlayers: [hostId], // L'hôte est automatiquement autorisé
      players: {
        create: {
          userId: hostId,
          status: "joined", // Changer "host" en "joined"
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

export const addPlayerToLobby = async (
  lobbyId: string,
  userId: string,
  status: string
) => {
  return await prisma.lobbyPlayer.create({
    data: {
      lobbyId,
      userId,
      status,
    },
  });
};

export const getPlayerInLobby = async (lobbyId: string, userId: string) => {
  return await prisma.lobbyPlayer.findUnique({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId,
      },
    },
  });
};

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
    data: {
      status,
    },
  });
};

export const removePlayerFromLobby = async (
  lobbyId: string,
  userId: string
) => {
  // D'abord vérifier si le joueur existe dans le lobby
  const existingPlayer = await prisma.lobbyPlayer.findUnique({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId,
      },
    },
  });

  // Si le joueur n'existe pas, ne rien faire
  if (!existingPlayer) {
    console.log(
      `Joueur ${userId} non trouvé dans le lobby ${lobbyId}, suppression ignorée`
    );
    return null;
  }

  // Supprimer le joueur s'il existe
  return await prisma.lobbyPlayer.delete({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId,
      },
    },
  });
};

/**
 * Ajoute un utilisateur à la liste des joueurs autorisés
 */
export const addAuthorizedPlayer = async (lobbyId: string, userId: string) => {
  const lobby = await prisma.gameLobby.findUnique({
    where: { id: lobbyId },
    select: { authorizedPlayers: true },
  });

  if (!lobby) {
    throw new Error("Lobby non trouvé");
  }

  // Ajouter l'utilisateur s'il n'est pas déjà dans la liste
  if (!lobby.authorizedPlayers.includes(userId)) {
    await prisma.gameLobby.update({
      where: { id: lobbyId },
      data: {
        authorizedPlayers: {
          push: userId,
        },
      },
    });
    console.log(
      `Utilisateur ${userId} ajouté aux joueurs autorisés du lobby ${lobbyId}`
    );
  } else {
    console.log(
      `Utilisateur ${userId} déjà dans les joueurs autorisés du lobby ${lobbyId}`
    );
  }
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
      (id) => id !== userId
    );
  }

  await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: {
      authorizedPlayers: newAuthorizedPlayers,
    },
  });

  console.log(
    `Utilisateur ${userId} ${action === "add" ? "ajouté à" : "retiré de"} la liste des joueurs autorisés du lobby ${lobbyId}`
  );
};

export const updateLobbySettings = async (lobbyId: string, settings: any) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: {
      gameSettings: settings,
    },
  });
};

export const updateLobbyStatus = async (lobbyId: string, status: string) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: {
      status,
    },
  });
};

export const updateLobbyHost = async (lobbyId: string, newHostId: string) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: {
      hostId: newHostId,
    },
  });
};

export const getLobbyPlayers = async (lobbyId: string) => {
  return await prisma.lobbyPlayer.findMany({
    where: { lobbyId },
    include: {
      user: true,
    },
  });
};

export const deleteLobby = async (lobbyId: string) => {
  return await prisma.gameLobby.delete({
    where: { id: lobbyId },
  });
};

export const saveGameResult = async (
  lobbyId: string,
  userId: string,
  score: number,
  totalQuestions: number
) => {
  return await prisma.multiplayerGameResult.create({
    data: {
      lobbyId,
      userId,
      score,
      totalQuestions,
      completionTime: Math.floor(Date.now() / 1000), // Timestamp en secondes
    },
  });
};

export const saveGameState = async (lobbyId: string, gameState: any) => {
  return await prisma.gameLobby.update({
    where: { id: lobbyId },
    data: {
      gameState,
    },
  });
};

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

export const getLobbyWithGameState = async (lobbyId: string) => {
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

export const getLobbiesByPlayer = async (userId: string) => {
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

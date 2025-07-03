import { prisma } from "@/lib/database.js";

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
  return await prisma.lobbyPlayer.delete({
    where: {
      lobbyId_userId: {
        lobbyId,
        userId,
      },
    },
  });
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

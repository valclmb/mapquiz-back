import * as LobbyModel from "../models/lobbyModel.js";
import * as UserModel from "../models/userModel.js";
import { sendToUser } from "../websocket/connectionManager.js";
import * as LobbyManager from "../websocket/lobbyManager.js";

export const createLobby = async (
  userId: string,
  name: string,
  settings: any
) => {
  // Récupérer les informations de l'utilisateur pour obtenir son nom
  const user = await UserModel.findUserById(userId);

  if (!user) {
    throw new Error("Utilisateur non trouvé");
  }

  // Créer le lobby dans la base de données
  const lobby = await LobbyModel.createLobby(userId, name, settings);

  // Créer le lobby en mémoire pour la gestion en temps réel
  LobbyManager.createLobby(lobby.id, userId, user.name, settings);

  // Ajouter les informations des joueurs dans la réponse
  return {
    success: true,
    lobby,
    players: [
      {
        id: userId,
        name: user.name,
        status: "joined", // Changer "host" en "joined"
      },
    ],
    hostId: userId, // Ajouter explicitement l'ID de l'hôte
    settings,
  };
};

export const inviteToLobby = async (
  hostId: string,
  lobbyId: string,
  friendId: string
) => {
  // Vérifier que l'utilisateur est bien l'hôte du lobby
  const lobby = await LobbyModel.getLobby(lobbyId);
  if (!lobby || lobby.hostId !== hostId) {
    throw new Error("Non autorisé");
  }

  // Vérifier si le joueur est déjà dans le lobby
  const existingPlayer = await LobbyModel.getPlayerInLobby(lobbyId, friendId);

  // Si le joueur n'existe pas déjà, l'ajouter au lobby
  if (!existingPlayer) {
    await LobbyModel.addPlayerToLobby(lobbyId, friendId, "invited");
  }

  // Envoyer une notification à l'ami (même s'il est déjà invité)
  sendToUser(friendId, {
    type: "lobby_invitation",
    payload: {
      lobbyId,
      hostId,
      hostName: lobby.host.name,
      lobbyName: lobby.name,
    },
  });

  return { success: true, message: "Invitation envoyée" };
};

export const joinLobby = async (userId: string, lobbyId: string) => {
  // Vérifier que le lobby existe et que l'utilisateur est invité
  const player = await LobbyModel.getPlayerInLobby(lobbyId, userId);
  if (!player) {
    throw new Error("Invitation non trouvée");
  }

  // Récupérer les informations de l'utilisateur pour obtenir son nom
  const user = await UserModel.findUserById(userId);

  if (!user) {
    throw new Error("Utilisateur non trouvé");
  }

  // Mettre à jour le statut du joueur dans la base de données
  await LobbyModel.updatePlayerStatus(lobbyId, userId, "joined");

  // Ajouter le joueur au lobby en mémoire avec son nom
  LobbyManager.addPlayerToLobby(lobbyId, userId, user.name);

  // Récupérer les joueurs du lobby pour les renvoyer
  const players = await LobbyModel.getLobbyPlayers(lobbyId);
  const lobby = await LobbyModel.getLobby(lobbyId);

  return {
    success: true,
    message: "Lobby rejoint",
    lobby: {
      id: lobbyId,
      name: lobby?.name,
    },
    hostId: lobby?.hostId, // Ajouter l'ID de l'hôte
    players: players.map((p) => ({
      id: p.userId,
      name: p.user.name,
      status: p.status,
    })),
    settings: lobby?.gameSettings,
  };
};

export const leaveLobby = async (userId: string, lobbyId: string) => {
  // Supprimer le joueur du lobby dans la base de données
  await LobbyModel.removePlayerFromLobby(lobbyId, userId);

  // Supprimer le joueur du lobby en mémoire
  LobbyManager.removePlayerFromLobby(lobbyId, userId);

  // Si c'était l'hôte, supprimer le lobby
  const lobby = await LobbyModel.getLobby(lobbyId);
  if (lobby && lobby.hostId === userId) {
    await LobbyModel.deleteLobby(lobbyId);
    LobbyManager.removeLobby(lobbyId);
  }

  return { success: true, message: "Lobby quitté" };
};

export const updateLobbySettings = async (
  userId: string,
  lobbyId: string,
  settings: any
) => {
  // Vérifier que l'utilisateur est bien l'hôte du lobby
  const lobby = await LobbyModel.getLobby(lobbyId);
  if (!lobby || lobby.hostId !== userId) {
    throw new Error("Non autorisé");
  }

  // Mettre à jour les paramètres du lobby dans la base de données
  await LobbyModel.updateLobbySettings(lobbyId, settings);

  return { success: true, message: "Paramètres mis à jour" };
};

export const setPlayerReady = async (
  userId: string,
  lobbyId: string,
  ready: boolean
) => {
  // Vérifier que le joueur est bien dans le lobby
  const player = await LobbyModel.getPlayerInLobby(lobbyId, userId);
  if (!player) {
    throw new Error("Joueur non trouvé dans le lobby");
  }

  // Mettre à jour le statut du joueur dans la base de données
  const status = ready ? "ready" : "joined";
  await LobbyModel.updatePlayerStatus(lobbyId, userId, status);

  // Mettre à jour le statut du joueur en mémoire
  LobbyManager.updatePlayerStatus(lobbyId, userId, status);

  return {
    success: true,
    message: ready ? "Prêt" : "Pas prêt",
  };
};

export const startGame = async (userId: string, lobbyId: string) => {
  // Vérifier que l'utilisateur est bien l'hôte du lobby
  const lobby = await LobbyModel.getLobby(lobbyId);
  if (!lobby || lobby.hostId !== userId) {
    throw new Error("Non autorisé");
  }

  // Vérifier que tous les joueurs sont prêts
  const players = await LobbyModel.getLobbyPlayers(lobbyId);
  const allReady = players.every(
    (p) => p.status === "ready" || p.userId === userId // L'hôte est toujours considéré comme prêt
  );
  if (!allReady) {
    throw new Error("Tous les joueurs ne sont pas prêts");
  }

  // Mettre à jour le statut du lobby dans la base de données
  await LobbyModel.updateLobbyStatus(lobbyId, "playing");

  // Démarrer la partie en mémoire
  LobbyManager.updatePlayerStatus(lobbyId, userId, "ready");

  return { success: true, message: "Partie démarrée" };
};

export const updateGameProgress = async (
  userId: string,
  lobbyId: string,
  score: number,
  progress: number,
  answerTime?: number,
  isConsecutiveCorrect?: boolean
) => {
  // Vérifier que le joueur est bien dans le lobby
  const player = await LobbyModel.getPlayerInLobby(lobbyId, userId);
  if (!player) {
    throw new Error("Joueur non trouvé dans le lobby");
  }

  // Mettre à jour le score et la progression en mémoire
  LobbyManager.updatePlayerScore(
    lobbyId,
    userId,
    score,
    progress,
    answerTime,
    isConsecutiveCorrect
  );

  // Si le joueur a terminé, enregistrer son résultat
  if (progress >= 100) {
    const lobby = await LobbyModel.getLobby(lobbyId);
    if (lobby && lobby.gameSettings && typeof lobby.gameSettings === "object") {
      const totalQuestions =
        "totalQuestions" in lobby.gameSettings
          ? (lobby.gameSettings.totalQuestions as number)
          : 0;

      await LobbyModel.saveGameResult(lobbyId, userId, score, totalQuestions);
    }
  }

  return { success: true };
};

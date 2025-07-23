import { prisma } from "../../lib/database.js";
import { APP_CONSTANTS } from "../../lib/config.js";
import * as LobbyManager from "../../websocket/lobby/lobbyManager.js";

/**
 * Service pour gérer le nettoyage automatique des lobbies inactifs
 */
export class LobbyCleanupService {
  /**
   * Marque un joueur comme déconnecté
   */
  static async markPlayerAsDisconnected(userId: string, lobbyId: string): Promise<void> {
    try {
      await prisma.lobbyPlayer.updateMany({
        where: {
          lobbyId: lobbyId,
          userId: userId,
        },
        data: {
          status: APP_CONSTANTS.PLAYER_STATUS.DISCONNECTED,
          disconnectedAt: new Date(),
        },
      });

      console.log(`Joueur ${userId} marqué comme déconnecté dans le lobby ${lobbyId}`);
    } catch (error) {
      console.error(`Erreur lors du marquage du joueur ${userId} comme déconnecté:`, error);
    }
  }

  /**
   * Restaure un joueur déconnecté
   */
  static async restoreDisconnectedPlayer(userId: string, lobbyId: string): Promise<void> {
    try {
      await prisma.lobbyPlayer.updateMany({
        where: {
          lobbyId: lobbyId,
          userId: userId,
        },
        data: {
          status: APP_CONSTANTS.PLAYER_STATUS.JOINED,
          disconnectedAt: null,
        },
      });

      console.log(`Joueur ${userId} restauré dans le lobby ${lobbyId}`);
    } catch (error) {
      console.error(`Erreur lors de la restauration du joueur ${userId}:`, error);
    }
  }

  /**
   * Supprime un joueur déconnecté du lobby (appelé par l'hôte)
   */
  static async removeDisconnectedPlayer(userId: string, lobbyId: string, hostId: string): Promise<void> {
    try {
      // Vérifier que l'utilisateur est bien l'hôte
      const lobby = await prisma.gameLobby.findUnique({
        where: { id: lobbyId },
      });

      if (!lobby || lobby.hostId !== hostId) {
        throw new Error("Non autorisé à supprimer des joueurs");
      }

      // Supprimer le joueur
      await prisma.lobbyPlayer.deleteMany({
        where: {
          lobbyId: lobbyId,
          userId: userId,
        },
      });

      // Supprimer du lobby en mémoire
      const lobbyInMemory = LobbyManager.getLobbyInMemory(lobbyId);
      if (lobbyInMemory) {
        LobbyManager.removePlayerFromLobby(lobbyId, userId);
      }

      console.log(`Joueur déconnecté ${userId} supprimé du lobby ${lobbyId} par l'hôte ${hostId}`);
    } catch (error) {
      console.error(`Erreur lors de la suppression du joueur déconnecté ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Met à jour le timestamp de dernière activité d'un lobby
   */
  static async updateLobbyActivity(lobbyId: string): Promise<void> {
    try {
      await prisma.gameLobby.update({
        where: { id: lobbyId },
        data: {
          lastActivityAt: new Date(),
        },
      });
    } catch (error) {
      console.error(`Erreur lors de la mise à jour de l'activité du lobby ${lobbyId}:`, error);
    }
  }

  /**
   * Nettoie les lobbies inactifs (appelé périodiquement)
   */
  static async cleanupInactiveLobbies(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - APP_CONSTANTS.TIMEOUTS.LOBBY_CLEANUP_DELAY);

      // Trouver les lobbies inactifs
      const inactiveLobbies = await prisma.gameLobby.findMany({
        where: {
          lastActivityAt: {
            lt: cutoffTime,
          },
          status: {
            not: "playing", // Ne pas supprimer les lobbies en cours de jeu
          },
        },
        include: {
          players: true,
        },
      });

      console.log(`Nettoyage de ${inactiveLobbies.length} lobby(s) inactif(s)`);

      for (const lobby of inactiveLobbies) {
        try {
          // Vérifier si tous les joueurs sont déconnectés
          const allDisconnected = lobby.players.every(
            player => player.status === APP_CONSTANTS.PLAYER_STATUS.DISCONNECTED
          );

          if (allDisconnected || lobby.players.length === 0) {
            // Supprimer le lobby et ses joueurs
            await prisma.lobbyPlayer.deleteMany({
              where: { lobbyId: lobby.id },
            });

            await prisma.gameLobby.delete({
              where: { id: lobby.id },
            });

            // Supprimer du lobby en mémoire
            LobbyManager.removeLobby(lobby.id);

            console.log(`Lobby inactif ${lobby.id} supprimé`);
          }
        } catch (error) {
          console.error(`Erreur lors de la suppression du lobby ${lobby.id}:`, error);
        }
      }
    } catch (error) {
      console.error("Erreur lors du nettoyage des lobbies inactifs:", error);
    }
  }

  /**
   * Nettoie les joueurs déconnectés depuis trop longtemps
   */
  static async cleanupDisconnectedPlayers(): Promise<void> {
    try {
      const cutoffTime = new Date(Date.now() - APP_CONSTANTS.TIMEOUTS.PLAYER_DISCONNECT_TIMEOUT);

      // Trouver les joueurs déconnectés depuis trop longtemps
      const disconnectedPlayers = await prisma.lobbyPlayer.findMany({
        where: {
          status: APP_CONSTANTS.PLAYER_STATUS.DISCONNECTED,
          disconnectedAt: {
            lt: cutoffTime,
          },
        },
        include: {
          lobby: true,
        },
      });

      console.log(`Nettoyage de ${disconnectedPlayers.length} joueur(s) déconnecté(s)`);

      for (const player of disconnectedPlayers) {
        try {
          // Supprimer le joueur
          await prisma.lobbyPlayer.delete({
            where: { id: player.id },
          });

          // Supprimer du lobby en mémoire
          const lobbyInMemory = LobbyManager.getLobbyInMemory(player.lobbyId);
          if (lobbyInMemory) {
            LobbyManager.removePlayerFromLobby(player.lobbyId, player.userId);
          }

          console.log(`Joueur déconnecté ${player.userId} supprimé du lobby ${player.lobbyId}`);

          // Vérifier si le lobby est maintenant vide
          const remainingPlayers = await prisma.lobbyPlayer.findMany({
            where: { lobbyId: player.lobbyId },
          });

          if (remainingPlayers.length === 0) {
            // Supprimer le lobby vide
            await prisma.gameLobby.delete({
              where: { id: player.lobbyId },
            });

            LobbyManager.removeLobby(player.lobbyId);

            console.log(`Lobby vide ${player.lobbyId} supprimé`);
          }
        } catch (error) {
          console.error(`Erreur lors de la suppression du joueur déconnecté ${player.userId}:`, error);
        }
      }
    } catch (error) {
      console.error("Erreur lors du nettoyage des joueurs déconnectés:", error);
    }
  }

  /**
   * Démarre le service de nettoyage automatique
   */
  static startCleanupService(): void {
    // Nettoyer les lobbies inactifs toutes les 5 minutes
    setInterval(() => {
      this.cleanupInactiveLobbies();
    }, 5 * 60 * 1000);

    // Nettoyer les joueurs déconnectés toutes les minutes
    setInterval(() => {
      this.cleanupDisconnectedPlayers();
    }, 60 * 1000);

    console.log("Service de nettoyage automatique démarré");
  }
} 
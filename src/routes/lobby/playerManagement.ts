import { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/auth.js";
import { LobbyCleanupService } from "../../services/lobby/lobbyCleanupService.js";

/**
 * Routes pour la gestion des joueurs dans les lobbies
 */
export async function playerManagementRoutes(fastify: FastifyInstance) {
  // Supprimer un joueur déconnecté (seulement l'hôte peut le faire)
  fastify.delete(
    "/lobbies/:lobbyId/players/:userId",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { lobbyId, userId } = request.params as {
        lobbyId: string;
        userId: string;
      };
      const hostId = (request as any).user.id;

      try {
        await LobbyCleanupService.removeDisconnectedPlayer(
          userId,
          lobbyId,
          hostId
        );

        return {
          success: true,
          message: "Joueur déconnecté supprimé avec succès",
        };
      } catch (error) {
        if (error instanceof Error) {
          if (error.message === "Non autorisé à supprimer des joueurs") {
            return reply.status(403).send({
              success: false,
              error:
                "Vous devez être l'hôte du lobby pour supprimer des joueurs",
            });
          }
        }

        return reply.status(500).send({
          success: false,
          error: "Erreur lors de la suppression du joueur",
        });
      }
    }
  );

  // Obtenir la liste des joueurs déconnectés dans un lobby
  fastify.get(
    "/lobbies/:lobbyId/disconnected-players",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      const { lobbyId } = request.params as { lobbyId: string };
      const userId = (request as any).user.id;

      try {
        // Vérifier que l'utilisateur est dans le lobby
        const { prisma } = await import("../../lib/database.js");
        const player = await prisma.lobbyPlayer.findUnique({
          where: {
            lobbyId_userId: {
              lobbyId,
              userId,
            },
          },
        });

        if (!player) {
          return reply.status(403).send({
            success: false,
            error:
              "Vous devez être dans le lobby pour voir les joueurs déconnectés",
          });
        }

        // Récupérer les joueurs déconnectés
        const disconnectedPlayers = await prisma.lobbyPlayer.findMany({
          where: {
            lobbyId,
            status: "disconnected",
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        });

        return {
          success: true,
          disconnectedPlayers: disconnectedPlayers.map((player) => ({
            id: player.user.id,
            name: player.user.name,
          })),
        };
      } catch (error) {
        return reply.status(500).send({
          success: false,
          error: "Erreur lors de la récupération des joueurs déconnectés",
        });
      }
    }
  );
}

import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/database.js";
import { requireAuth } from "../../middleware/auth.js";

interface AddFriendRequest {
  Body: {
    tag: string;
  };
}

export async function addFriendRoute(fastify: FastifyInstance) {
  fastify.post<AddFriendRequest>(
    "/add",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const currentUserId = (request as any).user.id;
        const { tag } = request.body;

        if (!tag) {
          return reply.status(400).send({ error: "Tag requis" });
        }

        // Trouver l'utilisateur par son tag
        const friendUser = await prisma.user.findUnique({
          where: { tag },
        });

        if (!friendUser) {
          return reply.status(404).send({
            error: "Utilisateur non trouvé",
          });
        }

        if (friendUser.id === currentUserId) {
          return reply.status(400).send({
            error: "Vous ne pouvez pas vous ajouter vous-même",
          });
        }

        // Vérifier si une relation d'amitié existe déjà
        const existingFriendship = await prisma.friend.findUnique({
          where: {
            userId_friendId: {
              userId: currentUserId,
              friendId: friendUser.id,
            },
          },
        });

        if (existingFriendship) {
          return reply.status(400).send({
            error: "Vous êtes déjà amis avec cet utilisateur",
          });
        }

        // Vérifier si une demande en attente existe déjà
        const pendingRequest = await prisma.friendRequest.findFirst({
          where: {
            senderId: currentUserId,
            receiverId: friendUser.id,
            status: "pending",
          },
        });

        if (pendingRequest) {
          return reply.status(400).send({
            error: "Une demande est déjà en attente",
          });
        }

        // Supprimer les anciennes demandes d'amitié entre ces utilisateurs
        await prisma.friendRequest.deleteMany({
          where: {
            OR: [
              { senderId: currentUserId, receiverId: friendUser.id },
              { senderId: friendUser.id, receiverId: currentUserId },
            ],
          },
        });

        // Créer une nouvelle demande d'ami
        await prisma.friendRequest.create({
          data: {
            senderId: currentUserId,
            receiverId: friendUser.id,
          },
        });

        return reply.send({
          success: true,
          message: "Demande d'ami envoyée",
        });
      } catch (error) {
        fastify.log.error("Erreur lors de l'ajout d'ami:", error);
        return reply.status(500).send({
          error: "Une erreur est survenue lors de l'ajout d'ami",
        });
      }
    }
  );
}

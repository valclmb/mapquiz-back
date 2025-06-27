import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/database.js";
import { requireAuth } from "../../middleware/auth.js";

interface FriendRequestActionRequest {
  Body: {
    action: "accept" | "reject";
  };
  Params: {
    id: string;
  };
}

export async function friendRequestsRoutes(fastify: FastifyInstance) {
  // GET /requests - Récupérer les demandes d'amitié reçues
  fastify.get(
    "/requests",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user.id;

        const friendRequests = await prisma.friendRequest.findMany({
          where: {
            receiverId: userId,
            status: "pending",
          },
          include: {
            sender: {
              select: {
                id: true,
                name: true,
                image: true,
                tag: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return reply.send({ friendRequests });
      } catch (error) {
        fastify.log.error(
          "Erreur lors de la récupération des demandes d'amitié:",
          error
        );
        return reply.status(500).send({
          error:
            "Une erreur est survenue lors de la récupération des demandes d'amitié",
        });
      }
    }
  );

  // PATCH /request/:id - Accepter ou refuser une demande d'amitié
  fastify.patch<FriendRequestActionRequest>(
    "/requests/:id",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user.id;
        const { action } = request.body;
        const requestId = request.params.id;

        if (!action || !["accept", "reject"].includes(action)) {
          return reply.status(400).send({ error: "Action non valide" });
        }

        const friendRequest = await prisma.friendRequest.findFirst({
          where: {
            id: requestId,
            receiverId: userId,
            status: "pending",
          },
        });

        if (!friendRequest) {
          return reply.status(404).send({
            error: "Demande d'ami non trouvée",
          });
        }

        if (action === "accept") {
          await prisma.$transaction([
            prisma.friendRequest.update({
              where: { id: requestId },
              data: { status: "accepted" },
            }),
            prisma.friend.create({
              data: {
                userId: userId,
                friendId: friendRequest.senderId,
              },
            }),
            prisma.friend.create({
              data: {
                userId: friendRequest.senderId,
                friendId: userId,
              },
            }),
          ]);

          return reply.send({ message: "Demande d'ami acceptée" });
        } else if (action === "reject") {
          await prisma.friendRequest.update({
            where: { id: requestId },
            data: { status: "rejected" },
          });

          return reply.send({ message: "Demande d'ami refusée" });
        }
      } catch (error) {
        fastify.log.error(
          "Erreur lors du traitement de la demande d'amitié:",
          error
        );
        return reply.status(500).send({
          error:
            "Une erreur est survenue lors du traitement de la demande d'amitié",
        });
      }
    }
  );
}

import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/database.js";
import { requireAuth } from "../../middleware/auth.js";

interface RemoveFriendRequest {
  Body: {
    friendId: string;
  };
}

export async function removeFriendRoute(fastify: FastifyInstance) {
  fastify.delete<RemoveFriendRequest>(
    "/remove",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user.id;
        const { friendId } = request.body;

        if (!friendId) {
          return reply.status(400).send({ error: "ID d'ami requis" });
        }

        await prisma.$transaction([
          prisma.friend.deleteMany({
            where: {
              userId: userId,
              friendId: friendId,
            },
          }),
          prisma.friend.deleteMany({
            where: {
              userId: friendId,
              friendId: userId,
            },
          }),
        ]);

        return reply.send({
          success: true,
          message: "Ami supprimé avec succès",
        });
      } catch (error) {
        fastify.log.error("Erreur lors de la suppression de l'ami:", error);
        return reply.status(500).send({
          error: "Erreur lors de la suppression de l'ami",
        });
      }
    }
  );
}

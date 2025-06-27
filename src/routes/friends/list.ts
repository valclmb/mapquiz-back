import { FastifyInstance } from "fastify";
import { prisma } from "../../lib/database.js";
import { requireAuth } from "../../middleware/auth.js";

export async function listFriendsRoute(fastify: FastifyInstance) {
  fastify.get(
    "/list",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const userId = (request as any).user.id;

        const friends = await prisma.friend.findMany({
          where: {
            userId: userId,
          },
          include: {
            friend: {
              select: {
                id: true,
                name: true,
                image: true,
                tag: true,
                isOnline: true,
                lastSeen: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        return reply.send({
          friends: friends.map((f) => f.friend),
        });
      } catch (error) {
        fastify.log.error("Erreur lors de la récupération des amis:", error);
        return reply.status(500).send({
          error: "Une erreur est survenue lors de la récupération des amis",
        });
      }
    }
  );
}

import { FastifyInstance } from "fastify";
import { prisma } from "../lib/database.js";
import { generateRandomTag } from "../lib/generateTag";
import { requireAuth } from "../middleware/auth.js";

export async function usersRoutes(fastify: FastifyInstance) {
  // Route pour générer ou récupérer un tag pour l'utilisateur connecté
  fastify.get(
    "/user/tag",
    {
      preHandler: requireAuth,
    },
    async (request, reply) => {
      try {
        const userId = request.user?.id; // Plus d'erreur TypeScript !

        // Vérifier si l'utilisateur a déjà un tag
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { tag: true },
        });

        // Si l'utilisateur a déjà un tag, le renvoyer
        if (user?.tag) {
          return reply.send({ tag: user.tag });
        }

        // Sinon, générer un nouveau tag unique
        let isUnique = false;
        let newTag = "";

        while (!isUnique) {
          newTag = generateRandomTag(); // Utilise la longueur par défaut de 6

          // Vérifier que le tag n'existe pas déjà
          const existingUser = await prisma.user.findUnique({
            where: { tag: newTag },
          });

          if (!existingUser) {
            isUnique = true;
          }
        }

        // Mettre à jour l'utilisateur avec le nouveau tag
        await prisma.user.update({
          where: { id: userId },
          data: { tag: newTag },
        });

        return reply.send({ tag: newTag });
      } catch (error) {
        fastify.log.error(
          "Erreur lors de la génération du tag utilisateur:",
          error
        );
        return reply.status(500).send({ error: "Erreur interne du serveur" });
      }
    }
  );
}

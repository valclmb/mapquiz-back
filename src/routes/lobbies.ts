import { FastifyInstance } from "fastify";
import { getLobby } from "../models/lobbyModel.js";

export async function lobbiesRoutes(fastify: FastifyInstance) {
  // GET /api/lobbies/:lobbyId/status
  fastify.get("/:lobbyId/status", async (request, reply) => {
    const { lobbyId } = request.params as { lobbyId: string };

    try {
      const lobby = await getLobby(lobbyId);

      if (!lobby) {
        return reply.status(404).send({
          error: "Lobby non trouvé",
          message: "Le lobby demandé n'existe pas",
        });
      }

      return {
        status: lobby.status,
        lobbyId: lobby.id,
      };
    } catch (error) {
      console.error(
        "Erreur lors de la récupération du statut du lobby:",
        error
      );
      return reply.status(500).send({
        error: "Erreur serveur",
        message: "Impossible de récupérer le statut du lobby",
      });
    }
  });
}

import { FastifyReply, FastifyRequest } from "fastify";
import { auth } from "../lib/auth.js";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // Convert Fastify headers to standard Headers object
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) headers.append(key, value.toString());
    });

    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      return reply.status(401).send({ error: "Non autorisé" });
    }

    // Attacher l'utilisateur à la requête
    (request as any).user = session.user;
    (request as any).session = session;
  } catch (error) {
    return reply.status(401).send({ error: "Token invalide" });
  }
}

export async function optionalAuth(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    // En mode test, utiliser le header x-user-id pour simuler l'authentification
    if (process.env.NODE_ENV === "test") {
      const userId = request.headers["x-user-id"] as string;
      if (userId) {
        // Simuler un utilisateur pour les tests
        (request as any).user = { id: userId };
        return;
      }
    }

    // Convert Fastify headers to standard Headers object
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) headers.append(key, value.toString());
    });

    const session = await auth.api.getSession({ headers });

    // Attacher l'utilisateur à la requête s'il existe
    if (session?.user) {
      (request as any).user = session.user;
      (request as any).session = session;
    }
    // Si pas d'utilisateur, on continue sans bloquer
  } catch (error) {
    // En cas d'erreur, on continue sans bloquer
    console.log("Auth optionnelle échouée:", error);
  }
}

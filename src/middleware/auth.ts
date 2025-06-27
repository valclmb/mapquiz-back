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

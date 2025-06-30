import { FastifyBaseLogger, FastifyReply } from "fastify";

export const handleError = (
  error: unknown,
  reply: FastifyReply,
  logger: FastifyBaseLogger
) => {
  const message = error instanceof Error ? error.message : "Erreur inconnue";

  const statusCode = getHttpStatusFromError(message);

  logger.error("Erreur:", error);
  return reply.status(statusCode).send({ error: message });
};

function getHttpStatusFromError(message: string): number {
  if (message.includes("requis")) return 400;
  if (message.includes("non trouvé") || message.includes("introuvable"))
    return 404;
  if (message.includes("déjà") || message.includes("invalide")) return 400;
  if (message.includes("autorisé")) return 403;
  return 500;
}

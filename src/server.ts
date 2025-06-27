import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import Fastify from "fastify";
import { prisma } from "./lib/database.js";
import { apiRoutes } from "./routes";

const fastify = Fastify({
  logger: {
    level: "info",
  },
});

// Plugins de sécurité
await fastify.register(helmet);
await fastify.register(cors, {
  origin: process.env.BETTER_AUTH_URL,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  credentials: true,
  maxAge: 86400,
});
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Routes de base
fastify.get("/", async (request, reply) => {
  return {
    message: "API Fastify + Prisma",
    version: "1.0.0",
    endpoints: {
      users: "/users",
      posts: "/posts",
    },
  };
});

fastify.get("/health", async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return {
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    reply.status(503).send({
      status: "error",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

// Enregistrement de toutes les routes API avec préfixe
await fastify.register(apiRoutes, { prefix: "/api" });

// Gestion des erreurs globales
fastify.setErrorHandler((error, request, reply) => {
  fastify.log.error(error);
  reply.status(500).send({
    error: "Erreur interne du serveur",
    message: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

// Gestion de l'arrêt propre
process.on("SIGINT", async () => {
  await fastify.close();
  await prisma.$disconnect();
  process.exit(0);
});

// Démarrage du serveur
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port: Number(port), host: "0.0.0.0" });
    console.log(`🚀 Serveur démarré sur le port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

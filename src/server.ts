import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { prisma } from "./lib/database.js";
import { handleError } from "./lib/errorHandler.js";
import { apiRoutes } from "./routes/index.js";
import { setupWebSocketHandlers } from "./websocket/handlers.js";

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
  allowedHeaders: [
    "Content-Type",
    "Authorization",
    "X-Requested-With",
    "Cookie",
  ],
  credentials: true,
  maxAge: 86400,
});
await fastify.register(rateLimit, {
  max: 100,
  timeWindow: "1 minute",
});

// Plugin WebSocket
await fastify.register(websocket);

// Routes de base
fastify.get("/", async (request, reply) => {
  return {
    message: "API Fastify + Prisma",
    version: "1.0.0",
    endpoints: {
      api: "/api",
      websocket: "/ws",
      health: "/health",
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

// Configuration des WebSockets
setupWebSocketHandlers(fastify);

// Gestion des erreurs globales
fastify.setErrorHandler((error, request, reply) => {
  handleError(error, reply, fastify.log);
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
    console.log(`🔌 WebSocket disponible sur ws://localhost:${port}/ws`);
    console.log(
      `📊 Health check disponible sur http://localhost:${port}/health`
    );
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();

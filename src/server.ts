import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { config } from "./lib/config.js";
import { prisma } from "./lib/database.js";
import { errorHandler } from "./lib/errorHandler.js";
import { apiRoutes } from "./routes/index.js";
import { setupWebSocketHandlers } from "./websocket/index.js";

/**
 * Configuration du serveur Fastify
 */
const fastify = Fastify({
  logger: {
    level: "warn", // ou "error" pour n'avoir que les erreurs
    // serializers: { req: () => undefined }, // (optionnel) pour ne pas logger les req du tout
  },
});

/**
 * Configuration des plugins de sécurité et middleware
 */
async function setupPlugins() {
  // Plugin de sécurité Helmet
  await fastify.register(helmet);

  // Configuration CORS
  await fastify.register(cors, config.cors);

  // Limitation de débit
  await fastify.register(rateLimit, config.rateLimit);

  // Plugin WebSocket
  await fastify.register(websocket);
}

// Configuration des plugins de sécurité et middleware
await setupPlugins();

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

// Pour désactiver les logs Fastify sur les requêtes WebSocket
fastify.addHook("onRequest", (req, reply, done) => {
  if (req.url === "/ws") {
    req.log.info = () => {};
  }
  done();
});

// Gestion des erreurs globales
fastify.setErrorHandler(errorHandler);

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

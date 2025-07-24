import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import websocket from "@fastify/websocket";
import Fastify from "fastify";
import { config } from "./lib/config.js";
import { prisma } from "./lib/database.js";
import { errorHandler } from "./lib/errorHandler.js";
import { loggers } from "./config/logger.js";
import { apiRoutes } from "./routes/index.js";
import { LobbyCleanupService } from "./services/lobby/lobbyCleanupService.js";
import { setupWebSocketHandlers } from "./websocket/index.js";

/**
 * Configuration optimisée du serveur Fastify
 */
const fastify = Fastify({
  logger: {
    level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    serializers: { 
      req: (req) => ({
        method: req.method,
        url: req.url,
        headers: req.headers
      }),
      res: (res) => ({
        statusCode: res.statusCode
      })
    }
  },
  trustProxy: true,
  keepAliveTimeout: 5000,
  maxParamLength: 200,
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

// Démarrage du service de nettoyage automatique des lobbies
LobbyCleanupService.startCleanupService();

// Optimisations des hooks
fastify.addHook("onRequest", (req, reply, done) => {
  // Désactiver les logs verbeux pour WebSocket
  if (req.url === "/ws" && process.env.NODE_ENV === 'production') {
    req.log.info = () => {};
    req.log.debug = () => {};
  }
  done();
});

// Hook de performance monitoring
fastify.addHook("onResponse", (req, reply, done) => {
  const responseTime = reply.getResponseTime();
  if (responseTime > 1000) { // > 1s
    loggers.lobby.warn('Requête lente détectée', {
      method: req.method,
      url: req.url,
      responseTime: `${responseTime}ms`,
      statusCode: reply.statusCode
    });
  }
  done();
});

// Gestion optimisée des erreurs
fastify.setErrorHandler(errorHandler);

// Gestion gracieuse de l'arrêt
const gracefulShutdown = async (signal: string) => {
  loggers.lobby.info(`Signal ${signal} reçu, arrêt gracieux en cours...`);
  
  try {
    // Arrêter le service de nettoyage
    LobbyCleanupService.stopCleanupService();
    
    // Fermer les connexions WebSocket
    await fastify.close();
    
    // Fermer la base de données
    await prisma.$disconnect();
    
    loggers.lobby.info('Arrêt gracieux terminé');
    process.exit(0);
  } catch (error) {
    loggers.lobby.error('Erreur lors de l\'arrêt gracieux', { error });
    process.exit(1);
  }
};

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));

// Gestion des erreurs non capturées
process.on('uncaughtException', (error) => {
  loggers.lobby.error('Exception non capturée', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  loggers.lobby.error('Promesse rejetée non gérée', { reason, promise });
});

// Démarrage optimisé du serveur
const start = async () => {
  try {
    const port = Number(process.env.PORT) || 3000;
    const host = process.env.HOST || "0.0.0.0";
    
    await fastify.listen({ port, host });
    
    loggers.lobby.info('🚀 Serveur démarré avec succès', {
      port,
      host,
      env: process.env.NODE_ENV || 'development',
      websocket: `ws://${host === '0.0.0.0' ? 'localhost' : host}:${port}/ws`,
      health: `http://${host === '0.0.0.0' ? 'localhost' : host}:${port}/health`
    });
    
  } catch (err) {
    loggers.lobby.error('Erreur au démarrage du serveur', { 
      error: err instanceof Error ? err.message : 'Unknown error'
    });
    process.exit(1);
  }
};

// Lancement du serveur
start();

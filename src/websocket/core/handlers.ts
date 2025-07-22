import { WebSocket } from "@fastify/websocket";
import { FastifyInstance } from "fastify";
import { WebSocketMessage, WS_MESSAGE_TYPES } from "../../types/websocket.js";
import { WebSocketMessageHandler } from "../messaging/messageHandler.js";
import {
  authenticateInitialConnection,
  authenticateWebSocketUser,
  sendErrorResponse,
} from "./authentication.js";
import { WebSocketConnectionHandler } from "./connectionHandler.js";

/**
 * Configuration des gestionnaires WebSocket
 */
export const setupWebSocketHandlers = (fastify: FastifyInstance) => {
  fastify.register(async function (fastify) {
    fastify.get("/ws", { websocket: true }, (socket: WebSocket, request) => {
      let userId: string | null = null;

      // Gérer la nouvelle connexion
      WebSocketConnectionHandler.handleNewConnection(socket);

      socket.on("message", async (message: Buffer) => {
        try {
          const messageString = message.toString();
          // console.log("Message reçu:", messageString);

          const data: WebSocketMessage = JSON.parse(messageString);
          const { type, payload } = data;

          // Traitement spécial pour l'authentification
          if (type === WS_MESSAGE_TYPES.AUTHENTICATE) {
            const authResult = await authenticateInitialConnection(
              request,
              socket
            );
            if (authResult) {
              userId = authResult.user.id;
              await WebSocketConnectionHandler.handleAuthentication(
                socket,
                authResult.user.id,
                request
              );
            }
            return;
          }

          // Authentification pour les autres messages
          if (type !== WS_MESSAGE_TYPES.PING) {
            const authResult = await authenticateWebSocketUser(request, socket);
            if (!authResult) {
              return;
            }
            userId = authResult.user.id;
          }

          // Traiter le message
          await WebSocketMessageHandler.handleMessage(data, socket, userId);
        } catch (error) {
          console.error("Erreur lors du traitement du message:", error);
          const errorMessage =
            error instanceof Error ? error.message : "Erreur inconnue";
          sendErrorResponse(socket, errorMessage);
        }
      });
    });
  });
};

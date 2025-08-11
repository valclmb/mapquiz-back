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
      let isAuthenticated = false;

      // Gérer la nouvelle connexion
      WebSocketConnectionHandler.handleNewConnection(socket);

      socket.on("message", async (message: Buffer) => {
        try {
          const messageString = message.toString();
          // console.log("Message reçu:", messageString);

          let data: WebSocketMessage;
          try {
            data = JSON.parse(messageString);
          } catch (parseError) {
            sendErrorResponse(socket, "Message JSON invalide");
            return;
          }

          const { type, payload } = data;

          // Traitement spécial pour l'authentification
          if (type === WS_MESSAGE_TYPES.AUTHENTICATE) {
            const authResult = await authenticateInitialConnection(
              request,
              socket
            );
            if (authResult) {
              userId = authResult.user.id;
              isAuthenticated = true;
              await WebSocketConnectionHandler.handleAuthentication(
                socket,
                authResult.user.id,
                request
              );
            }
            return;
          }

          // Authentification pour les autres messages (seulement si pas déjà authentifié)
          if (type !== WS_MESSAGE_TYPES.PING && !isAuthenticated) {
            const authResult = await authenticateWebSocketUser(request, socket);
            if (!authResult) {
              return;
            }
            userId = authResult.user.id;
            isAuthenticated = true;

            // Configurer les gestionnaires d'événements de fermeture (seulement la première fois)
            await WebSocketConnectionHandler.handleAuthentication(
              socket,
              authResult.user.id,
              request,
              false // Ne pas envoyer le message "authenticated" lors des authentifications suivantes
            );
          } else if (type !== WS_MESSAGE_TYPES.PING && isAuthenticated) {
            // Si déjà authentifié, juste récupérer l'userId si nécessaire
            if (!userId) {
              const authResult = await authenticateWebSocketUser(
                request,
                socket
              );
              if (!authResult) {
                return;
              }
              userId = authResult.user.id;
            }
          }

          // Traiter le message
          await WebSocketMessageHandler.handleMessage(data, socket, userId);
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Erreur inconnue";
          sendErrorResponse(socket, errorMessage);
        }
      });
    });
  });
};

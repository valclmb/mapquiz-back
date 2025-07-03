import { WebSocket } from "@fastify/websocket";
import { FastifyInstance } from "fastify";
import * as WebSocketController from "../controllers/websocketController.js";
import { auth } from "../lib/auth.js";
import * as FriendService from "../services/friendService.js";
import { addConnection, removeConnection } from "./connectionManager.js";

// Types pour les messages WebSocket
interface WebSocketMessage {
  type: string;
  payload: any;
}

export const setupWebSocketHandlers = (fastify: FastifyInstance) => {
  fastify.register(async function (fastify) {
    fastify.get("/ws", { websocket: true }, (socket: WebSocket, request) => {
      console.log("Nouvelle connexion WebSocket établie");
      let userId: string | null = null;

      // Confirmer la connexion
      socket.send(
        JSON.stringify({
          type: "connected",
          message: "Connexion WebSocket établie",
        })
      );

      socket.on("message", async (message: Buffer) => {
        try {
          const messageString = message.toString();
          console.log("Message reçu:", messageString);

          const data: WebSocketMessage = JSON.parse(messageString);
          const { type, payload } = data;

          // Authentification pour les messages qui en ont besoin
          if (type !== "ping" && type !== "authenticate") {
            try {
              const headers = new Headers();
              Object.entries(request.headers).forEach(([key, value]) => {
                if (value) {
                  if (Array.isArray(value)) {
                    headers.append(key, value[0]);
                  } else {
                    headers.append(key, value);
                  }
                }
              });

              const session = await auth.api.getSession({ headers });

              if (!session?.user) {
                socket.send(
                  JSON.stringify({
                    type: "error",
                    message: "Non authentifié - veuillez vous connecter",
                  })
                );
                return;
              }

              (request as any).user = session.user;
              (request as any).session = session;
            } catch (authError) {
              console.error("Erreur d'authentification:", authError);
              socket.send(
                JSON.stringify({
                  type: "authentication_error",
                  message: "Erreur d'authentification",
                })
              );
              return;
            }
          }

          let userId = (request as any).user?.id;

          let result;
          switch (type) {
            case "ping":
              socket.send(
                JSON.stringify({
                  type: "pong",
                  timestamp: Date.now(),
                })
              );
              break;

            case "authenticate":
              try {
                const headers = new Headers();
                Object.entries(request.headers).forEach(([key, value]) => {
                  if (value) {
                    if (Array.isArray(value)) {
                      headers.append(key, value[0]);
                    } else {
                      headers.append(key, value);
                    }
                  }
                });

                const session = await auth.api.getSession({ headers });

                if (session?.user) {
                  userId = session.user.id;
                  (request as any).user = session.user;

                  // Dans la partie authenticate du switch case, après addConnection :
                  addConnection(userId, socket);
                  // Notifier les amis que l'utilisateur est en ligne
                  await FriendService.notifyFriendsOfStatusChange(userId, true);

                  // Dans l'événement onclose, après removeConnection :
                  socket.on("close", (code: number, reason: Buffer) => {
                    if (userId) {
                      removeConnection(userId);
                      // Notifier les amis que l'utilisateur est hors ligne
                      FriendService.notifyFriendsOfStatusChange(userId, false);
                    }
                    console.log(
                      `WebSocket fermé - Code: ${code}, Raison: ${reason.toString()}`
                    );
                  });

                  // Également dans l'événement onerror :
                  socket.on("error", (error: Error) => {
                    if (userId) {
                      removeConnection(userId);
                      // Notifier les amis que l'utilisateur est hors ligne
                      FriendService.notifyFriendsOfStatusChange(userId, false);
                    }
                    console.error("Erreur WebSocket:", error);
                  });

                  socket.send(
                    JSON.stringify({
                      type: "authenticated",
                      data: { userId: session.user.id },
                    })
                  );
                } else {
                  socket.send(
                    JSON.stringify({
                      type: "authentication_failed",
                      message: "Session invalide",
                    })
                  );
                }
              } catch (error) {
                socket.send(
                  JSON.stringify({
                    type: "authentication_error",
                    message: "Erreur d'authentification",
                  })
                );
              }
              break;

            case "send_friend_request":
              if (!userId) {
                socket.send(
                  JSON.stringify({
                    type: "error",
                    message: "Authentification requise",
                  })
                );
                return;
              }
              result = await WebSocketController.handleSendFriendRequest(
                payload,
                userId
              );
              break;

            case "respond_friend_request":
              if (!userId) {
                socket.send(
                  JSON.stringify({
                    type: "error",
                    message: "Authentification requise",
                  })
                );
                return;
              }
              result = await WebSocketController.handleRespondFriendRequest(
                payload,
                userId
              );
              break;

            default:
              socket.send(
                JSON.stringify({
                  type: "error",
                  message: `Type de message non supporté: ${type}`,
                })
              );
              return;
          }

          if (result) {
            socket.send(
              JSON.stringify({
                type: `${type}_success`,
                data: result,
              })
            );
          }
        } catch (error) {
          console.error("Erreur lors du traitement du message:", error);
          socket.send(
            JSON.stringify({
              type: "error",
              message:
                error instanceof Error ? error.message : "Erreur inconnue",
            })
          );
        }
      });

      socket.on("close", (code: number, reason: Buffer) => {
        if (userId) {
          removeConnection(userId);
        }
        console.log(
          `WebSocket fermé - Code: ${code}, Raison: ${reason.toString()}`
        );
      });

      socket.on("error", (error: Error) => {
        // 🔥 NOUVEAU : Supprimer la connexion en cas d'erreur
        if (userId) {
          removeConnection(userId);
        }
        console.error("Erreur WebSocket:", error);
      });
    });
  });
};

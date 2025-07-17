import { WebSocket } from "@fastify/websocket";
import { auth } from "../../lib/auth.js";
import { WebSocketResponse } from "../../types/websocket.js";

/**
 * Interface pour les requêtes WebSocket authentifiées
 */
export interface AuthenticatedRequest {
  user: any;
  session: any;
}

/**
 * Authentifie un utilisateur via WebSocket
 */
export async function authenticateWebSocketUser(
  request: any,
  socket: WebSocket
): Promise<AuthenticatedRequest | null> {
  try {
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          headers.append(key, value[0]);
        } else {
          headers.append(key, value.toString());
        }
      }
    });

    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      sendErrorResponse(socket, "Non authentifié - veuillez vous connecter");
      return null;
    }

    return {
      user: session.user,
      session: session,
    };
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    sendErrorResponse(socket, "Erreur d'authentification");
    return null;
  }
}

/**
 * Authentifie un utilisateur pour la connexion initiale
 */
export async function authenticateInitialConnection(
  request: any,
  socket: WebSocket
): Promise<AuthenticatedRequest | null> {
  try {
    const headers = new Headers();
    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) {
        if (Array.isArray(value)) {
          headers.append(key, value[0]);
        } else {
          headers.append(key, value.toString());
        }
      }
    });

    const session = await auth.api.getSession({ headers });

    if (!session?.user) {
      sendErrorResponse(socket, "Session invalide", "authentication_failed");
      return null;
    }

    return {
      user: session.user,
      session: session,
    };
  } catch (error) {
    console.error("Erreur d'authentification:", error);
    sendErrorResponse(
      socket,
      "Erreur d'authentification",
      "authentication_error"
    );
    return null;
  }
}

/**
 * Envoie une réponse d'erreur au client WebSocket
 */
export function sendErrorResponse(
  socket: WebSocket,
  message: string,
  type: string = "error",
  lobbyId?: string
): void {
  const response: WebSocketResponse = {
    type,
    message,
    ...(lobbyId && { lobbyId }),
  };
  socket.send(JSON.stringify(response));
}

/**
 * Envoie une réponse de succès au client WebSocket
 */
export function sendSuccessResponse(
  socket: WebSocket,
  data: any,
  type: string,
  lobbyId?: string
): void {
  const response: WebSocketResponse = {
    type,
    data,
    ...(lobbyId && { lobbyId }),
  };
  socket.send(JSON.stringify(response));
}

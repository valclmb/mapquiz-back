// Types spécifiques aux messages WebSocket
export interface WebSocketConnection {
  userId: string;
  socket: any;
  connectedAt: Date;
}

export interface WebSocketMessageContext {
  socket: any;
  userId: string | null;
  request: any;
}

export interface WebSocketHandler {
  type: string;
  handler: (payload: any, context: WebSocketMessageContext) => Promise<any>;
  requireAuth: boolean;
}

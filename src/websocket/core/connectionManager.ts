const connections = new Map<string, WebSocket>();

export function addConnection(userId: string, socket: WebSocket) {
  connections.set(userId, socket);
  // console.log(`Utilisateur ${userId} connecté via WebSocket`);
}

export function removeConnection(userId: string) {
  connections.delete(userId);
  // console.log(`Utilisateur ${userId} déconnecté`);
}

export function sendToUser(userId: string, message: any): boolean {
  const socket = connections.get(userId);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
    return true;
  }
  return false; // Utilisateur pas connecté = on s'en fou
}

export function isUserConnected(userId: string): boolean {
  const socket = connections.get(userId);
  return socket ? socket.readyState === WebSocket.OPEN : false;
}

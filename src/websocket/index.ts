// Export des services WebSocket principaux
export { WebSocketConnectionHandler } from "./core/connectionHandler.js";
export { setupWebSocketHandlers } from "./core/handlers.js";
export { WebSocketMessageHandler } from "./messaging/messageHandler.js";

// Export des gestionnaires spécialisés
export { BroadcastManager } from "./lobby/broadcastManager.js";
export { GameStateManager } from "./lobby/gameStateManager.js";
export { PlayerManager } from "./lobby/playerManager.js";

// Export des utilitaires
export * from "./core/authentication.js";
export * from "./core/connectionManager.js";
export * from "./messaging/types.js";
export * from "./utils/constants.js";

// Export du gestionnaire de lobby (maintenu pour compatibilité)
export * from "./lobby/lobbyManager.js";

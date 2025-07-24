/**
 * Stub temporaire pour LobbyManager
 * À remplacer par la vraie implémentation une fois que tous les services sont optimisés
 */
export class LobbyManager {
  static createLobby(lobbyId: string, hostId: string, name: string, settings: any): void {
    // Stub - implémentation temporaire
  }

  static startGame(lobbyId: string): void {
    // Stub - implémentation temporaire
  }

  static getGameState(lobbyId: string): any {
    // Stub - implémentation temporaire
    return null;
  }

  static updateLobbySettings(lobbyId: string, settings: any): void {
    // Stub - implémentation temporaire
  }

  static updatePlayerProgress(lobbyId: string, userId: string, progressData: any): boolean {
    // Stub - implémentation temporaire
    return false;
  }

  static addPlayerToLobby(lobbyId: string, userId: string): void {
    // Stub - implémentation temporaire
  }

  static removePlayerFromLobby(lobbyId: string, userId: string): boolean {
    // Stub - implémentation temporaire
    return false;
  }

  static updatePlayerStatus(lobbyId: string, userId: string, status: string): void {
    // Stub - implémentation temporaire
  }

  static updatePlayerAbsence(lobbyId: string, userId: string, absent: boolean): void {
    // Stub - implémentation temporaire
  }

  static removeLobby(lobbyId: string): void {
    // Stub - implémentation temporaire
  }

  static getLobbyState(lobbyId: string): any {
    // Stub - implémentation temporaire
    return null;
  }

  static restartGame(lobbyId: string): void {
    // Stub - implémentation temporaire
  }

  static getGameResults(lobbyId: string): any {
    // Stub - implémentation temporaire
    return null;
  }

  static endGame(lobbyId: string): void {
    // Stub - implémentation temporaire
  }
}
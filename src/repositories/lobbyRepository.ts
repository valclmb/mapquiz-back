import type { GameLobby, LobbyPlayer, User } from '../../generated/prisma/index.js';
import { prisma } from '../lib/database.js';
import { BaseRepository, queryCache } from '../core/database/repository.js';
import { LobbySettings } from '../types/index.js';
import { APP_CONSTANTS } from '../lib/config.js';

/**
 * Types pour les inclusions Prisma
 */
export type LobbyWithDetails = GameLobby & {
  host: User;
  players: (LobbyPlayer & { user: User })[];
};

export type LobbyPlayerWithUser = LobbyPlayer & { user: User };

/**
 * Repository optimisé pour les lobbies
 */
export class LobbyRepository extends BaseRepository<GameLobby> {
  constructor() {
    super(prisma);
  }

  /**
   * Inclusion standard pour les requêtes de lobby
   */
  private readonly defaultInclude = {
    host: true,
    players: {
      include: {
        user: true,
      },
    },
  };

  /**
   * Crée un nouveau lobby
   */
  async create(
    hostId: string,
    name: string,
    settings: LobbySettings = {}
  ): Promise<LobbyWithDetails> {
    return this.executeQuery(
      () => this.prisma.gameLobby.create({
        data: {
          name: name || `Lobby de ${hostId}`,
          hostId,
          gameSettings: settings,
          authorizedPlayers: [hostId],
          players: {
            create: {
              userId: hostId,
              status: APP_CONSTANTS.PLAYER_STATUS.JOINED,
            },
          },
        },
        include: this.defaultInclude,
      }),
      `create lobby for host ${hostId}`
    );
  }

  /**
   * Trouve un lobby par ID avec cache
   */
  async findById(lobbyId: string, useCache = true): Promise<LobbyWithDetails | null> {
    const cacheKey = `lobby:${lobbyId}`;
    
    if (useCache) {
      const cached = queryCache.get<LobbyWithDetails>(cacheKey);
      if (cached) return cached;
    }

    const lobby = await this.executeQuery(
      () => this.prisma.gameLobby.findUnique({
        where: { id: lobbyId },
        include: this.defaultInclude,
      }),
      `find lobby ${lobbyId}`
    );

    if (lobby && useCache) {
      queryCache.set(cacheKey, lobby, 30000); // Cache 30s
    }

    return lobby as LobbyWithDetails | null;
  }

  /**
   * Trouve un lobby par ID ou lance une erreur
   */
  async findByIdOrThrow(lobbyId: string): Promise<LobbyWithDetails> {
    const lobby = await this.findById(lobbyId, false);
    if (!lobby) {
      throw new Error(`Lobby non trouvé: ${lobbyId}`);
    }
    return lobby;
  }

  /**
   * Met à jour les paramètres d'un lobby
   */
  async updateSettings(lobbyId: string, settings: LobbySettings): Promise<void> {
    await this.executeQuery(
      () => this.prisma.gameLobby.update({
        where: { id: lobbyId },
        data: { gameSettings: settings },
      }),
      `update lobby settings ${lobbyId}`
    );

    // Invalider le cache
    queryCache.delete(`lobby:${lobbyId}`);
  }

  /**
   * Met à jour le statut d'un lobby
   */
  async updateStatus(lobbyId: string, status: string): Promise<void> {
    await this.executeQuery(
      () => this.prisma.gameLobby.update({
        where: { id: lobbyId },
        data: { status },
      }),
      `update lobby status ${lobbyId} to ${status}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
  }

  /**
   * Supprime un lobby
   */
  async delete(lobbyId: string): Promise<void> {
    await this.executeQuery(
      () => this.prisma.gameLobby.delete({
        where: { id: lobbyId },
      }),
      `delete lobby ${lobbyId}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
  }

  /**
   * Ajoute un joueur autorisé au lobby
   */
  async addAuthorizedPlayer(lobbyId: string, userId: string): Promise<void> {
    const lobby = await this.findById(lobbyId, false);
    if (!lobby) throw new Error(`Lobby non trouvé: ${lobbyId}`);

    const newAuthorizedPlayers = [...lobby.authorizedPlayers, userId];

    await this.executeQuery(
      () => this.prisma.gameLobby.update({
        where: { id: lobbyId },
        data: { authorizedPlayers: newAuthorizedPlayers },
      }),
      `add authorized player ${userId} to lobby ${lobbyId}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
  }

  /**
   * Trouve les lobbies inactifs
   */
  async findInactiveLobbies(olderThanMs: number): Promise<GameLobby[]> {
    const cutoffDate = new Date(Date.now() - olderThanMs);

    return this.executeQuery(
      () => this.prisma.gameLobby.findMany({
        where: {
          updatedAt: {
            lt: cutoffDate,
          },
          status: {
            not: APP_CONSTANTS.LOBBY_STATUS.FINISHED,
          },
        },
      }),
      `find inactive lobbies older than ${olderThanMs}ms`
    );
  }

  /**
   * Trouve les lobbies vides (sans joueurs actifs)
   */
  async findEmptyLobbies(): Promise<GameLobby[]> {
    return this.executeQuery(
      () => this.prisma.gameLobby.findMany({
        where: {
          players: {
            none: {},
          },
        },
      }),
      'find empty lobbies'
    );
  }

  /**
   * Gestion des joueurs dans les lobbies
   */
  async addPlayer(
    lobbyId: string,
    userId: string,
    status: string = APP_CONSTANTS.PLAYER_STATUS.JOINED
  ): Promise<LobbyPlayerWithUser> {
    const result = await this.executeQuery(
      () => this.prisma.lobbyPlayer.create({
        data: {
          lobbyId,
          userId,
          status,
        },
        include: {
          user: true,
        },
      }),
      `add player ${userId} to lobby ${lobbyId}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
    return result as LobbyPlayerWithUser;
  }

  async findPlayer(lobbyId: string, userId: string): Promise<LobbyPlayerWithUser | null> {
    return this.executeQuery(
      () => this.prisma.lobbyPlayer.findUnique({
        where: {
          lobbyId_userId: { lobbyId, userId },
        },
        include: {
          user: true,
        },
      }),
      `find player ${userId} in lobby ${lobbyId}`
    );
  }

  async updatePlayerStatus(
    lobbyId: string,
    userId: string,
    status: string
  ): Promise<void> {
    await this.executeQuery(
      () => this.prisma.lobbyPlayer.update({
        where: {
          lobbyId_userId: { lobbyId, userId },
        },
        data: { status },
      }),
      `update player ${userId} status to ${status} in lobby ${lobbyId}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
  }

  async updatePlayerAbsence(
    lobbyId: string,
    userId: string,
    absent: boolean
  ): Promise<void> {
    await this.executeQuery(
      () => this.prisma.lobbyPlayer.update({
        where: {
          lobbyId_userId: { lobbyId, userId },
        },
        data: { isAbsent: absent },
      }),
      `update player ${userId} absence to ${absent} in lobby ${lobbyId}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
  }

  async removePlayer(lobbyId: string, userId: string): Promise<void> {
    await this.executeQuery(
      () => this.prisma.lobbyPlayer.delete({
        where: {
          lobbyId_userId: { lobbyId, userId },
        },
      }),
      `remove player ${userId} from lobby ${lobbyId}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
  }

  async updatePlayerProgress(
    lobbyId: string,
    userId: string,
    progressData: {
      validatedCountries?: string[];
      incorrectCountries?: string[];
      score?: number;
      gameData?: any;
    }
  ): Promise<void> {
    await this.executeQuery(
      () => this.prisma.lobbyPlayer.update({
        where: {
          lobbyId_userId: { lobbyId, userId },
        },
        data: progressData,
      }),
      `update player ${userId} progress in lobby ${lobbyId}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
  }

  /**
   * Supprime tous les joueurs déconnectés d'un lobby
   */
  async removeDisconnectedPlayers(lobbyId: string): Promise<number> {
    const result = await this.executeQuery(
      () => this.prisma.lobbyPlayer.deleteMany({
        where: {
          lobbyId,
          status: APP_CONSTANTS.PLAYER_STATUS.DISCONNECTED,
        },
      }),
      `remove disconnected players from lobby ${lobbyId}`
    );

    queryCache.delete(`lobby:${lobbyId}`);
    return (result as any).count;
  }
}

// Instance singleton du repository
export const lobbyRepository = new LobbyRepository();
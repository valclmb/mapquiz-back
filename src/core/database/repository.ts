import { PrismaClient } from '../../generated/prisma/index.js';
import { loggers } from '../../config/logger.js';

/**
 * Repository de base avec fonctionnalités communes
 */
export abstract class BaseRepository<T = any> {
  protected prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    this.prisma = prisma;
  }

  /**
   * Exécute une requête avec gestion d'erreurs et logs
   */
  protected async executeQuery<R>(
    operation: () => Promise<R>,
    context: string
  ): Promise<R> {
    try {
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      loggers.lobby.debug(`DB Query executed`, {
        context,
        duration: `${duration}ms`,
        hasResult: !!result
      });
      
      return result;
    } catch (error) {
      loggers.lobby.error(`DB Query failed`, {
        context,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Trouve un enregistrement par ID avec validation
   */
  protected async findByIdOrThrow<R>(
    findOperation: () => Promise<R | null>,
    errorMessage: string,
    id: string
  ): Promise<R> {
    const result = await findOperation();
    if (!result) {
      throw new Error(`${errorMessage}: ${id}`);
    }
    return result;
  }
}

/**
 * Cache simple en mémoire pour les requêtes fréquentes
 */
class QueryCache {
  private cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  set(key: string, data: any, ttlMs: number = 60000): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlMs
    });
  }

  get<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    if (Date.now() - cached.timestamp > cached.ttl) {
      this.cache.delete(key);
      return null;
    }

    return cached.data as T;
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

export const queryCache = new QueryCache();
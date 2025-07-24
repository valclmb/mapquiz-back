/**
 * Configuration centralisée des logs
 */
export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
}

class Logger {
  private level: LogLevel;
  private isDevelopment: boolean;

  constructor() {
    this.level = process.env.LOG_LEVEL 
      ? parseInt(process.env.LOG_LEVEL) 
      : LogLevel.WARN;
    this.isDevelopment = process.env.NODE_ENV !== 'production';
  }

  private shouldLog(level: LogLevel): boolean {
    return level <= this.level;
  }

  private formatMessage(level: string, message: string, context?: any): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] ${level}: ${message}${contextStr}`;
  }

  error(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.ERROR)) {
      console.error(this.formatMessage('ERROR', message, context));
    }
  }

  warn(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.WARN)) {
      console.warn(this.formatMessage('WARN', message, context));
    }
  }

  info(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.INFO)) {
      console.info(this.formatMessage('INFO', message, context));
    }
  }

  debug(message: string, context?: any): void {
    if (this.shouldLog(LogLevel.DEBUG) && this.isDevelopment) {
      console.log(this.formatMessage('DEBUG', message, context));
    }
  }
}

export const logger = new Logger();

/**
 * Utilitaires pour les logs contextuels
 */
export const loggers = {
  lobby: {
    info: (message: string, context?: any) => logger.info(`[LOBBY] ${message}`, context),
    warn: (message: string, context?: any) => logger.warn(`[LOBBY] ${message}`, context),
    debug: (message: string, context?: any) => logger.debug(`[LOBBY] ${message}`, context),
    error: (message: string, context?: any) => logger.error(`[LOBBY] ${message}`, context),
  },
  websocket: {
    info: (message: string, context?: any) => logger.info(`[WS] ${message}`, context),
    warn: (message: string, context?: any) => logger.warn(`[WS] ${message}`, context),
    debug: (message: string, context?: any) => logger.debug(`[WS] ${message}`, context),
    error: (message: string, context?: any) => logger.error(`[WS] ${message}`, context),
  },
  player: {
    info: (message: string, context?: any) => logger.info(`[PLAYER] ${message}`, context),
    warn: (message: string, context?: any) => logger.warn(`[PLAYER] ${message}`, context),
    debug: (message: string, context?: any) => logger.debug(`[PLAYER] ${message}`, context),
    error: (message: string, context?: any) => logger.error(`[PLAYER] ${message}`, context),
  },
  game: {
    info: (message: string, context?: any) => logger.info(`[GAME] ${message}`, context),
    warn: (message: string, context?: any) => logger.warn(`[GAME] ${message}`, context),
    debug: (message: string, context?: any) => logger.debug(`[GAME] ${message}`, context),
    error: (message: string, context?: any) => logger.error(`[GAME] ${message}`, context),
  },
};
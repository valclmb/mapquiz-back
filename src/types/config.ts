// Types pour les erreurs
export interface AppError extends Error {
  statusCode: number;
  code: string;
}

// Types pour la configuration
export interface AppConfig {
  port: number;
  host: string;
  cors: {
    origin: boolean | string[];
    methods: string[];
    allowedHeaders: string[];
    credentials: boolean;
    maxAge: number;
  };
  rateLimit: {
    max: number;
    timeWindow: string;
  };
}

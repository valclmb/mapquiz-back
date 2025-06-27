import type { Session, User } from "better-auth/types";

// Étendre les types Fastify avec les types better-auth
declare module "fastify" {
  interface FastifyRequest {
    user?: User;
    session?: Session;
  }
}

export interface CreateUserRequest {
  email: string;
  name?: string;
}

export interface UpdateUserRequest {
  email?: string;
  name?: string;
}

export interface CreatePostRequest {
  title: string;
  content?: string;
  published?: boolean;
  authorId: number;
}

export interface UpdatePostRequest {
  title?: string;
  content?: string;
  published?: boolean;
}

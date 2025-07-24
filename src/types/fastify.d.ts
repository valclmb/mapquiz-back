import { FastifyReply } from 'fastify';

declare module 'fastify' {
  interface FastifyReply {
    getResponseTime(): number;
  }
}
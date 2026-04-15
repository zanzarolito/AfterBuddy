import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import fp from 'fastify-plugin';

import postgresPlugin from './plugins/postgres.js';
import redisPlugin from './plugins/redis.js';

import healthRoutes from './routes/health.js';
import sessionRoutes from './routes/sessions.js';
import participantRoutes from './routes/participants.js';
import suggestionRoutes from './routes/suggestions.js';
import voteRoutes from './routes/votes.js';
import eventsRoutes from './routes/events.js';
import stationRoutes from './routes/stations.js';

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL ?? 'info',
    transport:
      process.env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty' }
        : undefined,
  },
});

// Plugins
await fastify.register(cors, {
  origin: process.env.CORS_ORIGIN ?? '*',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
});
await fastify.register(sensible);
await fastify.register(fp(postgresPlugin));
await fastify.register(fp(redisPlugin));

// Routes
await fastify.register(healthRoutes);
await fastify.register(sessionRoutes);
await fastify.register(participantRoutes);
await fastify.register(suggestionRoutes);
await fastify.register(voteRoutes);
await fastify.register(eventsRoutes);
await fastify.register(stationRoutes);

// Start
const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? '0.0.0.0';

try {
  await fastify.listen({ port, host });
  fastify.log.info(`AfterBuddy API listening on http://${host}:${port}`);
} catch (err) {
  fastify.log.error(err);
  process.exit(1);
}

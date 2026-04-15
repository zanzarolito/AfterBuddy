/**
 * GET /health
 *
 * Returns 200 if Postgres and Redis are reachable, 503 otherwise.
 * Used by Docker health checks and orchestrators.
 */
export default async function healthRoutes(fastify) {
  fastify.get('/health', { logLevel: 'warn' }, async (request, reply) => {
    const checks = {};
    let healthy = true;

    // Postgres
    try {
      await fastify.db.query('SELECT 1');
      checks.postgres = 'ok';
    } catch (err) {
      checks.postgres = 'error';
      healthy = false;
    }

    // Redis
    try {
      await fastify.redis.ping();
      checks.redis = 'ok';
    } catch (err) {
      checks.redis = 'error';
      healthy = false;
    }

    reply.code(healthy ? 200 : 503).send({
      status: healthy ? 'ok' : 'degraded',
      checks,
      timestamp: new Date().toISOString(),
    });
  });
}

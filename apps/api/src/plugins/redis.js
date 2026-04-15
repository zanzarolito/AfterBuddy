import fp from 'fastify-plugin';
import Redis from 'ioredis';

export default fp(async function redisPlugin(fastify) {
  const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
  });

  await redis.ping();

  fastify.decorate('redis', redis);

  fastify.addHook('onClose', async () => {
    await redis.quit();
  });
});

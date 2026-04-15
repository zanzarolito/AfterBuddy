import fp from 'fastify-plugin';
import pg from 'pg';

const { Pool } = pg;

export default fp(async function postgresPlugin(fastify) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  // Verify connectivity on startup.
  await pool.query('SELECT 1');

  fastify.decorate('db', pool);

  fastify.addHook('onClose', async () => {
    await pool.end();
  });
});

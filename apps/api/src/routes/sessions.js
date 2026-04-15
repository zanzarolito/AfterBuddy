/**
 * Session routes
 *
 * POST   /api/sessions           → Create a new session
 * GET    /api/sessions/:id       → Get session state
 * DELETE /api/sessions/:id       → Close a session early
 */
const SESSION_TTL_SECONDS = 24 * 60 * 60; // 24 hours

export default async function sessionRoutes(fastify) {
  // ── POST /api/sessions ──────────────────────────────────────────────────
  fastify.post('/api/sessions', async (request, reply) => {
    // Persist to Postgres for durability.
    const { rows } = await fastify.db.query(
      `INSERT INTO sessions DEFAULT VALUES
       RETURNING id, created_at, expires_at, status`,
    );
    const session = rows[0];

    // Mirror state in Redis for fast reads (participants list, vote tallies).
    await fastify.redis.setex(
      `session:${session.id}`,
      SESSION_TTL_SECONDS,
      JSON.stringify({ participants: [], suggestions: [], status: 'open' }),
    );

    reply.code(201).send({
      id: session.id,
      createdAt: session.created_at,
      expiresAt: session.expires_at,
      shareUrl: `${process.env.API_BASE_URL?.replace('/api', '') ?? ''}/session/${session.id}`,
    });
  });

  // ── GET /api/sessions/:id ───────────────────────────────────────────────
  fastify.get('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params;

    // Fast path: Redis.
    const cached = await fastify.redis.get(`session:${id}`);
    if (cached) {
      const sessionMeta = await fastify.db.query(
        `SELECT id, created_at, expires_at, status
         FROM sessions WHERE id = $1`,
        [id],
      );
      if (sessionMeta.rows.length === 0) {
        return reply.notFound('Session not found');
      }
      const { rows: participants } = await fastify.db.query(
        `SELECT p.id, p.nom, s.nom AS station_nom, s.ligne,
                ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat
         FROM participants p
         JOIN stations s ON s.id = p.station_id
         WHERE p.session_id = $1
         ORDER BY p.joined_at`,
        [id],
      );
      return {
        ...sessionMeta.rows[0],
        participants,
      };
    }

    // Slow path: Postgres only (Redis evicted).
    const { rows } = await fastify.db.query(
      `SELECT id, created_at, expires_at, status FROM sessions WHERE id = $1`,
      [id],
    );
    if (rows.length === 0) {
      return reply.notFound('Session not found');
    }

    const { rows: participants } = await fastify.db.query(
      `SELECT p.id, p.nom, s.nom AS station_nom, s.ligne,
              ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat
       FROM participants p
       JOIN stations s ON s.id = p.station_id
       WHERE p.session_id = $1
       ORDER BY p.joined_at`,
      [id],
    );

    return { ...rows[0], participants };
  });

  // ── DELETE /api/sessions/:id ────────────────────────────────────────────
  fastify.delete('/api/sessions/:id', async (request, reply) => {
    const { id } = request.params;
    await fastify.db.query(
      `UPDATE sessions SET status = 'closed' WHERE id = $1`,
      [id],
    );
    await fastify.redis.del(`session:${id}`);
    reply.code(204).send();
  });
}

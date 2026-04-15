/**
 * Stations route
 *
 * GET /api/stations?q=châtelet   → Search stations (autocomplete)
 * GET /api/stations              → All stations (for initial load)
 */
export default async function stationRoutes(fastify) {
  fastify.get('/api/stations', async (request, reply) => {
    const q = request.query.q ?? '';

    if (q.length === 0) {
      // Return full list for client-side autocomplete.
      const { rows } = await fastify.db.query(
        `SELECT id, nom, ligne,
                ST_X(geom) AS lng, ST_Y(geom) AS lat
         FROM stations
         ORDER BY nom`,
      );
      return rows;
    }

    // Full-text prefix search (case-insensitive, accent-insensitive via unaccent if available).
    const { rows } = await fastify.db.query(
      `SELECT id, nom, ligne,
              ST_X(geom) AS lng, ST_Y(geom) AS lat
       FROM stations
       WHERE nom ILIKE $1
       ORDER BY nom
       LIMIT 10`,
      [`${q}%`],
    );

    return rows;
  });
}

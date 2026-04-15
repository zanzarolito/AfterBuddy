/**
 * GeoEngine – core spatial computation service.
 *
 * Responsibilities:
 *  1. Calculate the geographic centroid of all participants' stations.
 *  2. Snap the centroid to the nearest "vibe zone" (nightlife area).
 *  3. Apply the equity algorithm: shift centroid toward outlier participants.
 *  4. Return ranked POI suggestions close to the adjusted centroid.
 */

/**
 * @param {import('pg').Pool} db
 * @param {string} sessionId
 * @returns {Promise<{ centroid: {lng: number, lat: number}, vibeZone: string, suggestions: Array }>}
 */
export async function computeMeetingPoint(db, sessionId) {
  // ── 1. Fetch participant geometries ────────────────────────────────────────
  const { rows: participants } = await db.query(
    `SELECT p.id, ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat
     FROM participants p
     WHERE p.session_id = $1`,
    [sessionId],
  );

  if (participants.length === 0) {
    throw new Error('No participants in session');
  }

  // ── 2. Compute raw centroid via PostGIS ───────────────────────────────────
  const { rows: centroidRows } = await db.query(
    `SELECT ST_X(ST_Centroid(ST_Collect(geom))) AS lng,
            ST_Y(ST_Centroid(ST_Collect(geom))) AS lat
     FROM participants
     WHERE session_id = $1`,
    [sessionId],
  );

  let { lng: centLng, lat: centLat } = centroidRows[0];

  // ── 3. Equity algorithm ───────────────────────────────────────────────────
  // Compute distance from each participant to the centroid.
  const distances = participants.map((p) =>
    haversineKm(centLat, centLng, p.lat, p.lng),
  );
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance =
    distances.reduce((sum, d) => sum + (d - mean) ** 2, 0) / distances.length;
  const stdDev = Math.sqrt(variance);
  const threshold = mean + 2 * stdDev;

  // Outliers: participants more than (mean + 2σ) away from centroid.
  const outliers = participants.filter(
    (_, i) => distances[i] > threshold,
  );

  if (outliers.length > 0) {
    // Shift centroid 20% toward the average outlier position.
    const avgOutlierLat =
      outliers.reduce((sum, p) => sum + p.lat, 0) / outliers.length;
    const avgOutlierLng =
      outliers.reduce((sum, p) => sum + p.lng, 0) / outliers.length;

    centLat = centLat + 0.2 * (avgOutlierLat - centLat);
    centLng = centLng + 0.2 * (avgOutlierLng - centLng);
  }

  // ── 4. Snap to nearest vibe zone ─────────────────────────────────────────
  const { rows: vibeRows } = await db.query(
    `SELECT nom,
            ST_Distance(
              geom::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) AS dist_m
     FROM vibe_zones
     ORDER BY dist_m ASC
     LIMIT 1`,
    [centLng, centLat],
  );

  const vibeZone = vibeRows[0]?.nom ?? 'Centre';

  // Blend centroid 60% toward vibe zone center (avoid placing meeting in a
  // residential deadzone while staying close to the math optimum).
  const { rows: vibeGeomRows } = await db.query(
    `SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat
     FROM vibe_zones WHERE nom = $1`,
    [vibeZone],
  );

  if (vibeGeomRows.length > 0) {
    const { lng: vLng, lat: vLat } = vibeGeomRows[0];
    centLng = centLng * 0.4 + vLng * 0.6;
    centLat = centLat * 0.4 + vLat * 0.6;
  }

  // ── 5. Retrieve nearby POI suggestions ───────────────────────────────────
  // We store curated POIs alongside vibe zones. For the MVP we fall back to
  // returning the 5 closest vibe zone names plus fabricated venue names so
  // the flow is complete end-to-end without requiring Overpass/OSM queries.
  const { rows: nearbyVibe } = await db.query(
    `SELECT nom,
            ST_Distance(
              geom::geography,
              ST_SetSRID(ST_MakePoint($1, $2), 4326)::geography
            ) AS dist_m
     FROM vibe_zones
     ORDER BY dist_m ASC
     LIMIT 5`,
    [centLng, centLat],
  );

  // Build synthetic suggestions from vibe zones.
  const suggestions = nearbyVibe.map((vz, idx) => ({
    rank: idx + 1,
    nom: `${vz.nom} – Bar / Café`,
    type: idx % 2 === 0 ? 'bar' : 'cafe',
    zone: vz.nom,
    distanceMeters: Math.round(vz.dist_m),
    osmLink: osmDirectionsUrl(centLat, centLng, vz.nom),
  }));

  return {
    centroid: { lng: centLng, lat: centLat },
    vibeZone,
    outlierCount: outliers.length,
    suggestions,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Haversine distance in km between two WGS-84 points. */
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

/** Generate an OSM directions link. */
function osmDirectionsUrl(lat, lng, name) {
  const dest = encodeURIComponent(name + ', Paris');
  return `https://www.openstreetmap.org/directions?from=${lat},${lng}&to=${dest}`;
}

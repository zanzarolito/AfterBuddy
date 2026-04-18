/**
 * GeoEngine – core spatial computation service.
 *
 * 1. Calculate the geographic centroid of all participants' stations.
 * 2. Apply equity algorithm: shift toward outlier participants (> mean + 2σ).
 * 3. Snap centroid 60% toward the nearest nightlife vibe zone.
 * 4. Fetch real nearby POIs (bars, pubs, cafés) from the Overpass API.
 */

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const OVERPASS_TIMEOUT_MS = 12_000;
const SEARCH_RADIUS_M = 600;

export async function computeMeetingPoint(db, sessionId) {
  // ── 1. Fetch participant geometries ────────────────────────────────────────
  const { rows: participants } = await db.query(
    `SELECT p.id, ST_X(p.geom) AS lng, ST_Y(p.geom) AS lat
     FROM participants p WHERE p.session_id = $1`,
    [sessionId],
  );

  if (participants.length === 0) throw new Error('No participants in session');

  // ── 2. Compute raw centroid via PostGIS ───────────────────────────────────
  const { rows: centroidRows } = await db.query(
    `SELECT ST_X(ST_Centroid(ST_Collect(geom))) AS lng,
            ST_Y(ST_Centroid(ST_Collect(geom))) AS lat
     FROM participants WHERE session_id = $1`,
    [sessionId],
  );

  let { lng: centLng, lat: centLat } = centroidRows[0];

  // ── 3. Equity algorithm (2σ outlier shift) ────────────────────────────────
  const distances = participants.map((p) =>
    haversineKm(centLat, centLng, p.lat, p.lng),
  );
  const mean = distances.reduce((a, b) => a + b, 0) / distances.length;
  const variance =
    distances.reduce((sum, d) => sum + (d - mean) ** 2, 0) / distances.length;
  const stdDev = Math.sqrt(variance);

  const outliers = participants.filter((_, i) => distances[i] > mean + 2 * stdDev);
  if (outliers.length > 0) {
    const avgLat = outliers.reduce((s, p) => s + p.lat, 0) / outliers.length;
    const avgLng = outliers.reduce((s, p) => s + p.lng, 0) / outliers.length;
    centLat += 0.2 * (avgLat - centLat);
    centLng += 0.2 * (avgLng - centLng);
  }

  // ── 4. Snap to nearest vibe zone ──────────────────────────────────────────
  const { rows: vibeRows } = await db.query(
    `SELECT nom,
            ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS dist_m
     FROM vibe_zones ORDER BY dist_m ASC LIMIT 1`,
    [centLng, centLat],
  );
  const vibeZone = vibeRows[0]?.nom ?? 'Centre';

  const { rows: vibeGeomRows } = await db.query(
    `SELECT ST_X(geom) AS lng, ST_Y(geom) AS lat FROM vibe_zones WHERE nom = $1`,
    [vibeZone],
  );
  if (vibeGeomRows.length > 0) {
    centLng = centLng * 0.4 + vibeGeomRows[0].lng * 0.6;
    centLat = centLat * 0.4 + vibeGeomRows[0].lat * 0.6;
  }

  // ── 5. Fetch real POIs from Overpass API ──────────────────────────────────
  let suggestions = await fetchOverpassPOIs(centLat, centLng, SEARCH_RADIUS_M);

  // Fallback: if Overpass returns nothing, widen search to 1 km.
  if (suggestions.length === 0) {
    suggestions = await fetchOverpassPOIs(centLat, centLng, 1000);
  }

  // Last resort: synthetic suggestions from vibe zones.
  if (suggestions.length === 0) {
    const { rows: fallback } = await db.query(
      `SELECT nom,
              ST_Distance(geom::geography, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography) AS dist_m
       FROM vibe_zones ORDER BY dist_m ASC LIMIT 5`,
      [centLng, centLat],
    );
    suggestions = fallback.map((vz, i) => ({
      rank: i + 1,
      nom: vz.nom,
      type: 'bar',
      address: null,
      lat: centLat,
      lng: centLng,
      distanceMeters: Math.round(vz.dist_m),
      osmLink: osmDirectionsUrl(centLat, centLng, vz.nom + ' Paris'),
    }));
  }

  return {
    centroid: { lng: centLng, lat: centLat },
    vibeZone,
    outlierCount: outliers.length,
    suggestions,
  };
}

// ── Overpass API ──────────────────────────────────────────────────────────────

async function fetchOverpassPOIs(lat, lng, radiusM) {
  const query = `
[out:json][timeout:10];
(
  node["amenity"~"^(bar|pub|cafe)$"](around:${radiusM},${lat},${lng});
);
out body 5;
  `.trim();

  try {
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(OVERPASS_TIMEOUT_MS),
    });

    if (!res.ok) return [];

    const json = await res.json();
    const elements = json.elements ?? [];

    return elements
      .filter((el) => el.tags?.name)
      .slice(0, 5)
      .map((el, i) => {
        const amenity = el.tags.amenity;
        const type = amenity === 'cafe' ? 'cafe' : 'bar';
        const street = el.tags['addr:street'] ?? '';
        const number = el.tags['addr:housenumber'] ?? '';
        const address = street ? `${number} ${street}`.trim() : null;

        return {
          rank: i + 1,
          nom: el.tags.name,
          type,
          address,
          lat: el.lat,
          lng: el.lon,
          distanceMeters: Math.round(haversineKm(lat, lng, el.lat, el.lon) * 1000),
          osmLink: osmDirectionsUrl(lat, lng, `${el.lat},${el.lon}`),
        };
      });
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function osmDirectionsUrl(fromLat, fromLng, to) {
  return `https://www.openstreetmap.org/directions?from=${fromLat},${fromLng}&to=${encodeURIComponent(to)}`;
}

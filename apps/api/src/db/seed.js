#!/usr/bin/env node
/**
 * Seed script — imports RATP metro stations from ratp_stations.json
 * into the PostGIS-enabled `stations` table.
 *
 * Usage:  node src/db/seed.js
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import pg from 'pg';
import 'dotenv/config';

const __dirname = dirname(fileURLToPath(import.meta.url));
const { Pool } = pg;

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function seed() {
  const dataPath = join(__dirname, '../../data/ratp_stations.json');
  const stations = JSON.parse(readFileSync(dataPath, 'utf8'));

  console.log(`Seeding ${stations.length} metro stations…`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Clear existing stations to avoid duplicates on re-seed.
    await client.query('TRUNCATE stations RESTART IDENTITY CASCADE');

    for (const station of stations) {
      await client.query(
        `INSERT INTO stations (nom, ligne, geom)
         VALUES ($1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326))`,
        [station.nom, station.ligne, station.lng, station.lat],
      );
    }

    await client.query('COMMIT');
    console.log('Seed complete.');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});

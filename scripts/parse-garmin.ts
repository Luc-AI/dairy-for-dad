#!/usr/bin/env tsx
/**
 * parse-garmin.ts
 *
 * Reads the 3 summarizedActivities JSON files from the Garmin export,
 * normalizes via src/lib/garmin-parse.ts, writes data/activities.json,
 * and bulk-upserts (overwrite-on-conflict) into Neon Postgres.
 *
 * Usage: npm run parse-garmin
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { neon } from '@neondatabase/serverless';
import { parseFiles } from '../src/lib/garmin-parse';
import type { Activity } from '../src/lib/db';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*)\s*$/);
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

const GARMIN_DIR = path.join(__dirname, '../Garmin Export/DI_Connect/DI-Connect-Fitness');
const SOURCE_FILES = [
  'lorenz.heer_0_summarizedActivities.json',
  'lorenz.heer_1001_summarizedActivities.json',
  'lorenz.heer_2002_summarizedActivities.json',
];
const OUTPUT_FILE = path.join(__dirname, '../data/activities.json');

const DATABASE_URL = process.env.DATABASE_URL;
const CHUNK_SIZE = 500;

const COLS: (keyof Activity)[] = [
  'id', 'date', 'name', 'activity_type', 'duration_sec', 'distance_m',
  'elevation_gain_m', 'avg_speed_kmh', 'avg_hr', 'max_hr', 'calories',
  'avg_power', 'tss', 'avg_temperature', 'min_temperature', 'max_temperature',
  'start_lat', 'start_lon', 'location_name', 'description',
];

async function main(): Promise<void> {
  console.log('=== Garmin Activity Parser ===\n');

  const fileBodies: string[] = [];
  for (const filename of SOURCE_FILES) {
    const filepath = path.join(GARMIN_DIR, filename);
    if (!fs.existsSync(filepath)) {
      console.warn(`  WARN: File not found, skipping: ${filepath}`);
      continue;
    }
    console.log(`Reading ${filename}...`);
    fileBodies.push(fs.readFileSync(filepath, 'utf8'));
  }

  const { activities, skippedNoTimestamp } = parseFiles(fileBodies);
  console.log(`\nNormalized: ${activities.length} activities`);
  if (skippedNoTimestamp > 0) {
    console.warn(`Skipped ${skippedNoTimestamp} activities with missing timestamps.`);
  }

  // Sort newest first
  activities.sort((a, b) => (a.date < b.date ? 1 : -1));

  // Write local JSON cache
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(activities, null, 2));
  console.log(`\nWrote: ${OUTPUT_FILE}`);

  // Spot-check
  const prag = activities.find((a) => a.id === 178259890);
  if (prag) {
    console.log('\nSpot-check "Prag" run (id: 178259890):');
    console.log(`  date:         ${prag.date}         (expected: 2012-05-09)`);
    console.log(`  distance_m:   ${prag.distance_m}  (expected: ~8344)`);
    console.log(`  duration_sec: ${prag.duration_sec} (expected: ~2945)`);
  }

  if (!DATABASE_URL) {
    console.log('\nNo DATABASE_URL set — skipping DB seed.');
    return;
  }

  console.log('\nSeeding Neon...');
  const sql = neon(DATABASE_URL);

  const updateSet = COLS.filter((c) => c !== 'id')
    .map((c) => `${c} = EXCLUDED.${c}`)
    .join(', ');

  let inserted = 0;
  for (let i = 0; i < activities.length; i += CHUNK_SIZE) {
    const batch = activities.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const placeholders = batch
      .map((row, rowIdx) => {
        const base = rowIdx * COLS.length;
        COLS.forEach((c) => values.push(row[c] ?? null));
        return '(' + COLS.map((_, j) => `$${base + j + 1}`).join(',') + ')';
      })
      .join(',');

    const query = `
      INSERT INTO activities (${COLS.join(',')})
      VALUES ${placeholders}
      ON CONFLICT (id) DO UPDATE SET ${updateSet}
    `;

    try {
      await sql.query(query, values);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`  ERROR on chunk ${i / CHUNK_SIZE + 1}:`, msg);
      process.exit(1);
    }
    inserted += batch.length;
    process.stdout.write(`  Upserted ${inserted}/${activities.length}\r`);
  }
  console.log(`\n\nSeeded ${inserted} activities into Neon. Done!`);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});

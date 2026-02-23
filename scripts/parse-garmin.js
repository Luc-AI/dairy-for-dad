#!/usr/bin/env node
/**
 * parse-garmin.js
 *
 * Reads all 3 summarizedActivities JSON files from the Garmin export,
 * normalizes units, deduplicates by activityId, writes data/activities.json,
 * and bulk-upserts into Supabase Postgres.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co \
 *   SUPABASE_SERVICE_KEY=your-service-role-key \
 *   node scripts/parse-garmin.js
 *
 * The service role key (not anon key) is needed to bypass Row Level Security
 * during the initial seed. Get it from: Supabase > Settings > API > service_role.
 */

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// ---------------------------------------------------------------------------
// Load .env.local automatically (no dotenv dependency needed)
// ---------------------------------------------------------------------------

const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const match = line.match(/^\s*([^#][^=]*?)\s*=\s*(.*)\s*$/);
    if (match) process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
}

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const GARMIN_DIR = path.join(
  __dirname,
  '../Garmin Export/DI_Connect/DI-Connect-Fitness'
);

const SOURCE_FILES = [
  'lorenz.heer_0_summarizedActivities.json',
  'lorenz.heer_1001_summarizedActivities.json',
  'lorenz.heer_2002_summarizedActivities.json',
];

const OUTPUT_FILE = path.join(__dirname, '../data/activities.json');

// Support both explicit SUPABASE_URL and the Next.js NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
// Support SUPABASE_SERVICE_KEY or SUPABASE_SERVICE_ROLE_KEY
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

const CHUNK_SIZE = 500;

// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

/** Centimeters → meters, rounded to 1 decimal */
function cmToM(v) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v) / 100;
}

/** Milliseconds → seconds, integer */
function msToSec(v) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v / 1000);
}

/** cm/ms → km/h, rounded to 2 decimals */
function cmPerMsToKmh(v) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v * 36) / 1;  // cm/ms * 36 = km/h
}

/** ms epoch → YYYY-MM-DD string */
function msToDate(ms) {
  if (ms == null || isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Safely round a float field */
function round(v, decimals = 1) {
  if (v == null || isNaN(v)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

/** Safely convert to integer */
function toInt(v) {
  if (v == null || isNaN(v)) return null;
  return Math.round(v);
}

// ---------------------------------------------------------------------------
// Normalize a single raw Garmin activity object
// ---------------------------------------------------------------------------

function normalize(raw) {
  const date = msToDate(raw.beginTimestamp);
  if (!date) {
    return null; // skip activities with no timestamp
  }

  return {
    id: raw.activityId,
    date,
    name: raw.name || null,
    activity_type: raw.activityType || null,
    duration_sec: msToSec(raw.duration),
    distance_m: cmToM(raw.distance),
    elevation_gain_m: cmToM(raw.elevationGain),
    avg_speed_kmh: cmPerMsToKmh(raw.avgSpeed),
    avg_hr: toInt(raw.avgHr),
    max_hr: toInt(raw.maxHr),
    calories: toInt(raw.calories),
    avg_power: toInt(raw.avgPower),
    tss: round(raw.trainingStressScore, 1),
    avg_temperature: round(raw.avgTemperature, 1),
    min_temperature: round(raw.minTemperature, 1),
    max_temperature: round(raw.maxTemperature, 1),
    start_lat: raw.startLatitude ?? null,
    start_lon: raw.startLongitude ?? null,
    location_name: raw.locationName || null,
    description: raw.description || null,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Garmin Activity Parser ===\n');

  // 1. Read and merge all source files
  const allRaw = [];
  for (const filename of SOURCE_FILES) {
    const filepath = path.join(GARMIN_DIR, filename);
    if (!fs.existsSync(filepath)) {
      console.warn(`  WARN: File not found, skipping: ${filepath}`);
      continue;
    }
    console.log(`Reading ${filename}...`);
    const json = JSON.parse(fs.readFileSync(filepath, 'utf8'));
    // File is either [{summarizedActivitiesExport:[...]}] or {summarizedActivitiesExport:[...]}
    const root = Array.isArray(json) ? json[0] : json;
    const activities = root.summarizedActivitiesExport || [];
    console.log(`  → ${activities.length} activities`);
    allRaw.push(...activities);
  }

  console.log(`\nTotal raw activities: ${allRaw.length}`);

  // 2. Deduplicate by activityId (keep first occurrence)
  const seen = new Set();
  const unique = [];
  for (const raw of allRaw) {
    if (!seen.has(raw.activityId)) {
      seen.add(raw.activityId);
      unique.push(raw);
    }
  }
  console.log(`After deduplication: ${unique.length}`);

  // 3. Normalize
  let skipped = 0;
  const normalized = [];
  for (const raw of unique) {
    const activity = normalize(raw);
    if (!activity) {
      skipped++;
      console.warn(`  SKIP: activityId=${raw.activityId} — missing beginTimestamp`);
      continue;
    }
    normalized.push(activity);
  }

  if (skipped > 0) {
    console.warn(`\nSkipped ${skipped} activities with missing timestamps.`);
  }

  // Sort newest first
  normalized.sort((a, b) => (a.date < b.date ? 1 : -1));

  console.log(`\nNormalized: ${normalized.length} activities`);

  // 4. Write local JSON cache
  fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(normalized, null, 2));
  console.log(`\nWrote: ${OUTPUT_FILE}`);

  // 5. Spot-check verification
  const prag = normalized.find((a) => a.id === 178259890);
  if (prag) {
    console.log('\nSpot-check "Prag" run (id: 178259890):');
    console.log(`  date:         ${prag.date}         (expected: 2012-05-09)`);
    console.log(`  distance_m:   ${prag.distance_m}  (expected: ~8344)`);
    console.log(`  duration_sec: ${prag.duration_sec} (expected: ~2945)`);
  } else {
    console.warn('\nWARN: Spot-check activity (id: 178259890) not found.');
  }

  // 6. Seed Supabase
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.log('\nNo SUPABASE_URL / SUPABASE_SERVICE_KEY set — skipping DB seed.');
    console.log('To seed, run:');
    console.log(
      '  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_KEY=your-key node scripts/parse-garmin.js'
    );
    return;
  }

  console.log('\nSeeding Supabase...');
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let inserted = 0;
  for (let i = 0; i < normalized.length; i += CHUNK_SIZE) {
    const batch = normalized.slice(i, i + CHUNK_SIZE);
    const { error } = await supabase
      .from('activities')
      .upsert(batch, { onConflict: 'id' });

    if (error) {
      console.error(`  ERROR on chunk ${i / CHUNK_SIZE + 1}:`, error.message);
      process.exit(1);
    }

    inserted += batch.length;
    process.stdout.write(`  Upserted ${inserted}/${normalized.length}\r`);
  }

  console.log(`\n\nSeeded ${inserted} activities into Supabase. Done!`);
}

main().catch((err) => {
  console.error('\nFatal error:', err);
  process.exit(1);
});

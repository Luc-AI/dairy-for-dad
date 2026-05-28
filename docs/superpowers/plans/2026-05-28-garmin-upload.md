# Garmin Activity Upload Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an authenticated user update the activities database by uploading one or more Garmin `*_summarizedActivities.json` files through a modal on the main page; new activities are inserted, existing ones are skipped.

**Architecture:** Pure-TS parser shared between the existing CLI seed script and a new browser-based import modal. Browser parses + dedupes + normalizes the JSON files locally, fetches existing activity IDs from a new `/api/activities/ids` endpoint, previews how many are new, then POSTs only the new rows to `/api/activities/import` which inserts them with `ON CONFLICT (id) DO NOTHING RETURNING id`.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, **Neon Postgres** (`@neondatabase/serverless`), **shared-password HMAC session cookie** (`src/lib/auth.ts`), shadcn/ui (new-york style, Tailwind v4), Vitest (added by this plan), tsx (added by this plan), sonner (added by this plan).

> **Migration note (2026-05-28):** This plan was originally drafted against Supabase. The project has since migrated to Neon. Below is the Neon-correct version: the `Activity` type comes from `@/lib/db`, auth uses `isValidSession(cookies.get(SESSION_COOKIE)?.value)`, and inserts/queries use raw SQL via the `sql` client. The shape of the spec and the task decomposition are unchanged.

**Design spec:** [docs/superpowers/specs/2026-05-28-garmin-upload-design.md](../specs/2026-05-28-garmin-upload-design.md)

---

## File map

### Created

| Path | Responsibility |
|---|---|
| `src/lib/garmin-parse.ts` | Pure functions and types for parsing/normalizing/dedup. No I/O. Browser- and Node-safe. |
| `src/lib/garmin-parse.test.ts` | Vitest unit tests for the parser. |
| `src/app/api/activities/ids/route.ts` | `GET` returning `number[]` of existing activity IDs. Auth-gated. |
| `src/app/api/activities/import/route.ts` | `POST` accepting `{ activities: Activity[] }`. Inserts with skip-on-conflict. Returns `{ inserted, skipped }`. |
| `src/app/components/ImportActivitiesDialog.tsx` | Modal: dropzone → parse → preview → import → result. Client component. |
| `src/app/components/ImportActivitiesButton.tsx` | Trigger button that mounts the dialog. Client component. |
| `src/components/ui/dialog.tsx` | shadcn Dialog primitive (added via CLI). |
| `src/components/ui/sonner.tsx` | shadcn sonner Toaster (added via CLI). |
| `vitest.config.ts` | Vitest config for the parser tests. |

### Modified

| Path | Change |
|---|---|
| `scripts/parse-garmin.js` → `scripts/parse-garmin.ts` | Convert to TypeScript; replace inline normalize/dedup with imports from `src/lib/garmin-parse.ts`. Run via `tsx`. Continues to use `neon(process.env.DATABASE_URL)` directly. |
| `package.json` | Add `tsx`, `vitest`, `sonner` deps. Add `test` and `parse-garmin` scripts. |
| `src/app/page.tsx` | Mount `<ImportActivitiesButton />` in the header row next to `<LogoutButton />`. Mount `<Toaster />` once for sonner. |
| `src/app/components/ActivityTable.tsx` | Listen for a `window` `'activities:imported'` event and re-call `fetchActivities` when it fires. |

---

## Conventions used in this plan

- **Path aliases:** `@/lib/...`, `@/components/...` — already configured in `tsconfig.json` and `components.json`.
- **Activity type:** the canonical `Activity` type lives in `src/lib/db.ts`. New code imports from there: `import type { Activity } from '@/lib/db';`.
- **DB client (server):** `import { sql } from '@/lib/db';` — `@neondatabase/serverless` tagged template + `sql.query(text, params)`.
- **Auth pattern in API routes (Neon stack):**
  ```ts
  import { cookies } from 'next/headers';
  import { SESSION_COOKIE, isValidSession } from '@/lib/auth';
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  ```
  Mirrors what `src/app/api/activities/route.ts` already does.
- **Client usage:** none of the new client code talks to the DB directly. The modal hits `fetch('/api/...')`, which carries the session cookie automatically.
- **Commit style:** present-tense conventional commits matching recent history (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`).

---

## Task 1: Add Vitest and create the shared parser type/interface

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`
- Create: `src/lib/garmin-parse.ts`

- [ ] **Step 1: Install dev deps**

Run:
```bash
npm install --save-dev vitest @vitest/ui tsx
```
Expected: deps added, lockfile updated.

- [ ] **Step 2: Add npm scripts**

Edit `package.json`. In the `"scripts"` block, add:
```json
"test": "vitest run",
"test:watch": "vitest",
"parse-garmin": "tsx scripts/parse-garmin.ts"
```

- [ ] **Step 3: Create Vitest config**

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
```

- [ ] **Step 4: Create the empty parser file with types**

Create `src/lib/garmin-parse.ts`:
```ts
import type { Activity } from './db';

/** Raw Garmin "summarized activity" record. Only the fields we use are typed. */
export type RawSummarizedActivity = {
  activityId: number;
  beginTimestamp?: number | null;
  name?: string | null;
  activityType?: string | null;
  duration?: number | null;
  distance?: number | null;
  elevationGain?: number | null;
  avgSpeed?: number | null;
  avgHr?: number | null;
  maxHr?: number | null;
  calories?: number | null;
  avgPower?: number | null;
  trainingStressScore?: number | null;
  avgTemperature?: number | null;
  minTemperature?: number | null;
  maxTemperature?: number | null;
  startLatitude?: number | null;
  startLongitude?: number | null;
  locationName?: string | null;
  description?: string | null;
};

export type ParseResult = {
  /** Successfully normalized activities, deduped by id (first occurrence wins). */
  activities: Activity[];
  /** Count of raw rows skipped due to missing beginTimestamp. */
  skippedNoTimestamp: number;
};
```

- [ ] **Step 5: Verify vitest runs (no tests yet)**

Run: `npm test`
Expected: vitest exits cleanly, "No test files found" (or similar) — not an error.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json vitest.config.ts src/lib/garmin-parse.ts
git commit -m "chore: add vitest, tsx, and parser scaffold"
```

---

## Task 2: Implement and test unit conversion helpers

**Files:**
- Modify: `src/lib/garmin-parse.ts`
- Create: `src/lib/garmin-parse.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/garmin-parse.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import {
  cmToM,
  msToSec,
  cmPerMsToKmh,
  msToDate,
  round,
  toInt,
} from './garmin-parse';

describe('unit conversions', () => {
  it('cmToM: 834424 cm → 8344.24 m, rounded to 1 decimal', () => {
    expect(cmToM(834424)).toBe(8344.24);
  });

  it('cmToM: returns null for null / NaN', () => {
    expect(cmToM(null)).toBeNull();
    expect(cmToM(NaN)).toBeNull();
  });

  it('msToSec: 2945123 ms → 2945 s', () => {
    expect(msToSec(2945123)).toBe(2945);
  });

  it('cmPerMsToKmh: 1 cm/ms → 36 km/h', () => {
    expect(cmPerMsToKmh(1)).toBe(36);
  });

  it('msToDate: returns YYYY-MM-DD UTC slice', () => {
    expect(msToDate(1336521600000)).toBe('2012-05-09');
  });

  it('msToDate: returns null for null', () => {
    expect(msToDate(null)).toBeNull();
  });

  it('round: rounds to N decimals', () => {
    expect(round(1.2345, 2)).toBe(1.23);
    expect(round(1.2345, 1)).toBe(1.2);
  });

  it('toInt: rounds to integer', () => {
    expect(toInt(12.7)).toBe(13);
    expect(toInt(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: all 8 tests FAIL because the helpers are not exported yet.

- [ ] **Step 3: Implement the helpers**

Append to `src/lib/garmin-parse.ts`:
```ts
// ---------------------------------------------------------------------------
// Unit conversion helpers
// ---------------------------------------------------------------------------

/** Centimeters → meters, rounded to 2 decimals. */
export function cmToM(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v) / 100;
}

/** Milliseconds → seconds, integer. */
export function msToSec(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v / 1000);
}

/** cm/ms → km/h. (cm/ms * 36 = km/h.) */
export function cmPerMsToKmh(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v * 36);
}

/** ms epoch → YYYY-MM-DD (UTC). */
export function msToDate(ms: number | null | undefined): string | null {
  if (ms == null || Number.isNaN(ms)) return null;
  return new Date(ms).toISOString().slice(0, 10);
}

/** Round to N decimals. */
export function round(v: number | null | undefined, decimals = 1): number | null {
  if (v == null || Number.isNaN(v)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(v * factor) / factor;
}

/** Round to integer. */
export function toInt(v: number | null | undefined): number | null {
  if (v == null || Number.isNaN(v)) return null;
  return Math.round(v);
}
```

> Note: `cmToM` returns 2-decimal precision (not 1) — matches the existing data fixture where `distance_m: 74308.24`. The original script's `cmToM` comment said "1 decimal" but the actual math (`Math.round(v) / 100`) yields 2 decimals; we keep that real behavior.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 8 PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garmin-parse.ts src/lib/garmin-parse.test.ts
git commit -m "feat: add unit conversion helpers for Garmin parser"
```

---

## Task 3: Implement and test `normalizeActivity`

**Files:**
- Modify: `src/lib/garmin-parse.ts`
- Modify: `src/lib/garmin-parse.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/garmin-parse.test.ts`:
```ts
import { normalizeActivity } from './garmin-parse';

describe('normalizeActivity', () => {
  it('normalizes the canonical Prag run (id 178259890)', () => {
    const raw = {
      activityId: 178259890,
      beginTimestamp: 1336521600000, // 2012-05-09 UTC
      name: 'Prag',
      activityType: 'running',
      duration: 2945000,
      distance: 834424, // cm
      elevationGain: 5000, // cm
      avgSpeed: null,
      avgHr: 150,
      maxHr: 175,
      calories: 600,
    };
    const result = normalizeActivity(raw);
    expect(result).not.toBeNull();
    expect(result!.id).toBe(178259890);
    expect(result!.date).toBe('2012-05-09');
    expect(result!.distance_m).toBe(8344.24);
    expect(result!.duration_sec).toBe(2945);
    expect(result!.elevation_gain_m).toBe(50);
    expect(result!.avg_hr).toBe(150);
  });

  it('returns null when beginTimestamp is missing', () => {
    expect(normalizeActivity({ activityId: 1 })).toBeNull();
    expect(normalizeActivity({ activityId: 2, beginTimestamp: null })).toBeNull();
  });

  it('coerces missing optional fields to null', () => {
    const result = normalizeActivity({
      activityId: 99,
      beginTimestamp: 1336521600000,
    });
    expect(result).not.toBeNull();
    expect(result!.name).toBeNull();
    expect(result!.activity_type).toBeNull();
    expect(result!.avg_hr).toBeNull();
    expect(result!.location_name).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 3 new tests FAIL with "normalizeActivity is not a function" or similar.

- [ ] **Step 3: Implement `normalizeActivity`**

Append to `src/lib/garmin-parse.ts`:
```ts
/** Normalize a raw Garmin record into our `Activity` row shape. Returns null if no usable date. */
export function normalizeActivity(raw: RawSummarizedActivity): Activity | null {
  const date = msToDate(raw.beginTimestamp);
  if (!date) return null;

  return {
    id: raw.activityId,
    date,
    name: raw.name ?? null,
    activity_type: raw.activityType ?? null,
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
    location_name: raw.locationName ?? null,
    description: raw.description ?? null,
  };
}
```

> Note: `Activity` is already imported at the top of `garmin-parse.ts` (Task 1) so no additional import is needed here.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 11 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garmin-parse.ts src/lib/garmin-parse.test.ts
git commit -m "feat: add normalizeActivity for Garmin parser"
```

---

## Task 4: Implement and test `parseSummarizedActivitiesJson` and `dedupeById`

**Files:**
- Modify: `src/lib/garmin-parse.ts`
- Modify: `src/lib/garmin-parse.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/garmin-parse.test.ts`:
```ts
import { parseSummarizedActivitiesJson, dedupeById } from './garmin-parse';

describe('parseSummarizedActivitiesJson', () => {
  const TS = 1336521600000;
  const raw = (id: number) => ({ activityId: id, beginTimestamp: TS });

  it('parses array-wrapped root', () => {
    const json = JSON.stringify([{ summarizedActivitiesExport: [raw(1), raw(2)] }]);
    expect(parseSummarizedActivitiesJson(json)).toEqual([raw(1), raw(2)]);
  });

  it('parses bare-object root', () => {
    const json = JSON.stringify({ summarizedActivitiesExport: [raw(3)] });
    expect(parseSummarizedActivitiesJson(json)).toEqual([raw(3)]);
  });

  it('returns empty array when summarizedActivitiesExport is missing', () => {
    expect(parseSummarizedActivitiesJson('{}')).toEqual([]);
    expect(parseSummarizedActivitiesJson('[]')).toEqual([]);
  });

  it('throws on invalid JSON', () => {
    expect(() => parseSummarizedActivitiesJson('not json')).toThrow();
  });
});

describe('dedupeById', () => {
  it('keeps the first occurrence of each id', () => {
    const TS = 1336521600000;
    const a1 = { activityId: 1, beginTimestamp: TS, name: 'first' };
    const a2 = { activityId: 1, beginTimestamp: TS, name: 'second' };
    const a3 = { activityId: 2, beginTimestamp: TS, name: 'other' };
    expect(dedupeById([a1, a2, a3])).toEqual([a1, a3]);
  });

  it('returns empty for empty input', () => {
    expect(dedupeById([])).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 6 new tests FAIL.

- [ ] **Step 3: Implement the functions**

Append to `src/lib/garmin-parse.ts`:
```ts
/**
 * Parse a `*_summarizedActivities.json` file body.
 * Handles both root shapes Garmin emits:
 *   [{ summarizedActivitiesExport: [...] }]   ← array-wrapped
 *   { summarizedActivitiesExport: [...] }     ← bare object
 * Throws on invalid JSON. Returns [] if the export key is missing.
 */
export function parseSummarizedActivitiesJson(text: string): RawSummarizedActivity[] {
  const parsed = JSON.parse(text);
  const root = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!root || typeof root !== 'object') return [];
  const arr = (root as { summarizedActivitiesExport?: unknown }).summarizedActivitiesExport;
  return Array.isArray(arr) ? (arr as RawSummarizedActivity[]) : [];
}

/** Deduplicate raw activities by activityId, keeping the first occurrence. */
export function dedupeById(raws: RawSummarizedActivity[]): RawSummarizedActivity[] {
  const seen = new Set<number>();
  const out: RawSummarizedActivity[] = [];
  for (const r of raws) {
    if (!seen.has(r.activityId)) {
      seen.add(r.activityId);
      out.push(r);
    }
  }
  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 17 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garmin-parse.ts src/lib/garmin-parse.test.ts
git commit -m "feat: add JSON root parser and id dedupe for Garmin parser"
```

---

## Task 5: Add a high-level `parseFiles` orchestrator

**Files:**
- Modify: `src/lib/garmin-parse.ts`
- Modify: `src/lib/garmin-parse.test.ts`

This is the function the browser will call with file contents.

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/garmin-parse.test.ts`:
```ts
import { parseFiles } from './garmin-parse';

describe('parseFiles', () => {
  const TS = 1336521600000;

  it('parses, dedupes across files, and normalizes', () => {
    const fileA = JSON.stringify({
      summarizedActivitiesExport: [
        { activityId: 1, beginTimestamp: TS, name: 'A1' },
        { activityId: 2, beginTimestamp: TS, name: 'A2' },
      ],
    });
    const fileB = JSON.stringify([
      {
        summarizedActivitiesExport: [
          { activityId: 2, beginTimestamp: TS, name: 'B2 dup' }, // dup of A2
          { activityId: 3, beginTimestamp: TS, name: 'B3' },
        ],
      },
    ]);
    const result = parseFiles([fileA, fileB]);
    expect(result.activities).toHaveLength(3);
    expect(result.activities.map((a) => a.id).sort()).toEqual([1, 2, 3]);
    // First occurrence wins — A2 came from fileA
    expect(result.activities.find((a) => a.id === 2)!.name).toBe('A2');
    expect(result.skippedNoTimestamp).toBe(0);
  });

  it('counts activities skipped for missing beginTimestamp', () => {
    const file = JSON.stringify({
      summarizedActivitiesExport: [
        { activityId: 1, beginTimestamp: TS },
        { activityId: 2 }, // no timestamp
        { activityId: 3, beginTimestamp: null },
      ],
    });
    const result = parseFiles([file]);
    expect(result.activities).toHaveLength(1);
    expect(result.skippedNoTimestamp).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: 2 new tests FAIL with "parseFiles is not a function".

- [ ] **Step 3: Implement `parseFiles`**

Append to `src/lib/garmin-parse.ts`:
```ts
/**
 * Parse multiple file bodies, dedupe across all of them by activityId,
 * normalize each row, and report rows skipped for missing timestamps.
 * Throws if any single file body is invalid JSON.
 */
export function parseFiles(fileBodies: string[]): ParseResult {
  const allRaw: RawSummarizedActivity[] = [];
  for (const body of fileBodies) {
    allRaw.push(...parseSummarizedActivitiesJson(body));
  }
  const unique = dedupeById(allRaw);

  let skippedNoTimestamp = 0;
  const activities: Activity[] = []; // Activity already imported at top of file
  for (const raw of unique) {
    const a = normalizeActivity(raw);
    if (a) activities.push(a);
    else skippedNoTimestamp++;
  }
  return { activities, skippedNoTimestamp };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all 19 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/garmin-parse.ts src/lib/garmin-parse.test.ts
git commit -m "feat: add parseFiles orchestrator for Garmin parser"
```

---

## Task 6: Convert `scripts/parse-garmin.js` to TypeScript using the shared parser

**Files:**
- Delete: `scripts/parse-garmin.js`
- Create: `scripts/parse-garmin.ts`

- [ ] **Step 1: Read the existing script** (already done — use the design spec for reference)

The script does six things: load `.env.local`, read 3 known files, dedupe, normalize, write `data/activities.json`, upsert (overwrite-on-conflict) to Neon. After this refactor it does the same six things, but uses the shared parser.

- [ ] **Step 2: Create `scripts/parse-garmin.ts`**

Create `scripts/parse-garmin.ts`:
```ts
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
```

> Note on the CLI script's conflict behavior: it stays as **upsert (overwrite-on-conflict)** because that's the seed-from-scratch workflow. The new upload feature uses **skip-on-conflict**. Different surfaces, different intentional semantics.

- [ ] **Step 3: Delete the old `.js` script**

Run:
```bash
git rm scripts/parse-garmin.js
```

- [ ] **Step 4: Verify the script still runs**

Run: `npm run parse-garmin`
Expected: same output as before — reads 3 files, writes `data/activities.json`, prints the Prag spot-check. If no `DATABASE_URL` env var is set, exits cleanly after the local write.

- [ ] **Step 5: Commit**

```bash
git add scripts/parse-garmin.ts
git commit -m "refactor: convert parse-garmin script to TypeScript using shared parser"
```

---

## Task 7: Add the `/api/activities/ids` endpoint

**Files:**
- Create: `src/app/api/activities/ids/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/activities/ids/route.ts`:
```ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const rows = (await sql`SELECT id FROM activities`) as { id: number }[];
    return NextResponse.json(rows.map((r) => r.id));
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Sanity-check via curl while dev server runs**

Open two terminals.

Terminal 1: `npm run dev`

Terminal 2:
```bash
# Unauthenticated → 401
curl -i http://localhost:3000/api/activities/ids | head -5
```
Expected: `HTTP/1.1 401` followed by `{"error":"Unauthorized"}`.

Then log in via the browser, copy the `app_session` cookie value from devtools (Application → Cookies → localhost), and:
```bash
curl -s -H "Cookie: app_session=<paste value>" http://localhost:3000/api/activities/ids | head -c 200
```
Expected: a JSON array of numbers (the existing activity IDs).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/activities/ids/route.ts
git commit -m "feat: add GET /api/activities/ids endpoint"
```

---

## Task 8: Add the `/api/activities/import` endpoint

**Files:**
- Create: `src/app/api/activities/import/route.ts`

- [ ] **Step 1: Create the route**

Create `src/app/api/activities/import/route.ts`:
```ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';
import type { Activity } from '@/lib/db';

const CHUNK_SIZE = 500;

const COLS: (keyof Activity)[] = [
  'id', 'date', 'name', 'activity_type', 'duration_sec', 'distance_m',
  'elevation_gain_m', 'avg_speed_kmh', 'avg_hr', 'max_hr', 'calories',
  'avg_power', 'tss', 'avg_temperature', 'min_temperature', 'max_temperature',
  'start_lat', 'start_lon', 'location_name', 'description',
];

function isActivityShape(x: unknown): x is Activity {
  if (!x || typeof x !== 'object') return false;
  const a = x as Partial<Activity>;
  return typeof a.id === 'number' && typeof a.date === 'string';
}

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const activities = (body as { activities?: unknown })?.activities;
  if (!Array.isArray(activities) || !activities.every(isActivityShape)) {
    return NextResponse.json(
      { error: 'Body must be { activities: Activity[] } with id (number) and date (string) on each row.' },
      { status: 400 }
    );
  }

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
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;

    try {
      const result = (await sql.query(query, values)) as { id: number }[];
      inserted += result.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insert failed';
      return NextResponse.json({ error: message, inserted }, { status: 500 });
    }
  }

  return NextResponse.json({
    inserted,
    skipped: activities.length - inserted,
  });
}
```

> Notes:
> - `RETURNING id` makes Postgres return one row per *actually inserted* id, so `result.length` is the truthful insert count even when conflicts cause silent skips.
> - Chunk math: 20 columns × 500 rows = 10000 bound params per statement, well under Postgres's 65535 limit.
> - `COLS` order must stay in sync with the column list in the script (Task 6) and in the `INSERT INTO activities (...)` clause here. They're the columns of the `activities` table from [neon-schema.sql](../../neon-schema.sql).

- [ ] **Step 2: Sanity-check via curl**

With dev server running and an auth cookie:
```bash
# 401 unauth
curl -i -X POST http://localhost:3000/api/activities/import \
  -H "Content-Type: application/json" \
  -d '{"activities":[]}' | head -5
```
Expected: `HTTP/1.1 401`.

```bash
# 400 bad shape (auth'd)
curl -i -X POST http://localhost:3000/api/activities/import \
  -H "Content-Type: application/json" \
  -H "Cookie: app_session=<paste value>" \
  -d '{"activities":[{"id":"oops"}]}' | head -5
```
Expected: `HTTP/1.1 400`.

```bash
# 200 empty insert (auth'd)
curl -s -X POST http://localhost:3000/api/activities/import \
  -H "Content-Type: application/json" \
  -H "Cookie: app_session=<paste value>" \
  -d '{"activities":[]}'
```
Expected: `{"inserted":0,"skipped":0}`.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/activities/import/route.ts
git commit -m "feat: add POST /api/activities/import endpoint with skip-on-conflict"
```

---

## Task 9: Add shadcn Dialog and Sonner toaster

**Files:**
- Create: `src/components/ui/dialog.tsx` (via CLI)
- Create: `src/components/ui/sonner.tsx` (via CLI)
- Modify: `package.json` (sonner dep added by CLI)
- Modify: `src/app/layout.tsx` (mount the Toaster)

- [ ] **Step 1: Add the Dialog component via shadcn CLI**

Run: `npx shadcn@latest add dialog`
Expected: creates `src/components/ui/dialog.tsx` and installs `@radix-ui/react-dialog` if missing.

- [ ] **Step 2: Add the Sonner Toaster via shadcn CLI**

Run: `npx shadcn@latest add sonner`
Expected: creates `src/components/ui/sonner.tsx` and installs `sonner`.

- [ ] **Step 3: Mount the Toaster in the root layout**

Read `src/app/layout.tsx`, then edit it to add `<Toaster />` inside `<body>` (after `{children}`):
```tsx
import { Toaster } from '@/components/ui/sonner';

// ... in the JSX:
<body>
  {children}
  <Toaster />
</body>
```
(Adjust the exact placement to match the existing layout structure.)

- [ ] **Step 4: Verify the app still builds and runs**

Run: `npm run dev`
Expected: app loads at `http://localhost:3000` without errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/dialog.tsx src/components/ui/sonner.tsx src/app/layout.tsx package.json package-lock.json
git commit -m "chore: add shadcn dialog and sonner toaster"
```

---

## Task 10: Build the `ImportActivitiesDialog` component

**Files:**
- Create: `src/app/components/ImportActivitiesDialog.tsx`

This is the heaviest single task. We build the full dialog in one shot because the states are tightly interwoven.

- [ ] **Step 1: Create the component**

Create `src/app/components/ImportActivitiesDialog.tsx`:
```tsx
'use client';

import { useCallback, useMemo, useState } from 'react';
import { Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { parseFiles } from '@/lib/garmin-parse';
import type { Activity } from '@/lib/db';

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

type FileEntry = {
  name: string;
  size: number;
  error?: string;
};

type Phase = 'idle' | 'parsing' | 'preview' | 'importing' | 'error';

export default function ImportActivitiesDialog({ open, onOpenChange }: Props) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [parsed, setParsed] = useState<Activity[]>([]);
  const [skippedNoTimestamp, setSkippedNoTimestamp] = useState(0);
  const [newActivities, setNewActivities] = useState<Activity[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setPhase('idle');
    setFiles([]);
    setParsed([]);
    setSkippedNoTimestamp(0);
    setNewActivities([]);
    setError(null);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) reset();
      onOpenChange(next);
    },
    [onOpenChange, reset]
  );

  const handleFiles = useCallback(async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setPhase('parsing');
    setError(null);

    const entries: FileEntry[] = [];
    const bodies: string[] = [];

    for (const file of Array.from(fileList)) {
      const entry: FileEntry = { name: file.name, size: file.size };
      try {
        const text = await file.text();
        // Validate as JSON early so we can flag bad files individually.
        JSON.parse(text);
        bodies.push(text);
      } catch {
        entry.error = "Couldn't parse — not valid JSON.";
      }
      entries.push(entry);
    }
    setFiles(entries);

    if (bodies.length === 0) {
      setError("These files don't look like valid JSON.");
      setPhase('error');
      return;
    }

    let result;
    try {
      result = parseFiles(bodies);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse files.');
      setPhase('error');
      return;
    }

    if (result.activities.length === 0) {
      setError("These files don't look like Garmin summarized activity exports.");
      setPhase('error');
      return;
    }

    setParsed(result.activities);
    setSkippedNoTimestamp(result.skippedNoTimestamp);

    // Fetch existing ids for the diff
    try {
      const res = await fetch('/api/activities/ids');
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const existingIds = (await res.json()) as number[];
      const existing = new Set(existingIds);
      const fresh = result.activities.filter((a) => !existing.has(a.id));
      setNewActivities(fresh);
      setPhase('preview');
    } catch (e) {
      setError(
        e instanceof Error
          ? `Couldn't check existing activities: ${e.message}`
          : "Couldn't check existing activities."
      );
      setPhase('error');
    }
  }, []);

  const handleImport = useCallback(async () => {
    setPhase('importing');
    setError(null);
    try {
      const res = await fetch('/api/activities/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activities: newActivities }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? `Server returned ${res.status}`);
      }
      const inserted: number = json.inserted ?? 0;
      toast.success(
        inserted === 1
          ? 'Imported 1 new activity.'
          : `Imported ${inserted} new activities.`
      );
      // Signal the activity table to refetch
      window.dispatchEvent(new CustomEvent('activities:imported'));
      handleOpenChange(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import failed.');
      setPhase('error');
    }
  }, [newActivities, handleOpenChange]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLLabelElement>) => {
      e.preventDefault();
      handleFiles(e.dataTransfer.files);
    },
    [handleFiles]
  );

  const fmtSize = (bytes: number) => {
    const mb = bytes / 1024 / 1024;
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;
  };

  const previewSummary = useMemo(() => {
    if (phase !== 'preview') return null;
    const total = parsed.length;
    const fresh = newActivities.length;
    const dup = total - fresh;
    return { total, fresh, dup };
  }, [phase, parsed.length, newActivities.length]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Garmin activities</DialogTitle>
          <DialogDescription>
            Upload one or more <code>*_summarizedActivities.json</code> files from your Garmin export.
            New activities will be added; existing ones are left alone.
          </DialogDescription>
        </DialogHeader>

        <label
          htmlFor="garmin-files"
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
          className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/30 bg-muted/30 px-6 py-10 cursor-pointer hover:bg-muted/50 transition"
        >
          <Upload className="w-6 h-6 text-muted-foreground" />
          <div className="text-sm text-muted-foreground text-center">
            Drop <code>*_summarizedActivities.json</code> files
            <br />or click to choose
          </div>
          <input
            id="garmin-files"
            type="file"
            accept=".json,application/json"
            multiple
            className="hidden"
            onChange={(e) => handleFiles(e.target.files)}
          />
        </label>

        {files.length > 0 && (
          <ul className="text-xs text-muted-foreground space-y-1">
            {files.map((f) => (
              <li key={f.name} className={f.error ? 'text-destructive' : ''}>
                {f.name} ({fmtSize(f.size)}){f.error ? ` — ${f.error}` : ''}
              </li>
            ))}
          </ul>
        )}

        {phase === 'parsing' && (
          <p className="text-sm text-muted-foreground">Reading files…</p>
        )}

        {previewSummary && (
          <div className="text-sm space-y-1">
            <p>
              Found <strong>{previewSummary.total.toLocaleString()}</strong> activities across {files.filter((f) => !f.error).length} file
              {files.filter((f) => !f.error).length === 1 ? '' : 's'}.
            </p>
            {previewSummary.fresh > 0 ? (
              <p>
                <strong>{previewSummary.fresh.toLocaleString()}</strong> new,{' '}
                {previewSummary.dup.toLocaleString()} already in your database.
              </p>
            ) : (
              <p className="text-muted-foreground">
                Nothing to import — everything in these files is already in your database.
              </p>
            )}
            {skippedNoTimestamp > 0 && (
              <p className="text-xs text-muted-foreground">
                ({skippedNoTimestamp} skipped due to missing timestamp.)
              </p>
            )}
          </div>
        )}

        {phase === 'importing' && (
          <p className="text-sm text-muted-foreground">Importing…</p>
        )}

        {phase === 'error' && error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        <DialogFooter>
          <Button
            variant="ghost"
            onClick={() => handleOpenChange(false)}
            disabled={phase === 'importing'}
          >
            {phase === 'preview' && newActivities.length > 0 ? 'Cancel' : 'Close'}
          </Button>
          {phase === 'preview' && newActivities.length > 0 && (
            <Button onClick={handleImport} disabled={false}>
              Import {newActivities.length}
            </Button>
          )}
          {phase === 'importing' && (
            <Button disabled>Importing…</Button>
          )}
          {phase === 'error' && parsed.length > 0 && newActivities.length > 0 && (
            <Button onClick={handleImport}>Retry</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (If you see errors about Dialog props, ensure the shadcn Dialog component was added with subcomponents `DialogDescription`, `DialogFooter`, etc. — re-run `npx shadcn@latest add dialog` if missing.)

- [ ] **Step 3: Commit**

```bash
git add src/app/components/ImportActivitiesDialog.tsx
git commit -m "feat: add ImportActivitiesDialog component"
```

---

## Task 11: Build the `ImportActivitiesButton` and wire it into the page

**Files:**
- Create: `src/app/components/ImportActivitiesButton.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Create the button component**

Create `src/app/components/ImportActivitiesButton.tsx`:
```tsx
'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ImportActivitiesDialog from './ImportActivitiesDialog';

export default function ImportActivitiesButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Upload className="w-4 h-4 mr-1" />
        Import
      </Button>
      <ImportActivitiesDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
```

- [ ] **Step 2: Mount the button in the page header**

Edit `src/app/page.tsx`:

Replace:
```tsx
import LogoutButton from './components/LogoutButton';
```
with:
```tsx
import LogoutButton from './components/LogoutButton';
import ImportActivitiesButton from './components/ImportActivitiesButton';
```

Replace:
```tsx
<LogoutButton />
```
with:
```tsx
<div className="flex items-center gap-2">
  <ImportActivitiesButton />
  <LogoutButton />
</div>
```

- [ ] **Step 3: Verify the button renders**

Run: `npm run dev`, log in, confirm an "Import" button now appears in the header next to "Sign out". Click it — the modal opens with the dropzone.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/ImportActivitiesButton.tsx src/app/page.tsx
git commit -m "feat: wire ImportActivitiesButton into main page header"
```

---

## Task 12: Refresh the activities list after a successful import

**Files:**
- Modify: `src/app/components/ActivityTable.tsx`

The `ImportActivitiesDialog` already dispatches `window` event `'activities:imported'` on success. Make the table listen.

- [ ] **Step 1: Add the event listener**

Open `src/app/components/ActivityTable.tsx`. Find the existing `useEffect` blocks around line 446-516 (the debounced `fetchActivities` call). Add a new effect after the existing fetcher effects:

```tsx
useEffect(() => {
  const handler = () => fetchActivities();
  window.addEventListener('activities:imported', handler);
  return () => window.removeEventListener('activities:imported', handler);
}, [fetchActivities]);
```

> If `fetchActivities` is not stable across renders (it's wrapped in `useCallback`, so it should be), the listener will be re-bound on each rebuild — that's fine.

- [ ] **Step 2: Verify**

Run: `npm run dev`. Log in. Open the modal, drop your existing 3 export files. The preview should say "0 new". Close the modal.

Then, in the Neon SQL Editor (or `psql $DATABASE_URL`), delete one row:
```sql
DELETE FROM activities WHERE id = <some-id-you-pick>;
```

Re-open the modal, drop the same files. Preview should say "1 new". Click Import. Toast appears, modal closes, the table should refresh and show the row re-appear.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/ActivityTable.tsx
git commit -m "feat: refresh activity table when import event fires"
```

---

## Task 13: End-to-end manual verification

**Files:** none (manual test only)

- [ ] **Step 1: Cold-start check**

Run:
```bash
npm run test       # all 19 parser tests should PASS
npm run build      # production build should succeed with no errors
```

- [ ] **Step 2: Auth gate check**

- Log out.
- Try to open `http://localhost:3000` — should redirect to `/login`.
- With dev tools open, try `fetch('/api/activities/ids')` — expect 401.
- Try `fetch('/api/activities/import', {method:'POST', headers:{'Content-Type':'application/json'}, body:'{}'})` — expect 401.

- [ ] **Step 3: Full upload flow check**

- Log in.
- Click Import.
- Drop the 3 existing `*_summarizedActivities.json` files. Preview should say something like "Found ~N activities across 3 files. 0 new, ~N already in your database." Import button should be hidden.
- Close.
- Delete a row from `activities` in Neon.
- Re-open Import, drop the same 3 files. Preview should show "1 new". Click Import. Toast: "Imported 1 new activity." Modal closes. The table includes the row again.

- [ ] **Step 4: Error path checks**

- Drop a non-JSON file (e.g. a `.txt`). Confirm the file is flagged with "Couldn't parse — not valid JSON." and the error state shows "These files don't look like valid JSON."
- Drop a valid JSON file that's not a Garmin export (e.g. `{"foo":"bar"}`). Confirm error: "These files don't look like Garmin summarized activity exports."

- [ ] **Step 5: Commit nothing, mark plan complete**

This task records the manual checks; no code change.

---

## Self-review notes

- **Spec coverage:** every section of the spec maps to a task — parser (1-5), CLI refactor (6), ids endpoint (7), import endpoint (8), UI (9-11), refresh (12), manual tests (13). ✓
- **Placeholders:** none — every step has either exact code or an exact command. ✓
- **Type consistency:** the `Activity` type is imported from `@/lib/db` everywhere (browser, server, script). `parseFiles` and `normalizeActivity` return that exact type. The `/api/activities/import` route validates the same shape it receives. ✓
- **Event name consistency:** `'activities:imported'` is used in both the dialog dispatcher (Task 10) and the table listener (Task 12). ✓
- **Neon SQL consistency:** column list (`COLS`) is identical in Task 6 (script) and Task 8 (import endpoint), in the order matching `neon-schema.sql`. ✓
- **Auth consistency:** both new API routes use the exact pattern from the existing `src/app/api/activities/route.ts` — `isValidSession(cookies.get(SESSION_COOKIE)?.value)`. ✓

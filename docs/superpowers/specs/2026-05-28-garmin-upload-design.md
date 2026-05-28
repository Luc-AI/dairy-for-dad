# Garmin Activity Upload — Design

**Date:** 2026-05-28
**Status:** Approved for planning

## Goal

Let an authenticated user update the activities database from the web app by uploading one or more Garmin `*_summarizedActivities.json` files. New activities are inserted; activities whose `id` already exists are skipped (never overwritten).

## Scope

- **In scope:** uploading raw `*_summarizedActivities.json` files (the JSON files inside `Garmin Export/DI_Connect/DI-Connect-Fitness/`), client-side parsing/normalization/dedup, preview of how many activities are new, server-side insert with skip-on-conflict.
- **Out of scope:** uploading the full Garmin export ZIP, FIT/TCX/GPX file ingestion, editing or overwriting existing activities, manual diary entries, deletion.

## Key decisions

1. **File format:** raw `*_summarizedActivities.json` files only (not ZIP).
2. **UI placement:** modal triggered from a button on the existing main activities page.
3. **Conflict behavior:** skip-on-conflict. Existing rows are never modified. Upload is purely additive.
4. **Parsing location:** entirely in the browser. The server only sees a clean array of normalized rows ready to insert. Sidesteps Next.js body-size and timeout limits.
5. **Preview step:** after parsing, the browser fetches existing activity IDs from the server, computes the diff, and shows a count of new vs already-present activities before the user confirms.
6. **Shared parse logic:** `scripts/parse-garmin.js` is converted to TypeScript and made to import the same normalize/dedupe functions the browser uses, so there is one source of truth.

## Architecture

```
[Import button on main page]
        ↓
[Modal opens with dropzone]
        ↓
[User selects 1-N *.json files]
        ↓
[Browser parses + normalizes + dedupes]   ← all in JS, no network
        ↓
[Browser fetches existing activity IDs from server]
        ↓
[Preview: "Found X activities, Y are new"]
        ↓
[User clicks Import]
        ↓
[POST /api/activities/import with only the NEW rows]
        ↓
[Server inserts with ON CONFLICT DO NOTHING]
        ↓
[Toast summary + page data refreshes]
```

## Files

### New

| Path | Purpose |
|---|---|
| `src/lib/garmin-parse.ts` | Pure functions: `normalizeActivity(raw)`, `parseSummarizedActivitiesJson(text)`, `dedupeById(activities)`. No I/O, no Supabase, browser-safe. Single source of truth for the parse logic. |
| `src/components/ImportActivitiesDialog.tsx` | Modal: dropzone, parsing state, preview, import button, error/success states. Built on the existing shadcn `Dialog`. |
| `src/components/ImportActivitiesButton.tsx` | Trigger button that mounts the dialog. |
| `src/app/api/activities/import/route.ts` | `POST`. Auth-gated. Accepts `{ activities: Activity[] }`. Inserts in chunks of 500 with `.upsert(..., { onConflict: 'id', ignoreDuplicates: true })`. Returns `{ inserted, skipped }`. |
| `src/app/api/activities/ids/route.ts` | `GET`. Auth-gated. Returns `number[]` of all existing activity IDs. Used only by the preview diff. |
| `src/lib/garmin-parse.test.ts` | Unit tests for the parser. (Test runner setup — see Testing.) |

### Changed

| Path | Change |
|---|---|
| `scripts/parse-garmin.js` → `scripts/parse-garmin.ts` | Convert to TypeScript and import the shared `normalizeActivity` / `dedupeById` from `src/lib/garmin-parse.ts`. Keep the same CLI behavior. Run via `tsx`. |
| `src/app/page.tsx` (or wherever the activities header lives) | Mount `<ImportActivitiesButton />` in the page header area. |
| `package.json` | Add `tsx` (dev) for running the script. Add `vitest` (dev) if we add a test runner (see Testing). |

## Data flow

### Parse (browser)

1. User drops 1-N files. For each file:
   - Read as text.
   - `JSON.parse`. Root is either `[{ summarizedActivitiesExport: [...] }]` or `{ summarizedActivitiesExport: [...] }` — handle both, matching the existing script.
   - Extract `summarizedActivitiesExport[]`.
2. Concatenate raw activities across all files.
3. Dedupe by `activityId` (first occurrence wins).
4. `normalizeActivity(raw)` on each. Drop any with missing `beginTimestamp`.
5. Result: `Activity[]` ready for the preview diff.

### Preview (browser)

1. `GET /api/activities/ids` → `number[]`.
2. Build `const existing = new Set(ids)`.
3. `const newActivities = parsed.filter(a => !existing.has(a.id))`.
4. Render: `Found {parsed.length} activities across {files.length} files. {newActivities.length} new, {parsed.length - newActivities.length} already in your database.`
5. If `newActivities.length === 0`: show "Nothing to import — everything in these files is already in your database." Hide Import button.

### Import (server)

1. Auth check via `createClient()` from `@/lib/supabase/server` and `supabase.auth.getUser()`. Return 401 if no user.
2. Parse JSON body. Validate it's `{ activities: Activity[] }` with reasonable shape (at minimum `id` is a number, `date` is a string). On bad shape, return 400.
3. Chunk into batches of 500.
4. For each chunk: `supabase.from('activities').upsert(chunk, { onConflict: 'id', ignoreDuplicates: true })`.
5. Sum inserted counts. Return `{ inserted, skipped }` where `skipped = activities.length - inserted`.

### Refresh

After successful import, close modal, toast `Imported N new activities.`, trigger a refresh of the activities list. Implementation detail (likely `router.refresh()` or a local re-fetch trigger) to be determined when wiring the modal into the page.

## Modal UI

```
┌─ Import Garmin activities ──────────────────────────────[×]┐
│                                                            │
│   ┌──────────────────────────────────────────────────┐     │
│   │      Drop *_summarizedActivities.json files      │     │
│   │              or click to choose                  │     │
│   └──────────────────────────────────────────────────┘     │
│                                                            │
│   Files: lorenz.heer_0_summarizedActivities.json (2.1 MB)  │
│          lorenz.heer_1001_summarizedActivities.json (1.8MB)│
│                                                            │
│   ─────────────────────────────────────────────────────    │
│                                                            │
│   Found 1,694 activities across 2 files.                   │
│   12 new, 1,682 already in your database.                  │
│                                                            │
│                              [ Cancel ]  [ Import 12 ]     │
└────────────────────────────────────────────────────────────┘
```

### States

1. **Empty** — only dropzone visible, no Import button.
2. **Parsing** — "Reading files…" spinner.
3. **Parse error on a file** — inline red note: `Couldn't parse <filename>`. Other files' summary still shown if any succeeded.
4. **Preview ready, nothing new** — message above; only `Close` button.
5. **Preview ready, has new** — counts + `Import N` button enabled.
6. **Importing** — `Import` disabled with spinner, text "Importing…".
7. **Success** — modal closes, toast `Imported N new activities.`, list refreshes.
8. **Server error** — inline red error, `Retry` button.

### Implementation notes

- Dropzone: native `<input type="file" multiple accept=".json">` styled as a drop target with `onDragOver` / `onDrop`. No extra dependency.
- Modal: shadcn `Dialog` (already configured in `components.json`).
- Toast: whatever shadcn toast component the project uses (or `sonner`); to be confirmed at implementation time.

## Error handling

| Failure | Behavior |
|---|---|
| Invalid JSON in one file | Inline error for that file; continue with the rest. |
| No `summarizedActivitiesExport` array in any file | "These files don't look like Garmin summarized activity exports." |
| `GET /api/activities/ids` fails | Preview shows error with a retry button. |
| `POST /api/activities/import` fails partway | Server returns the inserted count so far + error message. Toast: "Imported N, then failed: <message>." |
| Unauthenticated user | Middleware already redirects `/login`. API routes double-check and return 401. |
| Double-click on Import | Button disabled on first click. Single-user app, no further concurrency concern. |

## Testing

- **`src/lib/garmin-parse.test.ts`**: unit tests covering
  - JSON root as array-wrapped object vs bare object
  - dedup by `activityId` (first occurrence wins)
  - activity with missing `beginTimestamp` is dropped
  - unit conversions: cm → m, ms → s, cm/ms → km/h, ms epoch → `YYYY-MM-DD`
  - the existing "Prag" run (id `178259890`) normalizes to the expected `date / distance_m / duration_sec` (already used as the script's spot-check)
- **Test runner:** add `vitest` if no runner is present. Confirm at implementation time whether to wire it up or skip the unit tests.
- **Manual end-to-end:**
  - Drop the existing 3 export files. Preview should say "0 new" (all already in DB).
  - Delete one row from the DB, re-upload, confirm preview says "1 new" and that exactly that row is inserted.
  - Confirm logged-out user is redirected to `/login` and cannot hit the API routes.
- **No React component tests.** Personal app; visual/manual is enough.

## Open questions deferred to implementation

- Exact toast component (project's existing shadcn toast vs `sonner`).
- Exact refresh mechanism in the activities list (`router.refresh()` vs lifting a re-fetch).
- Whether to add `vitest` or skip the unit tests for now.

These are all small wiring decisions and won't change the design.

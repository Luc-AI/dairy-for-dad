# Activity Detail View — Design Spec

**Date:** 2026-05-29
**Branch:** `feat/garmin-upload` (or successor)

## Goal

Add a full-screen detail view for a single activity, with editable notes and prev/next navigation. Keep the existing sidebar preview as-is.

## Motivation

- The current 288px-wide sidebar is a useful preview but cramped for reading and impossible to write into.
- Notes are currently displayed (`activity.description`) but not editable from the UI.
- Browsing activities one-by-one requires returning to the table between each — slow for journaling sessions.

## Scope

### In scope

- New full-screen route `/activity/[id]` showing all activity fields and an editable notes textarea.
- Prev/Next navigation across the table's current sort + filter context.
- Autosave for notes (debounced + on blur + before navigation).
- Sidebar gains an "Open" button; activity name cell becomes a link; Enter on a focused row opens detail.
- Multi-select sidebar adds an "Avg Distance per activity" stat.

### Out of scope

- Maps, charts, or any visualisation beyond the existing stat grid.
- Rich text editing.
- Bulk-edit notes from multi-select.
- Undo history.
- Cleaning up the unused `diary_entries` table (separate work).

## Decisions and rationale

| Decision | Rationale |
|---|---|
| Full-screen as a **route** (`/activity/[id]`), not a modal | Deep-linkable, browser-back works, refresh survives, URL encodes state. |
| **Keep the sidebar** alongside the full-screen view | Sidebar is the quick scan/preview surface; full-screen is for reading + editing. Two surfaces with clearly different jobs. |
| Sidebar stays **read-only** | Avoids two editing surfaces and keeps the sidebar lightweight. |
| **Plain `<textarea>`**, no rich text | Personal diary; portability and zero new deps beat formatting. |
| Notes stored in existing **`activities.description`** column | Reuses the column already populated and displayed; no schema change. |
| **Autosave** with status indicator, no Save button | Eliminates "discard changes?" dialogs; reduces UI surface for one user. |
| Prev/Next ordering follows **URL-encoded sort+filter context** | No new API; refresh- and link-safe; consistent with the table the user came from. |
| Prev/Next **disabled at ends** (no wrap) | Predictable; avoids "wait, where am I?" |

## Architecture

### Routes

| Path | Purpose |
|---|---|
| `/` | Existing table + sidebar (unchanged behaviour, minor additions noted below). |
| `/activity/[id]` | New full-screen detail page. Query params encode list context for Prev/Next. |

### URL contract for `/activity/[id]`

```
/activity/123?sort=date&dir=desc&search=foo&from=2024-01-01&to=2024-06-01
```

All four list-context params are optional; defaults match the table's defaults (`sort=date`, `dir=desc`, no filters).

### API

| Endpoint | Method | Purpose | Status |
|---|---|---|---|
| `/api/activities` | GET | Existing — list with sort/filter. Reused by detail page to compute Prev/Next. | Unchanged |
| `/api/activities/[id]` | GET | Single activity by id (404 if missing). | **New** |
| `/api/activities/[id]` | PATCH | Update editable fields; only `description` for now. Returns the updated row. | **New** |

PATCH request body:
```json
{ "description": "string or null" }
```

PATCH response: the full updated `Activity` row.

### Components

| File | Status | Purpose |
|---|---|---|
| `src/app/activity/[id]/page.tsx` | New | Server component; loads the activity and renders the client detail component. |
| `src/app/activity/[id]/ActivityDetail.tsx` | New | Client component: header bar, stats, notes textarea, autosave, keyboard nav. |
| `src/app/components/ActivityStats.tsx` | New (extracted) | The existing `ActivityStats` block from `ActivityTable.tsx`, moved to its own file. Used by sidebar and detail page. Accepts a `layout: 'narrow' \| 'wide'` prop to switch between 2-column (sidebar) and 4-column (detail page) grids. |
| `src/app/components/ActivityTable.tsx` | Modified | Activity name cell wraps in `<Link href="/activity/[id]?...">`. Enter-key in row navigates. Sidebar header gets an "Open" button. Multi-select adds Avg Distance. Listens for renamed `activities:changed` event. |
| `src/app/components/ImportActivitiesDialog.tsx` | Modified | Dispatch renamed event. |

### Event renaming

The current `activities:imported` window event is dispatched after import and listened to by the table to refetch. It will be renamed to `activities:changed` and additionally dispatched after a successful PATCH from the detail page returning to the table. The semantics broaden from "imported" to "any change".

## Data flow

### Opening the detail page

1. User clicks activity name (or presses Enter on a focused row). Link target encodes the current `sort`, `dir`, `search`, `dateFrom`, `dateTo` as query params.
2. `/activity/[id]/page.tsx` server component fetches the activity via direct DB call. If not found, render Next.js `notFound()`.
3. Client component receives the activity and the URL search params.
4. Client component fetches the ordered list via `GET /api/activities?<same params>` (the existing endpoint, unchanged), extracts ids, finds this activity's index, and derives Prev/Next ids.

> **Note on neighbour fetching:** the existing list endpoint returns full activity rows. Since the table already loads them all anyway, fetching the full list again is acceptable. If/when activity counts grow large enough to matter, add an `ids-only` mode to the endpoint or a dedicated neighbours endpoint. Not premature-optimised here.

### Editing notes

1. User types in textarea; local state holds the current value.
2. Debounced effect (800ms after last keystroke) issues `PATCH /api/activities/[id]` with the latest value.
3. On textarea blur: flush the debounce — save immediately if dirty.
4. On Prev/Next click: if dirty, await save before navigating.
5. Status label reflects state:
   - `Saved ✓` — local state matches last server-confirmed value.
   - `Saving…` — request in flight.
   - `Unsaved — retry` — last save failed; retry button visible. Textarea content is preserved.

### Returning to the table

- Browser back, the "Back to list" link, or any internal navigation away from the detail page triggers a window event `activities:changed`.
- The table listens and refetches, so the "note" badge in the name column stays accurate.

## Keyboard

| Key | Detail page | Table (existing) |
|---|---|---|
| `←` / `→` | Prev / Next | — |
| `Enter` | — | Open focused row in detail |
| `↑` / `↓` | — | Move focused row (existing) |
| `Esc` | Back to list | Clear selection (existing) |

`j` / `k` shortcuts: explicitly **not** added; arrows are sufficient.

## Error handling

| Case | Behaviour |
|---|---|
| `/activity/[id]` for missing id | Next.js `notFound()` → 404 page with a "Back to list" link. |
| PATCH network error | Status `Unsaved — retry`; textarea preserves content; manual retry button calls PATCH again. |
| PATCH 4xx/5xx | Same as network error; toast with the error message (use existing `sonner` toaster). |
| GET list error on detail page | Render Prev/Next disabled with title attribute "Could not load list context"; activity itself still renders. |

## Visual layout — detail page

```
┌──────────────────────────────────────────────────────────┐
│ ← Back to list           [◀ Prev]  [Next ▶]   Saved ✓   │  sticky header
├──────────────────────────────────────────────────────────┤
│ Morning Ride at Üetliberg                                │  title
│ [road biking]  29.05.2026                                │  badge + date
├──────────────────────────────────────────────────────────┤
│ Distance   Elevation   Duration    Avg Speed             │
│ 42.1 km    812 m       2h 14m      18.7 km/h             │  stats: 4-col grid
│ ─────────────────────────────────────                    │
│ Avg Power  TSS         Avg HR      Max HR                │
│ ...                                                       │
│ ─────────────────────────────────────                    │
│ Calories   Avg Temp    Min Temp    Max Temp              │
│ ...                                                       │
│                                                          │
│ Location: Zürich, Switzerland                            │
├──────────────────────────────────────────────────────────┤
│ Notes                                                     │
│ ┌────────────────────────────────────────────────────┐   │
│ │                                                    │   │
│ │  multiline textarea, ~12 rows                      │   │
│ │                                                    │   │
│ └────────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

Width: same `max-w-[1600px]` container as the table page to stay consistent.

## Testing

Manual verification (no automated tests required for this scope):

- [ ] Click an activity name → detail page opens with all fields.
- [ ] Detail URL is deep-linkable: open in new tab, refresh → still works.
- [ ] Edit notes, wait 1s → status shows `Saved ✓`. Refresh → note persists.
- [ ] Edit notes, click Next without waiting → save flushes before navigation.
- [ ] At first activity in current sort: `Prev` disabled. At last: `Next` disabled.
- [ ] Filter the table, open an activity, navigate Next → moves through filtered set in the same order.
- [ ] Edit notes in detail, click "Back to list" → "note" badge appears/disappears on the row accordingly.
- [ ] Open `/activity/9999999` (nonexistent id) → 404 page with link back.
- [ ] Multi-select 3 rows → sidebar shows totals AND avg distance per activity.
- [ ] Sidebar shows no edit affordance (read-only); "Open" button navigates to detail.
- [ ] Keyboard: focus a row, press Enter → opens detail. On detail, `←`/`→` cycles.

## Risks and follow-ups

- **`diary_entries` table is dead code.** Not touched here; recommend dropping it in a follow-up migration to avoid confusion.
- **Refetching the full list for neighbours** could become wasteful with many activities. Acceptable now; revisit if list size grows past ~1000 rows.
- **PATCH is the first mutation endpoint** in the app. The pattern set here (autosave + status indicator + event broadcast) will likely be reused for any future editable fields.

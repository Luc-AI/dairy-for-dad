# Activity Detail View Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a full-screen activity detail route at `/activity/[id]` with autosaving notes and prev/next navigation, while preserving the existing read-only sidebar in the table.

**Architecture:** New Next.js dynamic route renders a server component that fetches the activity by id and a client component that handles UI (header, stats grid, notes textarea, prev/next). Notes save through a new `PATCH /api/activities/[id]` endpoint with debounced autosave. Prev/Next is computed client-side by re-fetching the existing list endpoint with the same sort+filter URL params the table used. A renamed `activities:changed` window event keeps the table's "note" badge in sync after edits.

**Tech Stack:** Next.js 16 (App Router, server components, async params), React 19, TypeScript, shadcn/ui (existing components: Button, Badge, Card, Separator, Textarea — Textarea added in Task 0), Tailwind, Neon Postgres via `@neondatabase/serverless`, vitest for unit tests, `sonner` toaster for errors.

**Testing approach:** Following project convention, API routes and React components are verified manually (curl/browser). The one piece of pure non-trivial logic — neighbor computation — gets a vitest unit test.

**Reference spec:** [docs/superpowers/specs/2026-05-29-activity-detail-view-design.md](../specs/2026-05-29-activity-detail-view-design.md)

---

## Task 0: Add shadcn Textarea component

**Files:**
- Create: `src/components/ui/textarea.tsx` (via shadcn CLI)

- [ ] **Step 1: Add the Textarea component**

Run:
```bash
npx shadcn@latest add textarea
```

When prompted to overwrite anything, answer no.

Expected: file `src/components/ui/textarea.tsx` created.

- [ ] **Step 2: Verify the file exists**

Run:
```bash
ls src/components/ui/textarea.tsx
```

Expected: prints the path.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/textarea.tsx components.json
git commit -m "chore: add shadcn textarea component"
```

---

## Task 1: Extract ActivityStats to its own file with layout prop

The `ActivityStats` component is currently defined inline in `ActivityTable.tsx`. Extract it so both the sidebar and the new detail page can import it. Add a `layout` prop: `'narrow'` (2-column, sidebar) and `'wide'` (4-column on md+, detail page).

**Files:**
- Create: `src/app/components/ActivityStats.tsx`
- Modify: `src/app/components/ActivityTable.tsx`

- [ ] **Step 1: Create the new file**

Create `src/app/components/ActivityStats.tsx` with this content:

```tsx
import type { Activity } from '@/lib/db';
import { Separator } from '@/components/ui/separator';

function fmtDuration(sec: number | null) {
  if (sec == null) return '—';
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

function fmtDistance(m: number | null) {
  if (m == null) return '—';
  return (m / 1000).toFixed(1) + ' km';
}

function fmtElevation(m: number | null) {
  if (m == null) return '—';
  return Math.round(m) + ' m';
}

function fmtTemp(t: number | null) {
  if (t == null) return '—';
  return t.toFixed(1) + '°C';
}

export type ActivityStatsLayout = 'narrow' | 'wide';

export default function ActivityStats({
  activity,
  layout = 'narrow',
}: {
  activity: Activity;
  layout?: ActivityStatsLayout;
}) {
  const gridCls =
    layout === 'wide'
      ? 'grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5'
      : 'grid grid-cols-2 gap-x-6 gap-y-5';

  const stat = (label: string, value: string | null) => (
    <div key={label} className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none">{label}</dt>
      <dd className="text-[15px] font-semibold font-mono tabular-nums text-foreground leading-snug">{value || '—'}</dd>
    </div>
  );

  return (
    <div className="space-y-5">
      <dl className={gridCls}>
        {stat('Distance', fmtDistance(activity.distance_m))}
        {stat('Elevation', fmtElevation(activity.elevation_gain_m))}
        {stat('Duration', fmtDuration(activity.duration_sec))}
        {stat('Avg Speed', activity.avg_speed_kmh != null ? `${activity.avg_speed_kmh} km/h` : null)}
      </dl>
      <Separator />
      <dl className={gridCls}>
        {stat('Avg Power', activity.avg_power != null ? `${activity.avg_power} W` : null)}
        {stat('TSS', activity.tss != null ? String(activity.tss) : null)}
        {stat('Avg HR', activity.avg_hr != null ? `${activity.avg_hr} bpm` : null)}
        {stat('Max HR', activity.max_hr != null ? `${activity.max_hr} bpm` : null)}
      </dl>
      <Separator />
      <dl className={gridCls}>
        {stat('Calories', activity.calories != null ? activity.calories.toLocaleString() : null)}
        {stat('Avg Temp', fmtTemp(activity.avg_temperature))}
        {stat('Min Temp', fmtTemp(activity.min_temperature))}
        {stat('Max Temp', fmtTemp(activity.max_temperature))}
      </dl>

      {activity.location_name && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none mb-1.5">Location</p>
          <p className="text-sm text-foreground">{activity.location_name}</p>
        </div>
      )}

      {activity.description && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none mb-1.5">
            Diary Note
          </p>
          <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed border-l-4 border-amber-300 pl-3">
            {activity.description}
          </p>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Remove the inline ActivityStats from ActivityTable.tsx and import from the new file**

In `src/app/components/ActivityTable.tsx`:

1. Delete the entire inline `function ActivityStats({ activity }: { activity: Activity }) { ... }` block (it's marked by the `// Activity stat block — shared by side panel and sheet` comment).
2. Add at the top of the file alongside other imports:
   ```tsx
   import ActivityStats from './ActivityStats';
   ```

Leave `SummaryStats` and the format helpers alone for now (we'll touch `SummaryStats` in Task 3). The `fmtDuration`, `fmtDistance`, `fmtElevation`, `fmtTemp` helpers can stay duplicated in `ActivityTable.tsx` — `SummaryStats` and cell renderers still use them.

- [ ] **Step 3: Run the dev server and verify nothing broke**

Run:
```bash
npm run dev
```

In a browser, open the table page. Click a single row. Verify the sidebar still renders distance/elevation/duration/avg speed/power/TSS/HR/calories/temps/location/diary note exactly as before. Multi-select still shows the summary. Stop the dev server.

- [ ] **Step 4: Type-check and lint**

Run:
```bash
npm run build
```

Expected: build succeeds. If lint warns about unused imports in `ActivityTable.tsx`, remove them.

- [ ] **Step 5: Commit**

```bash
git add src/app/components/ActivityStats.tsx src/app/components/ActivityTable.tsx
git commit -m "refactor: extract ActivityStats to its own component with layout prop"
```

---

## Task 2: Rename `activities:imported` event to `activities:changed`

Broadens the semantics to cover any mutation (import or edit).

**Files:**
- Modify: `src/app/components/ActivityTable.tsx`
- Modify: `src/app/components/ImportActivitiesDialog.tsx`

- [ ] **Step 1: Update the listener in ActivityTable.tsx**

In `src/app/components/ActivityTable.tsx`, replace this block:

```tsx
useEffect(() => {
  const handler = () => fetchActivities();
  window.addEventListener('activities:imported', handler);
  return () => window.removeEventListener('activities:imported', handler);
}, [fetchActivities]);
```

with:

```tsx
useEffect(() => {
  const handler = () => fetchActivities();
  window.addEventListener('activities:changed', handler);
  return () => window.removeEventListener('activities:changed', handler);
}, [fetchActivities]);
```

- [ ] **Step 2: Update the dispatcher in ImportActivitiesDialog.tsx**

In `src/app/components/ImportActivitiesDialog.tsx`, change:

```tsx
window.dispatchEvent(new CustomEvent('activities:imported'));
```

to:

```tsx
window.dispatchEvent(new CustomEvent('activities:changed'));
```

- [ ] **Step 3: Verify import still refreshes the table**

Run `npm run dev`. Open the page. Click Import, run a small import. Confirm the table refreshes when import finishes. Stop the server.

- [ ] **Step 4: Commit**

```bash
git add src/app/components/ActivityTable.tsx src/app/components/ImportActivitiesDialog.tsx
git commit -m "refactor: rename activities:imported event to activities:changed"
```

---

## Task 3: Add Avg Distance to multi-select summary

**Files:**
- Modify: `src/app/components/ActivityTable.tsx`

- [ ] **Step 1: Update SummaryStats to compute and show Avg Distance**

In `src/app/components/ActivityTable.tsx`, find the `SummaryStats` function. Just before the `return (...)`, add:

```tsx
const distanceVals = activities.map((a) => a.distance_m).filter((v): v is number => v != null);
const avgDistance = distanceVals.length > 0
  ? distanceVals.reduce((s, v) => s + v, 0) / distanceVals.length
  : null;
```

Inside the `<dl>`, after the `Total Distance` line, add:

```tsx
{avgDistance !== null && stat('Avg Distance', fmtDistance(avgDistance))}
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev`. Check two or more rows. Sidebar should show both Total Distance and Avg Distance. Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/app/components/ActivityTable.tsx
git commit -m "feat: add Avg Distance to multi-select summary"
```

---

## Task 4: Add GET handler for `/api/activities/[id]`

**Files:**
- Create: `src/app/api/activities/[id]/route.ts`

- [ ] **Step 1: Create the route file**

Create `src/app/api/activities/[id]/route.ts`:

```tsx
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

async function requireSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return null;
}

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireSession();
  if (unauth) return unauth;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  try {
    const rows = await sql.query(
      `SELECT id, date, name, activity_type, duration_sec, distance_m, elevation_gain_m,
              avg_speed_kmh, avg_hr, max_hr, calories, avg_power, tss,
              avg_temperature, min_temperature, max_temperature,
              start_lat, start_lon, location_name, description
       FROM activities WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify with curl**

Find an existing activity id (open the browser DevTools network tab while loading `/`, copy any id from `/api/activities` response). Then:

```bash
# Log in first via the browser, copy the session cookie value.
COOKIE='app_session=...'
curl -s -H "Cookie: $COOKIE" http://localhost:3000/api/activities/<some-real-id> | head -c 500
```

Expected: a JSON object for that activity.

Also test:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $COOKIE" http://localhost:3000/api/activities/999999999999
```

Expected: `404`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" -H "Cookie: $COOKIE" http://localhost:3000/api/activities/abc
```

Expected: `400`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/activities/1
```

Expected: `401` (no cookie).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/activities/[id]/route.ts
git commit -m "feat: add GET /api/activities/[id] endpoint"
```

---

## Task 5: Add PATCH handler for `/api/activities/[id]`

Only `description` is editable. Body validated explicitly.

**Files:**
- Modify: `src/app/api/activities/[id]/route.ts`

- [ ] **Step 1: Add the PATCH handler**

In `src/app/api/activities/[id]/route.ts`, append below the `GET` function:

```tsx
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unauth = await requireSession();
  if (unauth) return unauth;

  const { id: rawId } = await params;
  const id = parseId(rawId);
  if (id === null) {
    return NextResponse.json({ error: 'Invalid id' }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (typeof body !== 'object' || body === null) {
    return NextResponse.json({ error: 'Body must be an object' }, { status: 400 });
  }

  const { description } = body as { description?: unknown };
  if (description !== null && typeof description !== 'string') {
    return NextResponse.json(
      { error: '`description` must be a string or null' },
      { status: 400 }
    );
  }

  try {
    const rows = await sql.query(
      `UPDATE activities SET description = $1 WHERE id = $2
       RETURNING id, date, name, activity_type, duration_sec, distance_m, elevation_gain_m,
                 avg_speed_kmh, avg_hr, max_hr, calories, avg_power, tss,
                 avg_temperature, min_temperature, max_temperature,
                 start_lat, start_lon, location_name, description`,
      [description, id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Update failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify with curl**

```bash
COOKIE='app_session=...'
ID=<some-real-id>
curl -s -X PATCH -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"description":"test note from plan"}' \
  http://localhost:3000/api/activities/$ID | head -c 500
```

Expected: returned object includes `"description":"test note from plan"`.

Then verify GET reflects it:
```bash
curl -s -H "Cookie: $COOKIE" http://localhost:3000/api/activities/$ID | grep -o '"description":"[^"]*"'
```

Expected: shows the updated string.

Test validation:
```bash
curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"description":42}' http://localhost:3000/api/activities/$ID
```

Expected: `400`.

Reset the description so testing is clean:
```bash
curl -s -X PATCH -H "Cookie: $COOKIE" -H "Content-Type: application/json" \
  -d '{"description":null}' http://localhost:3000/api/activities/$ID > /dev/null
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/activities/[id]/route.ts
git commit -m "feat: add PATCH /api/activities/[id] endpoint for editable description"
```

---

## Task 6: Add a pure `findNeighbors` helper with unit test

The Prev/Next logic is the one non-trivial piece of pure logic. Extracting it lets us test it in isolation.

**Files:**
- Create: `src/lib/activity-neighbors.ts`
- Create: `src/lib/activity-neighbors.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/activity-neighbors.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findNeighbors } from './activity-neighbors';

describe('findNeighbors', () => {
  it('returns null for both when id is not in list', () => {
    expect(findNeighbors([1, 2, 3], 99)).toEqual({ prev: null, next: null, index: -1 });
  });

  it('returns null prev when at first position', () => {
    expect(findNeighbors([10, 20, 30], 10)).toEqual({ prev: null, next: 20, index: 0 });
  });

  it('returns null next when at last position', () => {
    expect(findNeighbors([10, 20, 30], 30)).toEqual({ prev: 20, next: null, index: 2 });
  });

  it('returns both neighbors when in the middle', () => {
    expect(findNeighbors([10, 20, 30], 20)).toEqual({ prev: 10, next: 30, index: 1 });
  });

  it('returns null for both when list has a single matching item', () => {
    expect(findNeighbors([42], 42)).toEqual({ prev: null, next: null, index: 0 });
  });

  it('returns null for both when list is empty', () => {
    expect(findNeighbors([], 1)).toEqual({ prev: null, next: null, index: -1 });
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run:
```bash
npx vitest run src/lib/activity-neighbors.test.ts
```

Expected: fails with module-not-found for `./activity-neighbors`.

- [ ] **Step 3: Write the implementation**

Create `src/lib/activity-neighbors.ts`:

```ts
export interface Neighbors {
  prev: number | null;
  next: number | null;
  index: number;
}

export function findNeighbors(ids: number[], currentId: number): Neighbors {
  const index = ids.indexOf(currentId);
  if (index === -1) return { prev: null, next: null, index: -1 };
  return {
    prev: index > 0 ? ids[index - 1] : null,
    next: index < ids.length - 1 ? ids[index + 1] : null,
    index,
  };
}
```

- [ ] **Step 4: Run the test and confirm it passes**

Run:
```bash
npx vitest run src/lib/activity-neighbors.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/activity-neighbors.ts src/lib/activity-neighbors.test.ts
git commit -m "feat: add findNeighbors helper with tests"
```

---

## Task 7: Create the `/activity/[id]` server route (skeleton)

Server component fetches the activity via the API and renders a placeholder client component. We'll flesh out the client component in the next tasks.

**Files:**
- Create: `src/app/activity/[id]/page.tsx`
- Create: `src/app/activity/[id]/ActivityDetail.tsx`

- [ ] **Step 1: Create the server page**

Create `src/app/activity/[id]/page.tsx`:

```tsx
import { notFound } from 'next/navigation';
import { sql } from '@/lib/db';
import type { Activity } from '@/lib/db';
import ActivityDetail from './ActivityDetail';

async function loadActivity(id: number): Promise<Activity | null> {
  const rows = await sql.query(
    `SELECT id, date, name, activity_type, duration_sec, distance_m, elevation_gain_m,
            avg_speed_kmh, avg_hr, max_hr, calories, avg_power, tss,
            avg_temperature, min_temperature, max_temperature,
            start_lat, start_lon, location_name, description
     FROM activities WHERE id = $1`,
    [id]
  );
  return (rows[0] as Activity | undefined) ?? null;
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const activity = await loadActivity(id);
  if (!activity) notFound();

  return <ActivityDetail activity={activity} />;
}
```

> Note: auth happens at the middleware/layout level for `/` — confirm no extra guard is needed here by checking `src/middleware.ts` or `src/app/layout.tsx`. If the existing setup does not already protect `/activity/[id]`, add the same session check used in API routes inside the page component (it's an async server component so `cookies()` and `isValidSession` work the same way; redirect to `/login` if unauthenticated).

- [ ] **Step 2: Check whether existing middleware/layout already gates this route**

Run:
```bash
ls src/middleware.ts src/app/layout.tsx 2>/dev/null
grep -nE "isValidSession|SESSION_COOKIE|redirect.*login" src/middleware.ts src/app/layout.tsx 2>/dev/null
```

If middleware already protects all routes by default, skip Step 3. Otherwise do Step 3.

- [ ] **Step 3 (only if not already gated): Add session guard to the server page**

Replace the body of `ActivityPage` with:

```tsx
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

// ...inside ActivityPage, before loadActivity:
const cookieStore = await cookies();
const token = cookieStore.get(SESSION_COOKIE)?.value;
if (!(await isValidSession(token))) redirect('/login');
```

- [ ] **Step 4: Create the client component skeleton**

Create `src/app/activity/[id]/ActivityDetail.tsx`:

```tsx
'use client';

import Link from 'next/link';
import type { Activity } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ActivityStats from '@/app/components/ActivityStats';

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtActivity(t: string | null) {
  if (!t) return '—';
  return t.replace(/_/g, ' ');
}

const TYPE_BADGE: Record<string, string> = {
  'road biking':    'bg-primary/10 text-primary border-primary/20',
  'virtual ride':   'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'indoor cycling': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

function activityBadgeClass(type: string | null): string {
  const key = (type ?? '').toLowerCase().replace(/_/g, ' ');
  return TYPE_BADGE[key] ?? 'bg-secondary text-secondary-foreground border-transparent';
}

export default function ActivityDetail({ activity }: { activity: Activity }) {
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        {/* Sticky header bar */}
        <div className="sticky top-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border z-10">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to list
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>◀ Prev</Button>
              <Button variant="outline" size="sm" disabled>Next ▶</Button>
            </div>
            <span className="text-xs text-muted-foreground min-w-[70px] text-right">Saved ✓</span>
          </div>
        </div>

        {/* Title block */}
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground leading-snug">
            {activity.name || '—'}
          </h1>
          <div className="flex items-center gap-2">
            <Badge className={cn('rounded-full text-[11px] font-medium', activityBadgeClass(activity.activity_type))}>
              {fmtActivity(activity.activity_type)}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground">{fmtDate(activity.date)}</span>
          </div>
        </div>

        {/* Stats */}
        <ActivityStats activity={activity} layout="wide" />
      </div>
    </main>
  );
}
```

- [ ] **Step 5: Verify in browser**

Run `npm run dev`. Open `http://localhost:3000/activity/<some-real-id>` (id you used during API testing). Verify:
- Title, badge, date show correctly.
- Stats grid renders in 4 columns on a wide window.
- "Back to list" returns to `/`.
- Prev/Next disabled.
- Save status shows "Saved ✓".

Open `http://localhost:3000/activity/99999999999` → 404 page.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/app/activity/[id]/page.tsx src/app/activity/[id]/ActivityDetail.tsx
git commit -m "feat: add /activity/[id] route with stats display"
```

---

## Task 8: Wire Prev/Next navigation

Read sort+filter from URL search params, fetch the same list the table would, compute neighbors, wire the buttons.

**Files:**
- Modify: `src/app/activity/[id]/ActivityDetail.tsx`

- [ ] **Step 1: Replace ActivityDetail with the Prev/Next-aware version**

Replace the entire body of `src/app/activity/[id]/ActivityDetail.tsx` with:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Activity } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ActivityStats from '@/app/components/ActivityStats';
import { findNeighbors } from '@/lib/activity-neighbors';

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtActivity(t: string | null) {
  if (!t) return '—';
  return t.replace(/_/g, ' ');
}

const TYPE_BADGE: Record<string, string> = {
  'road biking':    'bg-primary/10 text-primary border-primary/20',
  'virtual ride':   'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'indoor cycling': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

function activityBadgeClass(type: string | null): string {
  const key = (type ?? '').toLowerCase().replace(/_/g, ' ');
  return TYPE_BADGE[key] ?? 'bg-secondary text-secondary-foreground border-transparent';
}

function buildListQuery(params: URLSearchParams): string {
  const q = new URLSearchParams();
  const sort = params.get('sort') ?? 'date';
  const dir = params.get('dir') ?? 'desc';
  q.set('sortBy', sort);
  q.set('sortDir', dir);
  const search = params.get('search');
  const from = params.get('from');
  const to = params.get('to');
  if (search) q.set('search', search);
  if (from) q.set('dateFrom', from);
  if (to) q.set('dateTo', to);
  return q.toString();
}

function detailHref(id: number, params: URLSearchParams): string {
  const carried = new URLSearchParams();
  for (const key of ['sort', 'dir', 'search', 'from', 'to']) {
    const v = params.get(key);
    if (v) carried.set(key, v);
  }
  const qs = carried.toString();
  return qs ? `/activity/${id}?${qs}` : `/activity/${id}`;
}

export default function ActivityDetail({ activity }: { activity: Activity }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [orderedIds, setOrderedIds] = useState<number[] | null>(null);
  const [neighborsError, setNeighborsError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setNeighborsError(false);
    const qs = buildListQuery(searchParams);
    fetch(`/api/activities?${qs}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((rows: Activity[]) => {
        if (cancelled) return;
        setOrderedIds(rows.map((a) => a.id));
      })
      .catch(() => {
        if (cancelled) return;
        setNeighborsError(true);
        setOrderedIds([]);
      });
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  const neighbors = useMemo(
    () => (orderedIds ? findNeighbors(orderedIds, activity.id) : { prev: null, next: null, index: -1 }),
    [orderedIds, activity.id]
  );

  const goPrev = () => {
    if (neighbors.prev !== null) router.push(detailHref(neighbors.prev, searchParams));
  };
  const goNext = () => {
    if (neighbors.next !== null) router.push(detailHref(neighbors.next, searchParams));
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      } else if (e.key === 'Escape') {
        router.push('/');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [neighbors.prev, neighbors.next]);

  const prevDisabled = neighbors.prev === null;
  const nextDisabled = neighbors.next === null;

  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="sticky top-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border z-10">
          <div className="flex items-center justify-between gap-3">
            <Link href={`/?${buildListQuery(searchParams)}`} className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to list
            </Link>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={prevDisabled}
                onClick={goPrev}
                title={neighborsError ? 'Could not load list context' : prevDisabled ? 'No earlier activity' : 'Previous (←)'}
              >
                ◀ Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={nextDisabled}
                onClick={goNext}
                title={neighborsError ? 'Could not load list context' : nextDisabled ? 'No later activity' : 'Next (→)'}
              >
                Next ▶
              </Button>
            </div>
            <span className="text-xs text-muted-foreground min-w-[70px] text-right">Saved ✓</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground leading-snug">
            {activity.name || '—'}
          </h1>
          <div className="flex items-center gap-2">
            <Badge className={cn('rounded-full text-[11px] font-medium', activityBadgeClass(activity.activity_type))}>
              {fmtActivity(activity.activity_type)}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground">{fmtDate(activity.date)}</span>
          </div>
        </div>

        <ActivityStats activity={activity} layout="wide" />
      </div>
    </main>
  );
}
```

> Note: `buildListQuery` for "Back to list" maps `sort`→`sortBy`, `dir`→`sortDir`, `from`→`dateFrom`, `to`→`dateTo`. The table doesn't currently read those URL params (it uses local state). The "Back to list" link still works — params are just ignored. Later we may wire the table to read them; that's out of scope here.

- [ ] **Step 2: Verify Prev/Next manually**

Run `npm run dev`. Pick two adjacent activity ids (from `/api/activities`). Open the first one with `/activity/<id1>`. Click Next → URL should change to the next activity in default sort order. Press `←` → go back. Verify Prev disabled at the first id of the default list (top of the table — most recent date). Verify Next disabled at the last id (oldest activity).

Try `/activity/<id>?sort=date&dir=asc` — Prev/Next now follow ascending order.

Try `/activity/<id>?search=ride` — Prev/Next only walks through filtered set.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/app/activity/[id]/ActivityDetail.tsx
git commit -m "feat: wire Prev/Next navigation across sort+filter context"
```

---

## Task 9: Add notes textarea with autosave

**Files:**
- Modify: `src/app/activity/[id]/ActivityDetail.tsx`

- [ ] **Step 1: Add imports and save state at the top of ActivityDetail**

In `src/app/activity/[id]/ActivityDetail.tsx`:

Merge `useCallback` and `useRef` into the existing React import so it becomes:
```tsx
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
```

Add these new imports next to the others:
```tsx
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
```

Inside the `ActivityDetail` component, after the existing `useState`/`useEffect` for `orderedIds`, add:

```tsx
type SaveState = 'saved' | 'saving' | 'error';

const [notes, setNotes] = useState<string>(activity.description ?? '');
const [lastSaved, setLastSaved] = useState<string>(activity.description ?? '');
const [saveState, setSaveState] = useState<SaveState>('saved');
const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
const inFlight = useRef<Promise<void> | null>(null);

const persist = useCallback(async (value: string) => {
  setSaveState('saving');
  const send = (async () => {
    try {
      const res = await fetch(`/api/activities/${activity.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: value === '' ? null : value }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setLastSaved(value);
      setSaveState('saved');
    } catch (e) {
      setSaveState('error');
      toast.error(`Failed to save notes: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  })();
  inFlight.current = send;
  await send;
  inFlight.current = null;
}, [activity.id]);

const scheduleSave = useCallback((value: string) => {
  if (saveTimer.current) clearTimeout(saveTimer.current);
  saveTimer.current = setTimeout(() => {
    saveTimer.current = null;
    void persist(value);
  }, 800);
}, [persist]);

const flushSave = useCallback(async () => {
  if (saveTimer.current) {
    clearTimeout(saveTimer.current);
    saveTimer.current = null;
  }
  if (notes !== lastSaved) {
    await persist(notes);
  } else if (inFlight.current) {
    await inFlight.current;
  }
}, [notes, lastSaved, persist]);

useEffect(() => {
  return () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      // Best-effort: fire a final save on unmount if dirty.
      if (notes !== lastSaved) {
        void persist(notes);
      }
    }
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);
```

- [ ] **Step 2: Render the Notes section and update save-status label**

Update the save-status `<span>` in the header to dynamic text:

Replace:
```tsx
<span className="text-xs text-muted-foreground min-w-[70px] text-right">Saved ✓</span>
```

with:
```tsx
<span
  className={cn(
    'text-xs min-w-[100px] text-right',
    saveState === 'saved' && 'text-muted-foreground',
    saveState === 'saving' && 'text-muted-foreground',
    saveState === 'error' && 'text-destructive'
  )}
>
  {saveState === 'saved' && 'Saved ✓'}
  {saveState === 'saving' && 'Saving…'}
  {saveState === 'error' && (
    <button
      type="button"
      className="underline hover:no-underline"
      onClick={() => void persist(notes)}
    >
      Unsaved — retry
    </button>
  )}
</span>
```

At the bottom of the main content (after `<ActivityStats ... />`), add:

```tsx
<section className="flex flex-col gap-2">
  <h2 className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
    Notes
  </h2>
  <Textarea
    value={notes}
    onChange={(e) => {
      setNotes(e.target.value);
      scheduleSave(e.target.value);
    }}
    onBlur={() => void flushSave()}
    rows={12}
    placeholder="Write about this ride…"
    className="font-sans text-sm leading-relaxed resize-y"
  />
</section>
```

- [ ] **Step 3: Verify Toaster is mounted globally**

Check `src/app/layout.tsx` for `<Toaster />`. From recent commits (`70a334f chore: add shadcn dialog and sonner toaster`) it should already be there. If not, add it:

```tsx
import { Toaster } from '@/components/ui/sonner';
// inside the body:
<Toaster />
```

- [ ] **Step 4: Verify in browser**

Run `npm run dev`. Open `/activity/<some-id>`. Type into the notes textarea. Watch status: `Saving…` after ~800ms, then `Saved ✓`. Refresh the page → notes persist. Clear the textarea → after debounce, status returns to `Saved ✓`; refresh → empty.

Simulate failure: stop the dev server while a save is queued. Type more, wait — toast appears, status shows red `Unsaved — retry`. Restart server, click the retry — saves successfully.

Stop the server.

- [ ] **Step 5: Commit**

```bash
git add src/app/activity/[id]/ActivityDetail.tsx
git commit -m "feat: add autosaving notes textarea on activity detail page"
```

---

## Task 10: Make Prev/Next safe across in-flight saves

Flush save before navigation; disable buttons while in flight.

**Files:**
- Modify: `src/app/activity/[id]/ActivityDetail.tsx`

- [ ] **Step 1: Update goPrev/goNext to await flushSave**

Replace:

```tsx
const goPrev = () => {
  if (neighbors.prev !== null) router.push(detailHref(neighbors.prev, searchParams));
};
const goNext = () => {
  if (neighbors.next !== null) router.push(detailHref(neighbors.next, searchParams));
};
```

with:

```tsx
const goPrev = useCallback(async () => {
  if (neighbors.prev === null) return;
  await flushSave();
  router.push(detailHref(neighbors.prev, searchParams));
}, [neighbors.prev, flushSave, router, searchParams]);

const goNext = useCallback(async () => {
  if (neighbors.next === null) return;
  await flushSave();
  router.push(detailHref(neighbors.next, searchParams));
}, [neighbors.next, flushSave, router, searchParams]);
```

Update the keyboard handler's deps array to include `goPrev`/`goNext` instead of `neighbors.prev`/`neighbors.next` and call them:

```tsx
useEffect(() => {
  const onKey = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      void goPrev();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      void goNext();
    } else if (e.key === 'Escape') {
      void flushSave().then(() => router.push('/'));
    }
  };
  window.addEventListener('keydown', onKey);
  return () => window.removeEventListener('keydown', onKey);
}, [goPrev, goNext, flushSave, router]);
```

Update the button `onClick` to `() => void goPrev()` / `() => void goNext()`.

Add `saving` to the disabled condition:

```tsx
const prevDisabled = neighbors.prev === null || saveState === 'saving';
const nextDisabled = neighbors.next === null || saveState === 'saving';
```

- [ ] **Step 2: Verify**

Run `npm run dev`. Type in notes, immediately click Next — should briefly show `Saving…`, then navigate. Refresh the previous activity → notes persisted.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/app/activity/[id]/ActivityDetail.tsx
git commit -m "feat: flush save before Prev/Next navigation"
```

---

## Task 11: Dispatch `activities:changed` on save and on unmount

So the table's "note" badge refreshes when returning.

**Files:**
- Modify: `src/app/activity/[id]/ActivityDetail.tsx`

- [ ] **Step 1: Dispatch after successful save**

In `persist`, after `setLastSaved(value); setSaveState('saved');`, add:

```tsx
window.dispatchEvent(new CustomEvent('activities:changed'));
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev`. Edit notes on an activity that previously had no note. Click "Back to list". The row should now show the "note" badge. Edit again and clear the description. Back to list. Badge disappears.

Stop the server.

- [ ] **Step 3: Commit**

```bash
git add src/app/activity/[id]/ActivityDetail.tsx
git commit -m "feat: broadcast activities:changed after notes save"
```

---

## Task 12: Wire entry points from the table

Activity name becomes a link; Enter opens detail; sidebar gets an Open button.

**Files:**
- Modify: `src/app/components/ActivityTable.tsx`

- [ ] **Step 1: Build a shared helper for the detail href in ActivityTable**

In `src/app/components/ActivityTable.tsx`, near the top of the file (below the helpers, above the component), add:

```tsx
function buildDetailHref(
  id: number,
  sort: SortState,
  search: string,
  dateFrom: string,
  dateTo: string
): string {
  const params = new URLSearchParams();
  if (sort.key !== 'date' || sort.dir !== 'desc') {
    params.set('sort', String(sort.key));
    params.set('dir', sort.dir);
  }
  if (search) params.set('search', search);
  if (dateFrom) params.set('from', dateFrom);
  if (dateTo) params.set('to', dateTo);
  const qs = params.toString();
  return qs ? `/activity/${id}?${qs}` : `/activity/${id}`;
}
```

- [ ] **Step 2: Make the name cell a link**

In `renderCell`, replace the `case 'name':` body with:

```tsx
case 'name':
  return (
    <span className="inline-flex items-center gap-1.5 truncate">
      <Link
        href={buildDetailHref(a.id, sort, search, dateFrom, dateTo)}
        className="hover:underline truncate"
        onClick={(e) => e.stopPropagation()}
      >
        {a.name || <span className="text-muted-foreground">—</span>}
      </Link>
      {!!a.description && (
        <Badge
          variant="outline"
          className={`text-xs leading-none py-0 ${
            isSelected ? 'border-primary/60 text-primary' : ''
          }`}
          title="Has diary note"
        >
          note
        </Badge>
      )}
    </span>
  );
```

Add the import at the top:
```tsx
import Link from 'next/link';
```

- [ ] **Step 3: Add Enter-key navigation**

Add at the top:
```tsx
import { useRouter } from 'next/navigation';
```

Inside the component:
```tsx
const router = useRouter();
```

In `handleKeyDown`, before the existing `ArrowDown`/`ArrowUp` check, handle Enter:

```tsx
if (e.key === 'Enter' && focusedIndex !== null && activities[focusedIndex]) {
  e.preventDefault();
  const target = activities[focusedIndex];
  router.push(buildDetailHref(target.id, sort, search, dateFrom, dateTo));
  return;
}
```

- [ ] **Step 4: Add an "Open" button to the single-activity sidebar header**

In `ActivitySidePanel`, the header `<div className="flex items-start justify-between gap-3 mb-2">` currently has the `<h2>` and the close button. Add an "Open" button between them:

Replace that block with:

```tsx
<div className="flex items-start justify-between gap-3 mb-2">
  <h2
    className="text-[17px] font-bold tracking-tight text-foreground leading-snug"
    title={activity.name ?? ''}
  >
    {activity.name || '—'}
  </h2>
  <div className="flex items-center gap-1 shrink-0">
    <Link
      href={openHref}
      className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
    >
      Open
    </Link>
    <Button
      variant="ghost"
      size="icon"
      className="h-7 w-7 text-muted-foreground"
      onClick={onClose}
      aria-label="Close"
    >
      <X className="h-3.5 w-3.5" />
    </Button>
  </div>
</div>
```

Update `ActivitySidePanel`'s props to accept `openHref`:

```tsx
function ActivitySidePanel({
  activity,
  onClose,
  openHref,
}: {
  activity: Activity;
  onClose: () => void;
  openHref: string;
}) {
```

And ensure `Link` is imported at the top of the file (already added in Step 2).

Update the call site (near the bottom of the component):

```tsx
<ActivitySidePanel
  activity={selectedActivities[0]}
  openHref={buildDetailHref(selectedActivities[0].id, sort, search, dateFrom, dateTo)}
  onClose={() => {
    setSelectedIds(new Set());
    setFocusedIndex(null);
  }}
/>
```

- [ ] **Step 5: Verify in browser**

Run `npm run dev`.

1. Click an activity name (not the row) → navigates to detail.
2. Click elsewhere on the row → sidebar still opens (Link's `stopPropagation` prevents row-click but row-click is still wired on the `<tr>`).
3. With sidebar open, click "Open" → detail page.
4. Use ↑/↓ to focus a row, press Enter → detail page with the focused activity.
5. With filters/search active, open detail — confirm URL has the filter params and Prev/Next walks the filtered set.

Stop the server.

- [ ] **Step 6: Commit**

```bash
git add src/app/components/ActivityTable.tsx
git commit -m "feat: link activity rows to detail page from table and sidebar"
```

---

## Task 13: Final polish and full manual walkthrough

**Files:**
- (no code changes unless issues found)

- [ ] **Step 1: Run the full type-check / build**

```bash
npm run build
```

Expected: succeeds with no errors. Fix anything that fails.

- [ ] **Step 2: Run unit tests**

```bash
npx vitest run
```

Expected: all tests pass (including `findNeighbors`).

- [ ] **Step 3: Manual verification — full walkthrough**

Run `npm run dev` and check each item:

- [ ] Click an activity name → detail page opens with all fields.
- [ ] Refresh the detail page → still works (deep-linkable).
- [ ] Edit notes, wait 1s → status `Saved ✓`. Refresh → persists.
- [ ] Edit notes, click Next without waiting → save flushes first; previous activity persists.
- [ ] At first activity in current sort: Prev disabled. At last: Next disabled.
- [ ] Filter the table (e.g. search "ride"), open an activity, navigate Next → moves through filtered set in same order.
- [ ] Edit notes on an activity with no prior note → "Back to list" → "note" badge appears on the row.
- [ ] Open `/activity/9999999` → 404.
- [ ] Multi-select 3 rows → sidebar shows totals AND Avg Distance.
- [ ] Sidebar has no editable surface; "Open" navigates to detail.
- [ ] Keyboard on table: focus row with ↑/↓, press Enter → detail opens.
- [ ] Keyboard on detail: ← / → move Prev/Next; Esc returns to list (saves first).
- [ ] Import a new batch of activities → table still refreshes (the renamed `activities:changed` event still wires up import → table).

- [ ] **Step 4: Commit any tweaks**

If you adjusted anything during manual verification:

```bash
git add -A
git commit -m "fix: address issues found during manual verification"
```

(Skip if nothing changed.)

- [ ] **Step 5: Push the branch**

```bash
git push -u origin HEAD
```

Then open a PR via:

```bash
gh pr create --title "feat: full-screen activity detail view with editable notes" --body "$(cat <<EOF
## Summary
- Adds /activity/[id] route showing all activity fields and an editable notes textarea (autosave).
- Prev/Next navigation walks the table's current sort + filter context.
- Sidebar preserved as read-only; activity names in the table now link to detail.
- Multi-select summary gains Avg Distance.
- New PATCH /api/activities/[id] endpoint.

## Test plan
- [ ] Manual walkthrough per docs/superpowers/plans/2026-05-29-activity-detail-view.md Task 13.
- [ ] npm run build passes.
- [ ] npx vitest run passes.
EOF
)"
```

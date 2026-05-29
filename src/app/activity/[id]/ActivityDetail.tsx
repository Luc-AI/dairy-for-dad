'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Activity } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
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
        if (notes !== lastSaved) {
          void persist(notes);
        }
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      </div>
    </main>
  );
}

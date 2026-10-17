'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Check, ChevronDown, ChevronLeft, ChevronRight, Loader2, MapPin } from 'lucide-react';
import type { Activity } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import ActivityStats, { HeroStats } from '@/app/components/ActivityStats';
import { findNeighbors, pagerTargets } from '@/lib/activity-neighbors';
import { activityBadgeClass, activityTypeLabel } from '@/lib/activity-types';
import { fmtDate, fmtDateShort, fmtDateWithWeekday } from '@/lib/format';
import { detailHref, listHref, parseListFilters, toApiParams } from '@/lib/list-query';
import { useIsDesktop } from '@/hooks/use-media-query';

type SaveState = 'saved' | 'saving' | 'error';

function SaveIndicator({ state, onRetry }: { state: SaveState; onRetry: () => void }) {
  if (state === 'error') {
    return (
      <Button variant="ghost" size="sm" className="h-11 text-destructive hover:text-destructive" onClick={onRetry}>
        Nicht gespeichert – erneut versuchen
      </Button>
    );
  }
  return (
    <span className="flex items-center gap-1.5 pr-2 text-sm text-muted-foreground" role="status">
      {state === 'saving' ? (
        <>
          <Loader2 className="size-4 animate-spin" /> Speichert…
        </>
      ) : (
        <>
          <Check className="size-4" /> Gespeichert
        </>
      )}
    </span>
  );
}

export default function ActivityDetail({ activity }: { activity: Activity }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseListFilters(searchParams), [searchParams]);
  const isDesktop = useIsDesktop();

  // ---------------------------------------------------------------------------
  // List context for prev/next
  // ---------------------------------------------------------------------------

  const [listRows, setListRows] = useState<Pick<Activity, 'id' | 'date'>[] | null>(null);
  const [neighborsError, setNeighborsError] = useState(false);
  const apiQuery = toApiParams(filters).toString();

  useEffect(() => {
    const ctrl = new AbortController();
    setNeighborsError(false);
    fetch(`/api/activities?${apiQuery}`, { signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json() as Promise<Activity[]>;
      })
      .then((rows) => setListRows(rows.map(({ id, date }) => ({ id, date }))))
      .catch(() => {
        if (ctrl.signal.aborted) return;
        setNeighborsError(true);
        setListRows([]);
      });
    return () => ctrl.abort();
  }, [apiQuery]);

  const targets = useMemo(() => {
    const ids = listRows?.map((r) => r.id) ?? [];
    return pagerTargets(findNeighbors(ids, activity.id), filters);
  }, [listRows, activity.id, filters]);

  const dateOf = useCallback(
    (id: number | null) => (id === null ? null : (listRows?.find((r) => r.id === id)?.date ?? null)),
    [listRows]
  );

  // ---------------------------------------------------------------------------
  // Notes autosave
  // ---------------------------------------------------------------------------

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
        window.dispatchEvent(new CustomEvent('activities:changed'));
      } catch (e) {
        setSaveState('error');
        toast.error(`Tagebuch konnte nicht gespeichert werden: ${e instanceof Error ? e.message : 'Unbekannter Fehler'}`);
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

  // Warn before closing the tab with unsaved text.
  const dirty = notes !== lastSaved || saveState === 'saving';
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  // ---------------------------------------------------------------------------
  // Navigation
  // ---------------------------------------------------------------------------

  const goTo = useCallback(async (id: number | null) => {
    if (id === null) return;
    await flushSave();
    router.push(detailHref(id, filters));
  }, [flushSave, router, filters]);

  const goLeft = useCallback(() => void goTo(targets.left), [goTo, targets.left]);
  const goRight = useCallback(() => void goTo(targets.right), [goTo, targets.right]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goLeft();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goRight();
      } else if (e.key === 'Escape') {
        void flushSave().then(() => router.push(listHref(filters)));
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goLeft, goRight, flushSave, router, filters]);

  // Horizontal swipe flips between activities. Ignored on the textarea and
  // near the screen edges, where iOS uses the gesture for browser back/forward.
  const touchStart = useRef<{ x: number; y: number } | null>(null);
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0];
    const nearEdge = t.clientX < 24 || t.clientX > window.innerWidth - 24;
    touchStart.current =
      e.target instanceof HTMLTextAreaElement || nearEdge ? null : { x: t.clientX, y: t.clientY };
  }
  function onTouchEnd(e: React.TouchEvent) {
    const start = touchStart.current;
    touchStart.current = null;
    if (!start) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - start.x;
    const dy = t.clientY - start.y;
    if (Math.abs(dx) > 80 && Math.abs(dy) < 50) {
      if (dx > 0) goLeft();
      else goRight();
    }
  }

  const [moreOpen, setMoreOpen] = useState<boolean | null>(null);
  const leftDate = dateOf(targets.left);
  const rightDate = dateOf(targets.right);
  const navBusy = saveState === 'saving';
  const navUnavailable = neighborsError ? 'Liste konnte nicht geladen werden' : undefined;

  const mapsHref =
    activity.start_lat != null && activity.start_lon != null
      ? `https://www.google.com/maps/search/?api=1&query=${activity.start_lat},${activity.start_lon}`
      : null;

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-10 border-b bg-background/95 pt-[env(safe-area-inset-top)] backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-3xl items-center gap-1 px-2">
          <Button variant="ghost" size="icon" className="size-11" asChild>
            <Link href={listHref(filters)} aria-label="Zurück zur Liste" onClick={() => void flushSave()}>
              <ArrowLeft className="size-5" />
            </Link>
          </Button>
          <span className="flex-1 truncate text-sm font-medium">{fmtDateWithWeekday(activity.date)}</span>
          <SaveIndicator state={saveState} onRetry={() => void persist(notes)} />
        </div>
      </header>

      <main
        className="mx-auto w-full max-w-3xl flex-1 space-y-6 px-4 py-5"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="space-y-2">
          <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            {activity.name || 'Ohne Titel'}
          </h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <Badge className={cn('rounded-full text-xs font-medium', activityBadgeClass(activity.activity_type))}>
              {activityTypeLabel(activity.activity_type)}
            </Badge>
            {activity.location_name &&
              (mapsHref ? (
                <a
                  href={mapsHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 items-center gap-1 underline-offset-4 hover:underline"
                >
                  <MapPin className="size-4" />
                  {activity.location_name}
                </a>
              ) : (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-4" />
                  {activity.location_name}
                </span>
              ))}
          </div>
        </div>

        <HeroStats activity={activity} />

        <section className="space-y-2">
          <Label htmlFor="notes" className="text-base font-semibold">
            Tagebuch
          </Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => {
              setNotes(e.target.value);
              scheduleSave(e.target.value);
            }}
            onBlur={() => void flushSave()}
            placeholder="Wie war die Fahrt? Wetter, Begleitung, Erlebnisse…"
            className="min-h-40 resize-none text-base leading-relaxed md:text-base"
          />
        </section>

        <Collapsible open={moreOpen ?? isDesktop ?? false} onOpenChange={setMoreOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="group -mx-2 h-11 w-[calc(100%+1rem)] justify-between px-2 text-base font-semibold">
              Weitere Werte
              <ChevronDown className="size-5 transition-transform group-data-[state=open]:rotate-180" />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <ActivityStats activity={activity} showBasics={false} className="sm:grid-cols-3" />
          </CollapsibleContent>
        </Collapsible>
      </main>

      <nav
        aria-label="Andere Aktivitäten"
        className="sticky bottom-0 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur supports-[backdrop-filter]:bg-background/80"
      >
        <div className="mx-auto flex max-w-3xl gap-3 px-4 py-2">
          <Button
            variant="outline"
            className="h-11 flex-1 justify-start"
            disabled={targets.left === null || navBusy}
            onClick={goLeft}
            title={navUnavailable ?? 'Taste ←'}
            aria-label={leftDate ? `Vorherige Aktivität, ${fmtDate(leftDate)}` : 'Vorherige Aktivität'}
          >
            <ChevronLeft className="size-5" />
            {leftDate ? fmtDateShort(leftDate) : 'Zurück'}
          </Button>
          <Button
            variant="outline"
            className="h-11 flex-1 justify-end"
            disabled={targets.right === null || navBusy}
            onClick={goRight}
            title={navUnavailable ?? 'Taste →'}
            aria-label={rightDate ? `Nächste Aktivität, ${fmtDate(rightDate)}` : 'Nächste Aktivität'}
          >
            {rightDate ? fmtDateShort(rightDate) : 'Weiter'}
            <ChevronRight className="size-5" />
          </Button>
        </div>
      </nav>
    </div>
  );
}

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Search, SearchX, X } from 'lucide-react';
import type { Activity } from '@/lib/db';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from '@/components/ui/input-group';
import { useIsDesktop } from '@/hooks/use-media-query';
import { fmtDistance, fmtElevation } from '@/lib/format';
import {
  DEFAULT_FILTERS,
  listHref,
  parseListFilters,
  toApiParams,
  type ListFilters,
} from '@/lib/list-query';
import ActivityCardList, { ActivityCardListSkeleton } from './ActivityCardList';
import ActivityDataTable, { ColumnsMenu, useColumnVisibility } from './ActivityDataTable';
import { FilterDrawer, YearChips } from './ListFilters';

function SummaryLine({ activities }: { activities: Activity[] }) {
  const distance = activities.reduce((s, a) => s + (a.distance_m ?? 0), 0);
  const elevation = activities.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0);
  const n = activities.length;
  return (
    <p className="text-sm text-muted-foreground" aria-live="polite">
      <span className="font-semibold text-foreground">{n.toLocaleString('de-CH')}</span>{' '}
      {n === 1 ? 'Aktivität' : 'Aktivitäten'}
      {distance > 0 && <> · {fmtDistance(distance)}</>}
      {elevation > 0 && <> · {fmtElevation(elevation)}</>}
    </p>
  );
}

export default function ActivityList() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters = useMemo(() => parseListFilters(searchParams), [searchParams]);
  const isDesktop = useIsDesktop();
  const columns = useColumnVisibility();

  // Filters live in the URL so "back" from a detail page restores the list.
  // Read the live URL (not the render-time value) so rapid updates compose.
  const setFilters = useCallback(
    (patch: Partial<ListFilters>) => {
      const current = parseListFilters(new URLSearchParams(window.location.search));
      router.replace(listHref({ ...current, ...patch }), { scroll: false });
    },
    [router]
  );

  // Search input is local for instant typing, pushed to the URL debounced.
  // `pushedSearch` is the last value we wrote; a URL change to anything else
  // (back/forward, reset) overwrites the input. Adjusting state during render
  // is React's recommended alternative to a syncing effect.
  const [searchInput, setSearchInput] = useState(filters.search);
  const [pushedSearch, setPushedSearch] = useState(filters.search);
  const [urlSearch, setUrlSearch] = useState(filters.search);
  if (filters.search !== urlSearch) {
    setUrlSearch(filters.search);
    if (filters.search !== pushedSearch) {
      setPushedSearch(filters.search);
      setSearchInput(filters.search);
    }
  }
  useEffect(() => {
    if (searchInput === filters.search) return;
    const t = setTimeout(() => {
      setPushedSearch(searchInput);
      setFilters({ search: searchInput });
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput, filters.search, setFilters]);

  // Results are keyed by request so loading/error are derived, and the
  // previous list stays on screen (dimmed) while the next one loads.
  const [reloadKey, setReloadKey] = useState(0);
  const apiQuery = toApiParams(filters).toString();
  const requestKey = `${apiQuery}#${reloadKey}`;
  const [result, setResult] = useState<{ key: string; data: Activity[] | null; error: string | null }>({
    key: '',
    data: null,
    error: null,
  });
  const loading = result.key !== requestKey;
  const activities = result.data;
  const error = loading ? null : result.error;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/activities?${apiQuery}`, { signal: ctrl.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<Activity[]>;
      })
      .then((data) => setResult({ key: requestKey, data, error: null }))
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        const message = e instanceof Error ? e.message : 'Unbekannter Fehler';
        setResult((prev) => ({ key: requestKey, data: prev.data, error: message }));
      });
    return () => ctrl.abort();
  }, [apiQuery, requestKey]);

  useEffect(() => {
    const reload = () => setReloadKey((k) => k + 1);
    window.addEventListener('activities:changed', reload);
    return () => window.removeEventListener('activities:changed', reload);
  }, []);

  const [years, setYears] = useState<number[]>([]);
  useEffect(() => {
    fetch('/api/activities/years')
      .then((r) => (r.ok ? (r.json() as Promise<number[]>) : []))
      .then(setYears)
      .catch(() => setYears([]));
  }, [reloadKey]);

  const hasFilters = listHref(filters) !== listHref(DEFAULT_FILTERS);

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-4 space-y-3 border-b bg-background/95 px-4 pt-[max(0.75rem,env(safe-area-inset-top))] pb-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 md:static md:mx-0 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
        <div className="flex gap-2">
          <InputGroup className="h-11 flex-1">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              type="search"
              inputMode="search"
              enterKeyHint="search"
              placeholder="Name, Ort, Tagebuch…"
              aria-label="Aktivitäten durchsuchen"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="text-base md:text-base [&::-webkit-search-cancel-button]:hidden"
            />
            {searchInput && (
              <InputGroupAddon align="inline-end">
                <InputGroupButton size="icon-sm" aria-label="Suche löschen" onClick={() => setSearchInput('')}>
                  <X />
                </InputGroupButton>
              </InputGroupAddon>
            )}
          </InputGroup>
          <FilterDrawer
            filters={filters}
            setFilters={setFilters}
            resultCount={loading ? null : (activities?.length ?? null)}
          />
          {isDesktop && <ColumnsMenu {...columns} />}
        </div>
        <YearChips years={years} filters={filters} setFilters={setFilters} />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle />
          <AlertTitle>Aktivitäten konnten nicht geladen werden</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>Fehler: {error}</span>
            <Button variant="outline" size="sm" onClick={() => setReloadKey((k) => k + 1)}>
              Erneut versuchen
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {activities && <SummaryLine activities={activities} />}

      {activities && activities.length === 0 && !loading ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-12 text-center">
          <SearchX className="size-8 text-muted-foreground" />
          <p className="font-medium">Keine Aktivitäten gefunden</p>
          {hasFilters && (
            <Button
              variant="outline"
              className="h-11"
              onClick={() => {
                setPushedSearch('');
                setSearchInput('');
                router.replace('/', { scroll: false });
              }}
            >
              Filter zurücksetzen
            </Button>
          )}
        </div>
      ) : isDesktop === null || (error && !activities) ? null : isDesktop ? (
        <ActivityDataTable
          activities={activities}
          loading={loading}
          filters={filters}
          setFilters={setFilters}
          visible={columns.visible}
        />
      ) : activities ? (
        <div className={loading ? 'opacity-60 transition-opacity' : undefined}>
          <ActivityCardList activities={activities} filters={filters} />
        </div>
      ) : (
        <ActivityCardListSkeleton />
      )}
    </div>
  );
}

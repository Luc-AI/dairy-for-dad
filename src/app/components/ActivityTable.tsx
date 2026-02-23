'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Activity } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Separator } from '@/components/ui/separator';

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

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

function fmtActivity(t: string | null) {
  if (!t) return '—';
  return t.replace(/_/g, ' ');
}

function fmtTemp(t: number | null) {
  if (t == null) return '—';
  return t.toFixed(1) + '°C';
}

// ---------------------------------------------------------------------------
// Sort state
// ---------------------------------------------------------------------------

type SortKey = keyof Activity;
type SortDir = 'asc' | 'desc';

interface SortState {
  key: SortKey;
  dir: SortDir;
}

// ---------------------------------------------------------------------------
// Column config types
// ---------------------------------------------------------------------------

type ColumnId =
  | 'date'
  | 'name'
  | 'activity_type'
  | 'distance_m'
  | 'elevation_gain_m'
  | 'duration_sec'
  | 'avg_hr'
  | 'avg_power'
  | 'avg_temperature'
  | 'min_temperature'
  | 'max_temperature'
  | 'location_name';

interface ColumnDef {
  id: ColumnId;
  label: string;
  sortKey: SortKey | null;
  align: 'left' | 'right';
  defaultWidth: number;
  minWidth: number;
}

interface ColumnConfig {
  id: ColumnId;
  visible: boolean;
  width: number;
  order: number;
}

interface PersistedColumnState {
  version: 1;
  columns: ColumnConfig[];
}

// ---------------------------------------------------------------------------
// Static column definitions
// ---------------------------------------------------------------------------

const COLUMN_DEFS: ColumnDef[] = [
  { id: 'date',             label: 'Date',      sortKey: 'date',             align: 'left',  defaultWidth: 100, minWidth: 70  },
  { id: 'name',             label: 'Name',      sortKey: 'name',             align: 'left',  defaultWidth: 180, minWidth: 80  },
  { id: 'activity_type',    label: 'Type',      sortKey: null,               align: 'left',  defaultWidth: 110, minWidth: 60  },
  { id: 'distance_m',       label: 'Distance',  sortKey: 'distance_m',       align: 'right', defaultWidth: 90,  minWidth: 60  },
  { id: 'elevation_gain_m', label: 'Elevation', sortKey: 'elevation_gain_m', align: 'right', defaultWidth: 90,  minWidth: 60  },
  { id: 'duration_sec',     label: 'Duration',  sortKey: 'duration_sec',     align: 'right', defaultWidth: 90,  minWidth: 60  },
  { id: 'avg_hr',           label: 'Avg HR',    sortKey: 'avg_hr',           align: 'right', defaultWidth: 80,  minWidth: 55  },
  { id: 'avg_power',        label: 'Power',     sortKey: 'avg_power',        align: 'right', defaultWidth: 80,  minWidth: 55  },
  { id: 'avg_temperature',  label: 'Avg °C',    sortKey: 'avg_temperature',  align: 'right', defaultWidth: 75,  minWidth: 55  },
  { id: 'min_temperature',  label: 'Min °C',    sortKey: 'min_temperature',  align: 'right', defaultWidth: 75,  minWidth: 55  },
  { id: 'max_temperature',  label: 'Max °C',    sortKey: 'max_temperature',  align: 'right', defaultWidth: 75,  minWidth: 55  },
  { id: 'location_name',    label: 'Location',  sortKey: null,               align: 'left',  defaultWidth: 140, minWidth: 60  },
];

const LS_KEY = 'activity-table-columns-v1';

// ---------------------------------------------------------------------------
// localStorage helpers
// ---------------------------------------------------------------------------

function defaultColumnConfigs(): ColumnConfig[] {
  return COLUMN_DEFS.map((def, i) => ({
    id: def.id,
    visible: true,
    width: def.defaultWidth,
    order: i,
  }));
}

function loadColumnConfigs(): ColumnConfig[] {
  if (typeof window === 'undefined') return defaultColumnConfigs();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultColumnConfigs();
    const parsed: PersistedColumnState = JSON.parse(raw);
    if (parsed.version !== 1) return defaultColumnConfigs();
    const saved = new Map(parsed.columns.map((c) => [c.id, c]));
    return COLUMN_DEFS.map((def, i) => {
      const stored = saved.get(def.id);
      return stored ?? { id: def.id, visible: true, width: def.defaultWidth, order: i };
    }).sort((a, b) => a.order - b.order);
  } catch {
    return defaultColumnConfigs();
  }
}

function saveColumnConfigs(cols: ColumnConfig[]): void {
  if (typeof window === 'undefined') return;
  const payload: PersistedColumnState = { version: 1, columns: cols };
  localStorage.setItem(LS_KEY, JSON.stringify(payload));
}

// ---------------------------------------------------------------------------
// Activity stat block — shared by side panel and sheet
// ---------------------------------------------------------------------------

function ActivityStats({ activity }: { activity: Activity }) {
  const stat = (label: string, value: string | null) => (
    <div key={label}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value || '—'}</dd>
    </div>
  );

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {stat('Distance', fmtDistance(activity.distance_m))}
        {stat('Elevation', fmtElevation(activity.elevation_gain_m))}
        {stat('Duration', fmtDuration(activity.duration_sec))}
        {stat('Avg HR', activity.avg_hr != null ? `${activity.avg_hr} bpm` : null)}
        {stat('Max HR', activity.max_hr != null ? `${activity.max_hr} bpm` : null)}
        {stat('Avg Power', activity.avg_power != null ? `${activity.avg_power} W` : null)}
        {stat('TSS', activity.tss != null ? String(activity.tss) : null)}
        {stat('Avg Speed', activity.avg_speed_kmh != null ? `${activity.avg_speed_kmh} km/h` : null)}
        {stat('Calories', activity.calories != null ? activity.calories.toLocaleString() : null)}
        {stat('Avg Temp', fmtTemp(activity.avg_temperature))}
        {stat('Min Temp', fmtTemp(activity.min_temperature))}
        {stat('Max Temp', fmtTemp(activity.max_temperature))}
      </dl>

      {activity.location_name && (
        <div>
          <p className="text-xs text-muted-foreground">Location</p>
          <p className="text-sm text-foreground">{activity.location_name}</p>
        </div>
      )}

      {activity.description && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
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

// ---------------------------------------------------------------------------
// Summary stats — shared by side panel and sheet
// ---------------------------------------------------------------------------

function SummaryStats({ activities }: { activities: Activity[] }) {
  const count = activities.length;
  const totalDistance = activities.reduce((s, a) => s + (a.distance_m ?? 0), 0);
  const totalElevation = activities.reduce((s, a) => s + (a.elevation_gain_m ?? 0), 0);
  const totalDuration = activities.reduce((s, a) => s + (a.duration_sec ?? 0), 0);
  const totalCalories = activities.reduce((s, a) => s + (a.calories ?? 0), 0);
  const totalTss = activities.reduce((s, a) => s + (a.tss ?? 0), 0);

  const hrVals = activities.map((a) => a.avg_hr).filter((v): v is number => v != null);
  const avgHr = hrVals.length > 0 ? Math.round(hrVals.reduce((s, v) => s + v, 0) / hrVals.length) : null;

  const powerVals = activities.map((a) => a.avg_power).filter((v): v is number => v != null);
  const avgPower = powerVals.length > 0 ? Math.round(powerVals.reduce((s, v) => s + v, 0) / powerVals.length) : null;

  const dates = [...activities.map((a) => a.date)].sort();
  const dateRange =
    dates.length === 0
      ? ''
      : dates[0] === dates[dates.length - 1]
        ? fmtDate(dates[0])
        : `${fmtDate(dates[0])} – ${fmtDate(dates[dates.length - 1])}`;

  const stat = (label: string, value: string) => (
    <div key={label}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium text-foreground">{value}</dd>
    </div>
  );

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">{count} activities selected</p>
        <p className="text-xs text-muted-foreground mt-0.5">{dateRange}</p>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {totalDistance > 0 && stat('Total Distance', fmtDistance(totalDistance))}
        {totalElevation > 0 && stat('Total Elevation', fmtElevation(totalElevation))}
        {totalDuration > 0 && stat('Total Duration', fmtDuration(totalDuration))}
        {avgHr !== null && stat('Avg HR', `${avgHr} bpm`)}
        {avgPower !== null && stat('Avg Power', `${avgPower} W`)}
        {totalCalories > 0 && stat('Total Calories', totalCalories.toLocaleString())}
        {totalTss > 0 && stat('Total TSS', String(totalTss))}
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Side panel — single activity (desktop)
// ---------------------------------------------------------------------------

function ActivitySidePanel({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose: () => void;
}) {
  return (
    <Card className="w-72 shrink-0 flex flex-col overflow-hidden sticky top-4 max-h-[calc(100vh-2rem)]">
      <CardHeader className="bg-muted border-b px-4 py-3 flex-row items-start justify-between space-y-0">
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{fmtDate(activity.date)}</p>
          <p className="text-sm font-semibold text-foreground truncate" title={activity.name ?? ''}>
            {activity.name || '—'}
          </p>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">
            {fmtActivity(activity.activity_type)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-muted-foreground hover:text-foreground text-xl leading-none shrink-0 mt-0.5"
          aria-label="Close"
        >
          ×
        </button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-4 py-3">
        <ActivityStats activity={activity} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Side panel — multi-activity summary (desktop)
// ---------------------------------------------------------------------------

function SelectionSummaryPanel({
  activities,
  onClose,
}: {
  activities: Activity[];
  onClose: () => void;
}) {
  return (
    <Card className="w-72 shrink-0 flex flex-col overflow-hidden sticky top-4 max-h-[calc(100vh-2rem)]">
      <CardHeader className="bg-muted border-b px-4 py-3 flex-row items-start justify-between space-y-0">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{activities.length} activities selected</p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-muted-foreground hover:text-foreground text-xl leading-none shrink-0"
          aria-label="Clear selection"
        >
          ×
        </button>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-4 py-3">
        <SummaryStats activities={activities} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mobile Sheet panel
// ---------------------------------------------------------------------------

function MobilePanel({
  open,
  onClose,
  selectedActivities,
}: {
  open: boolean;
  onClose: () => void;
  selectedActivities: Activity[];
}) {
  const isSingle = selectedActivities.length === 1;
  const activity = isSingle ? selectedActivities[0] : null;

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto md:hidden">
        <SheetHeader className="mb-4">
          {activity ? (
            <>
              <p className="text-xs text-muted-foreground">{fmtDate(activity.date)}</p>
              <SheetTitle className="text-base">{activity.name || '—'}</SheetTitle>
              <p className="text-xs text-muted-foreground capitalize">
                {fmtActivity(activity.activity_type)}
              </p>
            </>
          ) : (
            <SheetTitle className="text-base">
              {selectedActivities.length} activities selected
            </SheetTitle>
          )}
        </SheetHeader>
        <Separator className="mb-4" />
        {activity ? (
          <ActivityStats activity={activity} />
        ) : (
          <SummaryStats activities={selectedActivities} />
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function ActivityTable() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sort, setSort] = useState<SortState>({ key: 'date', dir: 'desc' });
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Column management
  const [columns, setColumns] = useState<ColumnConfig[]>(() => loadColumnConfigs());
  const [showColMenu, setShowColMenu] = useState(false);
  const [dragColId, setDragColId] = useState<ColumnId | null>(null);
  const [dragOverColId, setDragOverColId] = useState<ColumnId | null>(null);
  const resizeRef = useRef<{ colId: ColumnId; startX: number; startWidth: number } | null>(null);
  const tableRef = useRef<HTMLTableElement>(null);

  // Keyboard navigation
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);

  // Persist column config to localStorage
  useEffect(() => {
    saveColumnConfigs(columns);
  }, [columns]);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    const params = new URLSearchParams({
      sortBy: sort.key as string,
      sortDir: sort.dir,
    });
    if (search) params.set('search', search);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);

    try {
      const res = await fetch(`/api/activities?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: Activity[] = await res.json();
      setActivities(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [search, dateFrom, dateTo, sort]);

  useEffect(() => {
    const timer = setTimeout(fetchActivities, 300);
    return () => clearTimeout(timer);
  }, [fetchActivities]);

  // Sync focusedIndex when activities list changes (e.g. after filtering).
  useEffect(() => {
    if (selectedIds.size === 1) {
      const [firstId] = selectedIds;
      const idx = activities.findIndex((a) => a.id === firstId);
      setFocusedIndex(idx === -1 ? null : idx);
    }
    // intentionally omit selectedIds to avoid loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex === null) return;
    const row = tableRef.current?.querySelector('tr[data-focused="true"]');
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex]);

  const allChecked = activities.length > 0 && activities.every((a) => selectedIds.has(a.id));
  const someChecked = activities.some((a) => selectedIds.has(a.id));

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    );
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <span className="text-muted-foreground ml-1">↕</span>;
    return <span className="text-primary ml-1">{sort.dir === 'desc' ? '↓' : '↑'}</span>;
  }

  // ---------------------------------------------------------------------------
  // Column management
  // ---------------------------------------------------------------------------

  const visibleColumns = [...columns]
    .sort((a, b) => a.order - b.order)
    .filter((c) => c.visible)
    .map((c) => COLUMN_DEFS.find((d) => d.id === c.id)!);

  const colSpan = visibleColumns.length + 1;

  function toggleColumnVisibility(id: ColumnId) {
    const visibleCount = columns.filter((c) => c.visible).length;
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.visible && visibleCount <= 1) return c;
        return { ...c, visible: !c.visible };
      })
    );
  }

  function resetColumns() {
    setColumns(defaultColumnConfigs());
    setShowColMenu(false);
  }

  // ---------------------------------------------------------------------------
  // Column resize
  // ---------------------------------------------------------------------------

  function startResize(colId: ColumnId, startX: number) {
    const cfg = columns.find((c) => c.id === colId);
    if (!cfg) return;
    resizeRef.current = { colId, startX, startWidth: cfg.width };

    function onPointerMove(e: PointerEvent) {
      if (!resizeRef.current) return;
      const def = COLUMN_DEFS.find((d) => d.id === resizeRef.current!.colId)!;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = Math.max(def.minWidth, resizeRef.current.startWidth + delta);
      setColumns((prev) =>
        prev.map((c) => (c.id === resizeRef.current!.colId ? { ...c, width: newWidth } : c))
      );
    }

    function onPointerUp() {
      resizeRef.current = null;
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
  }

  // ---------------------------------------------------------------------------
  // Drag-and-drop reorder
  // ---------------------------------------------------------------------------

  function handleDragStart(e: React.DragEvent, colId: ColumnId) {
    setDragColId(colId);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', colId);
  }

  function handleDragOver(e: React.DragEvent, colId: ColumnId) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (colId !== dragColId) setDragOverColId(colId);
  }

  function handleDrop(e: React.DragEvent, targetColId: ColumnId) {
    e.preventDefault();
    if (!dragColId || dragColId === targetColId) return;
    setColumns((prev) => {
      const sorted = [...prev].sort((a, b) => a.order - b.order);
      const dragIdx = sorted.findIndex((c) => c.id === dragColId);
      const targetIdx = sorted.findIndex((c) => c.id === targetColId);
      const [dragged] = sorted.splice(dragIdx, 1);
      sorted.splice(targetIdx, 0, dragged);
      return sorted.map((c, i) => ({ ...c, order: i }));
    });
    setDragColId(null);
    setDragOverColId(null);
  }

  function handleDragEnd() {
    setDragColId(null);
    setDragOverColId(null);
  }

  // ---------------------------------------------------------------------------
  // Keyboard navigation
  // ---------------------------------------------------------------------------

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (activities.length === 0) return;
    e.preventDefault();

    const baseIdx =
      focusedIndex ??
      (selectedIds.size === 1
        ? activities.findIndex((a) => a.id === [...selectedIds][0])
        : -1);

    const newIdx =
      e.key === 'ArrowDown'
        ? Math.min(baseIdx + 1, activities.length - 1)
        : Math.max(baseIdx - 1, 0);

    if (activities[newIdx]) {
      setFocusedIndex(newIdx);
      setSelectedIds(new Set([activities[newIdx].id]));
    }
  }

  // ---------------------------------------------------------------------------
  // Cell renderer
  // ---------------------------------------------------------------------------

  function renderCell(a: Activity, colId: ColumnId, isSelected: boolean): React.ReactNode {
    switch (colId) {
      case 'date':
        return <span className="font-mono text-foreground">{fmtDate(a.date)}</span>;
      case 'name':
        return (
          <span className="inline-flex items-center gap-1.5 truncate">
            {a.name || <span className="text-muted-foreground">—</span>}
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
      case 'activity_type':
        return <span className="capitalize text-muted-foreground">{fmtActivity(a.activity_type)}</span>;
      case 'distance_m':
        return fmtDistance(a.distance_m);
      case 'elevation_gain_m':
        return fmtElevation(a.elevation_gain_m);
      case 'duration_sec':
        return fmtDuration(a.duration_sec);
      case 'avg_hr':
        return a.avg_hr != null ? `${a.avg_hr} bpm` : '—';
      case 'avg_power':
        return a.avg_power != null ? `${a.avg_power} W` : '—';
      case 'avg_temperature':
        return fmtTemp(a.avg_temperature);
      case 'min_temperature':
        return fmtTemp(a.min_temperature);
      case 'max_temperature':
        return fmtTemp(a.max_temperature);
      case 'location_name':
        return a.location_name || '—';
    }
  }

  const selectedActivities = activities.filter((a) => selectedIds.has(a.id));
  const panelVisible = selectedIds.size > 0;

  return (
    <div
      className="space-y-4 focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-muted-foreground mb-1">Search</label>
          <Input
            type="text"
            placeholder="Name, location, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">From</label>
          <Input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs text-muted-foreground mb-1">To</label>
          <Input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-8 text-sm"
          />
        </div>
        {(search || dateFrom || dateTo) && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs"
            onClick={() => {
              setSearch('');
              setDateFrom('');
              setDateTo('');
            }}
          >
            Clear
          </Button>
        )}

        {/* Columns button */}
        <div className="relative ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => setShowColMenu((v) => !v)}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
              <rect x="1" y="3" width="14" height="10" rx="1" />
              <line x1="6" y1="3" x2="6" y2="13" />
              <line x1="11" y1="3" x2="11" y2="13" />
            </svg>
            Columns
          </Button>

          {showColMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowColMenu(false)} />
              <div className="absolute right-0 top-full mt-1 z-20 bg-popover border border-border rounded-lg shadow-lg py-1 min-w-44">
                {COLUMN_DEFS.map((def) => {
                  const cfg = columns.find((c) => c.id === def.id)!;
                  const isLast = columns.filter((c) => c.visible).length === 1 && cfg.visible;
                  return (
                    <label
                      key={def.id}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm text-popover-foreground hover:bg-accent cursor-pointer ${isLast ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <Checkbox
                        checked={cfg.visible}
                        disabled={isLast}
                        onCheckedChange={() => toggleColumnVisibility(def.id)}
                      />
                      {def.label}
                    </label>
                  );
                })}
                <div className="border-t border-border mt-1 pt-1 px-3 py-1">
                  <button
                    onClick={resetColumns}
                    className="text-xs text-muted-foreground hover:text-foreground"
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-destructive/10 border border-destructive/50 text-destructive rounded px-4 py-2 text-sm">
          Error: {error}
        </div>
      )}

      {/* Table + Side Panel (desktop) */}
      <div className="flex gap-4 items-start">
        {/* Table */}
        <div className="flex-1 min-w-0 overflow-x-auto rounded-lg border border-border shadow-sm">
          <table ref={tableRef} className="min-w-full divide-y divide-border text-sm table-fixed">
            <colgroup>
              <col style={{ width: 36 }} />
              {visibleColumns.map((col) => {
                const cfg = columns.find((c) => c.id === col.id)!;
                return <col key={col.id} style={{ width: cfg.width }} />;
              })}
            </colgroup>
            <thead className="bg-muted">
              <tr>
                {/* Select-all checkbox */}
                <th className="w-9 px-2 py-2 text-left">
                  <Checkbox
                    checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                    onCheckedChange={() => {
                      if (allChecked) {
                        setSelectedIds(new Set());
                        setFocusedIndex(null);
                      } else {
                        setSelectedIds(new Set(activities.map((a) => a.id)));
                      }
                    }}
                    aria-label="Select all"
                  />
                </th>
                {visibleColumns.map((col) => {
                  const cfg = columns.find((c) => c.id === col.id)!;
                  const isDragging = dragColId === col.id;
                  const isDragOver = dragOverColId === col.id;
                  return (
                    <th
                      key={col.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, col.id)}
                      onDragOver={(e) => handleDragOver(e, col.id)}
                      onDrop={(e) => handleDrop(e, col.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => col.sortKey && toggleSort(col.sortKey)}
                      className={[
                        'relative px-3 py-2 text-left text-xs font-semibold text-muted-foreground',
                        'uppercase tracking-wider select-none whitespace-nowrap',
                        col.sortKey ? 'cursor-pointer hover:text-foreground' : 'cursor-grab',
                        isDragging ? 'opacity-40' : '',
                        isDragOver ? 'bg-primary/10' : '',
                      ].join(' ')}
                      style={{ width: cfg.width }}
                    >
                      {col.label}
                      {col.sortKey && <SortIcon col={col.sortKey} />}

                      {/* Resize handle */}
                      <div
                        className="absolute right-0 top-0 h-full w-2 cursor-col-resize group"
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          e.preventDefault();
                          startResize(col.id, e.clientX);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="absolute right-0.5 top-1/4 h-1/2 w-px bg-border group-hover:bg-primary" />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-border bg-card">
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-muted-foreground">
                    No activities found.
                  </td>
                </tr>
              ) : (
                activities.map((a, rowIdx) => {
                  const isSelected = selectedIds.has(a.id);
                  const isFocused = focusedIndex === rowIdx;
                  return (
                    <tr
                      key={a.id}
                      data-focused={isFocused ? 'true' : undefined}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-primary/10'
                          : isFocused
                            ? 'bg-primary/5 outline outline-1 -outline-offset-1 outline-primary/30'
                            : 'hover:bg-accent'
                      }`}
                      onClick={() => {
                        const isOnlySelected = selectedIds.size === 1 && isSelected;
                        if (isOnlySelected) {
                          setSelectedIds(new Set());
                          setFocusedIndex(null);
                        } else {
                          setSelectedIds(new Set([a.id]));
                          setFocusedIndex(rowIdx);
                        }
                      }}
                    >
                      <td
                        className="w-9 px-2 py-2"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => {
                            const adding = !selectedIds.has(a.id);
                            setSelectedIds((prev) => {
                              const next = new Set(prev);
                              if (next.has(a.id)) {
                                next.delete(a.id);
                              } else {
                                next.add(a.id);
                              }
                              return next;
                            });
                            if (adding) setFocusedIndex(rowIdx);
                          }}
                          aria-label={`Select ${a.name ?? 'activity'}`}
                        />
                      </td>
                      {visibleColumns.map((col) => (
                        <td
                          key={col.id}
                          className={[
                            'px-3 py-2',
                            col.align === 'right' ? 'text-right tabular-nums' : '',
                            col.id === 'name' || col.id === 'location_name'
                              ? 'max-w-0 truncate'
                              : 'whitespace-nowrap',
                          ].join(' ')}
                          title={
                            col.id === 'name'
                              ? (a.name ?? '')
                              : col.id === 'location_name'
                                ? (a.location_name ?? '')
                                : undefined
                          }
                        >
                          {renderCell(a, col.id, isSelected)}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Side Panel — desktop only */}
        <div
          className={`hidden md:block w-72 shrink-0 transition-opacity duration-150 ${
            panelVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {selectedIds.size === 1 && selectedActivities[0] ? (
            <ActivitySidePanel
              activity={selectedActivities[0]}
              onClose={() => {
                setSelectedIds(new Set());
                setFocusedIndex(null);
              }}
            />
          ) : selectedIds.size >= 2 ? (
            <SelectionSummaryPanel
              activities={selectedActivities}
              onClose={() => {
                setSelectedIds(new Set());
                setFocusedIndex(null);
              }}
            />
          ) : (
            <div className="w-72 h-32 border border-dashed border-border rounded-lg bg-card flex flex-col items-center justify-center gap-1">
              <p className="text-xs text-muted-foreground/40">Select an activity</p>
              {activities.length > 0 && (
                <p className="text-xs text-muted-foreground/40">↑↓ to navigate</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Sheet panel */}
      <MobilePanel
        open={panelVisible}
        onClose={() => {
          setSelectedIds(new Set());
          setFocusedIndex(null);
        }}
        selectedActivities={selectedActivities}
      />

      {!loading && !error && (
        <p className="text-xs text-muted-foreground text-right">
          {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
        </p>
      )}
    </div>
  );
}

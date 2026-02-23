'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Activity } from '@/lib/supabase';

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
// Side panel
// ---------------------------------------------------------------------------

function ActivitySidePanel({
  activity,
  onClose,
}: {
  activity: Activity;
  onClose: () => void;
}) {
  const stat = (label: string, value: string | null) => (
    <div key={label}>
      <dt className="text-xs text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-800">{value || '—'}</dd>
    </div>
  );

  return (
    <div className="w-72 shrink-0 border border-gray-200 rounded-lg bg-white shadow-sm flex flex-col overflow-hidden sticky top-4 max-h-[calc(100vh-2rem)]">
      {/* Header */}
      <div className="flex items-start justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="min-w-0">
          <p className="text-xs text-gray-500">{fmtDate(activity.date)}</p>
          <p
            className="text-sm font-semibold text-gray-800 truncate"
            title={activity.name ?? ''}
          >
            {activity.name || '—'}
          </p>
          <p className="text-xs text-gray-500 capitalize mt-0.5">
            {fmtActivity(activity.activity_type)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="ml-2 text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0 mt-0.5"
          aria-label="Close"
        >
          ×
        </button>
      </div>

      {/* Stats + note */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {stat('Distance', fmtDistance(activity.distance_m))}
          {stat('Elevation', fmtElevation(activity.elevation_gain_m))}
          {stat('Duration', fmtDuration(activity.duration_sec))}
          {stat('Avg HR', activity.avg_hr != null ? `${activity.avg_hr} bpm` : null)}
          {stat('Max HR', activity.max_hr != null ? `${activity.max_hr} bpm` : null)}
          {stat('Avg Power', activity.avg_power != null ? `${activity.avg_power} W` : null)}
          {stat('TSS', activity.tss != null ? String(activity.tss) : null)}
          {stat(
            'Avg Speed',
            activity.avg_speed_kmh != null ? `${activity.avg_speed_kmh} km/h` : null,
          )}
          {stat('Calories', activity.calories != null ? activity.calories.toLocaleString() : null)}
          {stat('Avg Temp', fmtTemp(activity.avg_temperature))}
          {stat('Min Temp', fmtTemp(activity.min_temperature))}
          {stat('Max Temp', fmtTemp(activity.max_temperature))}
        </dl>

        {activity.location_name && (
          <div>
            <p className="text-xs text-gray-500">Location</p>
            <p className="text-sm text-gray-700">{activity.location_name}</p>
          </div>
        )}

        {activity.description && (
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
              Diary Note
            </p>
            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed border-l-4 border-amber-300 pl-3">
              {activity.description}
            </p>
          </div>
        )}
      </div>
    </div>
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
  const [selectedId, setSelectedId] = useState<number | null>(null);

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

  // Sync focusedIndex when activities list changes (e.g. after filtering)
  useEffect(() => {
    if (selectedId !== null) {
      const idx = activities.findIndex((a) => a.id === selectedId);
      setFocusedIndex(idx === -1 ? null : idx);
    }
    // intentionally omit selectedId to avoid loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activities]);

  // Sync selectedId when focusedIndex changes (keyboard nav)
  useEffect(() => {
    if (focusedIndex !== null && activities[focusedIndex]) {
      setSelectedId(activities[focusedIndex].id);
    }
  }, [focusedIndex, activities]);

  // Scroll focused row into view
  useEffect(() => {
    if (focusedIndex === null) return;
    const row = tableRef.current?.querySelector('tr[data-focused="true"]');
    row?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [focusedIndex]);

  function toggleSort(key: SortKey) {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' }
    );
  }

  function SortIcon({ col }: { col: SortKey }) {
    if (sort.key !== col) return <span className="text-gray-400 ml-1">↕</span>;
    return <span className="text-blue-500 ml-1">{sort.dir === 'desc' ? '↓' : '↑'}</span>;
  }

  // ---------------------------------------------------------------------------
  // Column management
  // ---------------------------------------------------------------------------

  const visibleColumns = [...columns]
    .sort((a, b) => a.order - b.order)
    .filter((c) => c.visible)
    .map((c) => COLUMN_DEFS.find((d) => d.id === c.id)!);

  const colSpan = visibleColumns.length;

  function toggleColumnVisibility(id: ColumnId) {
    const visibleCount = columns.filter((c) => c.visible).length;
    setColumns((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;
        if (c.visible && visibleCount <= 1) return c; // prevent hiding last column
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
    setFocusedIndex((prev) => {
      if (prev === null) {
        const idx =
          selectedId !== null ? activities.findIndex((a) => a.id === selectedId) : -1;
        return e.key === 'ArrowDown' ? Math.max(idx + 1, 0) : Math.max(idx - 1, 0);
      }
      return e.key === 'ArrowDown'
        ? Math.min(prev + 1, activities.length - 1)
        : Math.max(prev - 1, 0);
    });
  }

  // ---------------------------------------------------------------------------
  // Cell renderer
  // ---------------------------------------------------------------------------

  function renderCell(a: Activity, colId: ColumnId, isSelected: boolean): React.ReactNode {
    switch (colId) {
      case 'date':
        return (
          <span className="font-mono text-gray-700">{fmtDate(a.date)}</span>
        );
      case 'name':
        return (
          <span className="inline-flex items-center gap-1.5 truncate">
            {a.name || <span className="text-gray-400">—</span>}
            {!!a.description && (
              <span
                className={`text-xs leading-none px-1 py-0.5 rounded border ${
                  isSelected
                    ? 'bg-blue-200 border-blue-400 text-blue-800'
                    : 'bg-gray-100 border-gray-300 text-gray-500'
                }`}
                title="Has diary note"
              >
                note
              </span>
            )}
          </span>
        );
      case 'activity_type':
        return (
          <span className="capitalize text-gray-600">{fmtActivity(a.activity_type)}</span>
        );
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

  const selectedActivity = activities.find((a) => a.id === selectedId) ?? null;

  return (
    <div
      className="space-y-4 focus:outline-none"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs text-gray-500 mb-1">Search</label>
          <input
            type="text"
            placeholder="Name, location, type…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">From</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">To</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {(search || dateFrom || dateTo) && (
          <button
            onClick={() => {
              setSearch('');
              setDateFrom('');
              setDateTo('');
            }}
            className="text-xs text-gray-500 hover:text-gray-800 underline pb-1.5"
          >
            Clear
          </button>
        )}

        {/* Columns button */}
        <div className="relative ml-auto">
          <button
            onClick={() => setShowColMenu((v) => !v)}
            className="flex items-center gap-1.5 text-xs border border-gray-300 rounded px-2.5 py-1.5 text-gray-600 hover:border-gray-400 hover:text-gray-800 bg-white select-none"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 16 16" stroke="currentColor" strokeWidth={1.5}>
              <rect x="1" y="3" width="14" height="10" rx="1" />
              <line x1="6" y1="3" x2="6" y2="13" />
              <line x1="11" y1="3" x2="11" y2="13" />
            </svg>
            Columns
          </button>

          {showColMenu && (
            <>
              {/* Backdrop */}
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowColMenu(false)}
              />
              <div className="absolute right-0 top-full mt-1 z-20 bg-white border border-gray-200 rounded-lg shadow-lg py-1 min-w-44">
                {COLUMN_DEFS.map((def) => {
                  const cfg = columns.find((c) => c.id === def.id)!;
                  const isLast = columns.filter((c) => c.visible).length === 1 && cfg.visible;
                  return (
                    <label
                      key={def.id}
                      className={`flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 cursor-pointer ${isLast ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={cfg.visible}
                        disabled={isLast}
                        onChange={() => toggleColumnVisibility(def.id)}
                        className="rounded border-gray-300 text-blue-500 focus:ring-blue-400"
                      />
                      {def.label}
                    </label>
                  );
                })}
                <div className="border-t border-gray-100 mt-1 pt-1 px-3 py-1">
                  <button
                    onClick={resetColumns}
                    className="text-xs text-gray-400 hover:text-gray-700"
                  >
                    Reset to default
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Status */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded px-4 py-2 text-sm">
          Error: {error}
        </div>
      )}

      {/* Table + Side Panel */}
      <div className="flex gap-4 items-start">
        {/* Table */}
        <div className="flex-1 min-w-0 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
          <table ref={tableRef} className="min-w-full divide-y divide-gray-200 text-sm table-fixed">
            <colgroup>
              {visibleColumns.map((col) => {
                const cfg = columns.find((c) => c.id === col.id)!;
                return <col key={col.id} style={{ width: cfg.width }} />;
              })}
            </colgroup>
            <thead className="bg-gray-50">
              <tr>
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
                        'relative px-3 py-2 text-left text-xs font-semibold text-gray-500',
                        'uppercase tracking-wider select-none whitespace-nowrap',
                        col.sortKey ? 'cursor-pointer hover:text-gray-800' : 'cursor-grab',
                        isDragging ? 'opacity-40' : '',
                        isDragOver ? 'bg-blue-100' : '',
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
                        <div className="absolute right-0.5 top-1/4 h-1/2 w-px bg-gray-300 group-hover:bg-blue-400" />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-3 py-8 text-center text-gray-400">
                    No activities found.
                  </td>
                </tr>
              ) : (
                activities.map((a, rowIdx) => {
                  const isSelected = selectedId === a.id;
                  const isFocused = focusedIndex === rowIdx;
                  return (
                    <tr
                      key={a.id}
                      data-focused={isFocused ? 'true' : undefined}
                      className={`transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-blue-50'
                          : isFocused
                            ? 'bg-blue-50/40 outline outline-1 -outline-offset-1 outline-blue-200'
                            : 'hover:bg-gray-50'
                      }`}
                      onClick={() => {
                        const next = isSelected ? null : a.id;
                        setSelectedId(next);
                        setFocusedIndex(next === null ? null : rowIdx);
                      }}
                    >
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

        {/* Side Panel — always rendered to keep layout stable */}
        <div
          className={`w-72 shrink-0 transition-opacity duration-150 ${
            selectedActivity ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          {selectedActivity ? (
            <ActivitySidePanel
              activity={selectedActivity}
              onClose={() => {
                setSelectedId(null);
                setFocusedIndex(null);
              }}
            />
          ) : (
            <div className="w-72 h-32 border border-dashed border-gray-200 rounded-lg bg-white flex flex-col items-center justify-center gap-1">
              <p className="text-xs text-gray-300">Select an activity</p>
              {activities.length > 0 && (
                <p className="text-xs text-gray-300">↑↓ to navigate</p>
              )}
            </div>
          )}
        </div>
      </div>

      {!loading && !error && (
        <p className="text-xs text-gray-400 text-right">
          {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
        </p>
      )}
    </div>
  );
}

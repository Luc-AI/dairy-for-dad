'use client';

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Activity } from '@/lib/db';
import { ArrowDown, ArrowUp, ArrowUpDown, Columns3, NotebookPen, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { activityBadgeClass, activityTypeLabel } from '@/lib/activity-types';
import {
  fmtDate,
  fmtDateRange,
  fmtDistance,
  fmtDuration,
  fmtElevation,
  fmtTemp,
} from '@/lib/format';
import { detailHref, type ListFilters, type SortKey } from '@/lib/list-query';
import ActivityStats, { DiaryNote, SummaryStats } from './ActivityStats';

// ---------------------------------------------------------------------------
// Columns
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
  width: number | null; // null = takes remaining space
  defaultVisible?: boolean;
}

const COLUMN_DEFS: ColumnDef[] = [
  { id: 'date',             label: 'Datum',      sortKey: 'date',             align: 'left',  width: 110 },
  { id: 'name',             label: 'Name',       sortKey: null,               align: 'left',  width: null },
  { id: 'activity_type',    label: 'Typ',        sortKey: null,               align: 'left',  width: 130 },
  { id: 'distance_m',       label: 'Distanz',    sortKey: 'distance_m',       align: 'right', width: 100 },
  { id: 'elevation_gain_m', label: 'Höhenmeter', sortKey: 'elevation_gain_m', align: 'right', width: 120 },
  { id: 'duration_sec',     label: 'Dauer',      sortKey: 'duration_sec',     align: 'right', width: 90 },
  { id: 'avg_hr',           label: 'Ø Puls',     sortKey: 'avg_hr',           align: 'right', width: 95 },
  { id: 'avg_power',        label: 'Ø Leistung', sortKey: 'avg_power',        align: 'right', width: 110, defaultVisible: false },
  { id: 'avg_temperature',  label: 'Ø °C',       sortKey: null,               align: 'right', width: 80,  defaultVisible: false },
  { id: 'min_temperature',  label: 'Min. °C',    sortKey: null,               align: 'right', width: 80,  defaultVisible: false },
  { id: 'max_temperature',  label: 'Max. °C',    sortKey: null,               align: 'right', width: 80,  defaultVisible: false },
  { id: 'location_name',    label: 'Ort',        sortKey: null,               align: 'left',  width: 160, defaultVisible: false },
];

const LS_KEY = 'activity-table-columns-v6';

function defaultVisibility(): Set<ColumnId> {
  return new Set(COLUMN_DEFS.filter((d) => d.defaultVisible ?? true).map((d) => d.id));
}

function loadVisibility(): Set<ColumnId> {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultVisibility();
    const ids = (JSON.parse(raw) as string[]).filter((id): id is ColumnId =>
      COLUMN_DEFS.some((d) => d.id === id)
    );
    return ids.length > 0 ? new Set(ids) : defaultVisibility();
  } catch {
    return defaultVisibility();
  }
}

function saveVisibility(visible: Set<ColumnId>) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify([...visible]));
  } catch {
    // Storage unavailable (private mode) — column choice just won't persist.
  }
}

export function useColumnVisibility() {
  // Safe to read storage on first render: the table and menu only render
  // client-side (after the desktop media query resolves), never during SSR.
  const [visible, setVisible] = useState<Set<ColumnId>>(() =>
    typeof window === 'undefined' ? defaultVisibility() : loadVisibility()
  );

  const toggle = useCallback((id: ColumnId) => {
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        if (next.size > 1) next.delete(id);
      } else {
        next.add(id);
      }
      saveVisibility(next);
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    const next = defaultVisibility();
    saveVisibility(next);
    setVisible(next);
  }, []);

  return { visible, toggle, reset };
}

export function ColumnsMenu({
  visible,
  toggle: onToggle,
  reset: onReset,
}: ReturnType<typeof useColumnVisibility>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 shrink-0">
          <Columns3 />
          Spalten
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Sichtbare Spalten</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {COLUMN_DEFS.map((def) => {
          const checked = visible.has(def.id);
          return (
            <DropdownMenuCheckboxItem
              key={def.id}
              checked={checked}
              disabled={checked && visible.size === 1}
              onCheckedChange={() => onToggle(def.id)}
              onSelect={(e) => e.preventDefault()}
            >
              {def.label}
            </DropdownMenuCheckboxItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onReset}>Standard wiederherstellen</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ---------------------------------------------------------------------------
// Side panel
// ---------------------------------------------------------------------------

function PanelHeader({
  title,
  onClose,
  closeLabel,
  children,
}: {
  title: string;
  onClose: () => void;
  closeLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <h2 className="text-lg font-bold leading-snug tracking-tight">{title}</h2>
      <div className="flex shrink-0 items-center gap-1">
        {children}
        <Button variant="ghost" size="icon" className="text-muted-foreground" onClick={onClose} aria-label={closeLabel}>
          <X />
        </Button>
      </div>
    </div>
  );
}

function ActivitySidePanel({
  activity,
  onClose,
  openHref,
}: {
  activity: Activity;
  onClose: () => void;
  openHref: string;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-2">
        <PanelHeader title={activity.name || 'Ohne Titel'} onClose={onClose} closeLabel="Schliessen">
          <Button variant="outline" size="sm" asChild>
            <Link href={openHref}>Öffnen</Link>
          </Button>
        </PanelHeader>
        <div className="flex items-center gap-2">
          <Badge className={cn('rounded-full text-xs font-medium', activityBadgeClass(activity.activity_type))}>
            {activityTypeLabel(activity.activity_type)}
          </Badge>
          <span className="text-sm text-muted-foreground">{fmtDate(activity.date)}</span>
        </div>
        {activity.location_name && (
          <p className="text-sm text-muted-foreground">{activity.location_name}</p>
        )}
      </div>
      <DiaryNote description={activity.description} />
      <Separator />
      <ActivityStats activity={activity} />
    </div>
  );
}

function SelectionSummaryPanel({ activities, onClose }: { activities: Activity[]; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="space-y-1">
        <PanelHeader title={`${activities.length} Aktivitäten ausgewählt`} onClose={onClose} closeLabel="Auswahl aufheben" />
        <p className="text-sm text-muted-foreground">{fmtDateRange(activities.map((a) => a.date))}</p>
      </div>
      <Separator />
      <SummaryStats activities={activities} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function renderCell(a: Activity, colId: ColumnId, href: string): React.ReactNode {
  switch (colId) {
    case 'date':
      return <span className="font-mono">{fmtDate(a.date)}</span>;
    case 'name':
      return (
        <span className="flex items-center gap-2">
          <Link href={href} className="truncate font-medium hover:underline" onClick={(e) => e.stopPropagation()}>
            {a.name || <span className="text-muted-foreground">Ohne Titel</span>}
          </Link>
          {a.description && (
            <NotebookPen className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-label="Mit Tagebucheintrag" />
          )}
        </span>
      );
    case 'activity_type':
      return (
        <Badge className={cn('max-w-full truncate rounded-full text-xs font-medium', activityBadgeClass(a.activity_type))}>
          {activityTypeLabel(a.activity_type)}
        </Badge>
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

interface ActivityRowProps {
  activity: Activity;
  rowIdx: number;
  isSelected: boolean;
  isFocused: boolean;
  columns: ColumnDef[];
  href: string;
  onRowClick: (id: number, rowIdx: number) => void;
  onToggleCheck: (id: number, rowIdx: number) => void;
}

const ActivityRow = memo(function ActivityRow({
  activity,
  rowIdx,
  isSelected,
  isFocused,
  columns,
  href,
  onRowClick,
  onToggleCheck,
}: ActivityRowProps) {
  return (
    <TableRow
      data-focused={isFocused ? 'true' : undefined}
      data-state={isSelected ? 'selected' : undefined}
      className={cn(
        'cursor-pointer [content-visibility:auto] [contain-intrinsic-size:auto_45px]',
        isFocused && !isSelected && 'bg-primary/5',
        isSelected && 'bg-primary/10 data-[state=selected]:bg-primary/10'
      )}
      onClick={() => onRowClick(activity.id, rowIdx)}
    >
      <TableCell className="pl-4" onClick={(e) => e.stopPropagation()}>
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggleCheck(activity.id, rowIdx)}
          aria-label={`${activity.name ?? 'Aktivität'} auswählen`}
        />
      </TableCell>
      {columns.map((col) => (
        <TableCell
          key={col.id}
          className={cn(
            'py-2.5',
            col.align === 'right' && 'text-right font-mono tabular-nums',
            (col.id === 'name' || col.id === 'location_name') && 'max-w-0 truncate'
          )}
          title={col.id === 'location_name' ? (activity.location_name ?? '') : undefined}
        >
          {renderCell(activity, col.id, href)}
        </TableCell>
      ))}
    </TableRow>
  );
});

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

export default function ActivityDataTable({
  activities,
  loading,
  filters,
  setFilters,
  visible,
}: {
  activities: Activity[] | null;
  loading: boolean;
  filters: ListFilters;
  setFilters: (patch: Partial<ListFilters>) => void;
  visible: Set<ColumnId>;
}) {
  const router = useRouter();
  const rows = useMemo(() => activities ?? [], [activities]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const tableRef = useRef<HTMLTableElement | null>(null);

  const columns = useMemo(() => COLUMN_DEFS.filter((d) => visible.has(d.id)), [visible]);

  // Keep keyboard focus pointing at the selected row when the list changes.
  useEffect(() => {
    if (selectedIds.size === 1) {
      const [firstId] = selectedIds;
      const idx = rows.findIndex((a) => a.id === firstId);
      setFocusedIndex(idx === -1 ? null : idx);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows]);

  useEffect(() => {
    if (focusedIndex === null) return;
    tableRef.current
      ?.querySelector('tr[data-focused="true"]')
      ?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
  }, [focusedIndex]);

  const { allChecked, someChecked, selectedActivities } = useMemo(() => {
    let some = false;
    let all = rows.length > 0;
    const sel: Activity[] = [];
    for (const a of rows) {
      if (selectedIds.has(a.id)) {
        some = true;
        sel.push(a);
      } else {
        all = false;
      }
    }
    return { allChecked: all, someChecked: some, selectedActivities: sel };
  }, [rows, selectedIds]);

  function clearSelection() {
    setSelectedIds(new Set());
    setFocusedIndex(null);
  }

  function toggleSort(key: SortKey) {
    setFilters(
      filters.sort === key
        ? { sort: key, dir: filters.dir === 'desc' ? 'asc' : 'desc' }
        : { sort: key, dir: 'desc' }
    );
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === 'Escape' && selectedIds.size > 0) {
      clearSelection();
      return;
    }
    if (e.key === 'Enter' && focusedIndex !== null && rows[focusedIndex]) {
      e.preventDefault();
      router.push(detailHref(rows[focusedIndex].id, filters));
      return;
    }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    if (rows.length === 0) return;
    e.preventDefault();

    const baseIdx =
      focusedIndex ??
      (selectedIds.size === 1 ? rows.findIndex((a) => a.id === [...selectedIds][0]) : -1);
    const newIdx =
      e.key === 'ArrowDown' ? Math.min(baseIdx + 1, rows.length - 1) : Math.max(baseIdx - 1, 0);

    if (rows[newIdx]) {
      setFocusedIndex(newIdx);
      setSelectedIds(new Set([rows[newIdx].id]));
    }
  }

  const onRowClick = useCallback((id: number, rowIdx: number) => {
    setSelectedIds((prev) => {
      if (prev.size === 1 && prev.has(id)) {
        setFocusedIndex(null);
        return new Set();
      }
      setFocusedIndex(rowIdx);
      return new Set([id]);
    });
  }, []);

  const onToggleCheck = useCallback((id: number, rowIdx: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setFocusedIndex(rowIdx);
      }
      return next;
    });
  }, []);

  const panelVisible = selectedIds.size > 0;
  const single = selectedIds.size === 1 ? selectedActivities[0] : undefined;

  return (
    <div
      className="flex overflow-hidden rounded-xl border bg-card shadow-sm focus-visible:outline-2 focus-visible:outline-ring"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      aria-label="Aktivitäten-Tabelle. Pfeiltasten zum Navigieren, Enter zum Öffnen."
    >
      <Table
        ref={tableRef}
        className={cn('table-fixed', loading && activities && 'opacity-60 transition-opacity')}
        containerClassName="flex-1 min-w-0 overflow-auto max-h-[calc(100dvh-13rem)]"
      >
        <colgroup>
          <col style={{ width: 48 }} />
          {columns.map((col) => (
            <col key={col.id} style={col.width ? { width: col.width } : undefined} />
          ))}
        </colgroup>
        <TableHeader className="sticky top-0 z-10 bg-muted">
          <TableRow className="hover:bg-transparent">
            <TableHead className="pl-4">
              <Checkbox
                checked={allChecked ? true : someChecked ? 'indeterminate' : false}
                onCheckedChange={() =>
                  allChecked ? clearSelection() : setSelectedIds(new Set(rows.map((a) => a.id)))
                }
                aria-label="Alle auswählen"
              />
            </TableHead>
            {columns.map((col) => {
              const active = col.sortKey !== null && filters.sort === col.sortKey;
              return (
                <TableHead
                  key={col.id}
                  className={cn(col.align === 'right' && 'text-right')}
                  aria-sort={active ? (filters.dir === 'asc' ? 'ascending' : 'descending') : undefined}
                >
                  {col.sortKey ? (
                    <button
                      type="button"
                      onClick={() => toggleSort(col.sortKey!)}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring',
                        active ? 'text-foreground' : 'text-muted-foreground'
                      )}
                    >
                      {col.label}
                      {active ? (
                        filters.dir === 'asc' ? <ArrowUp className="size-3.5 text-primary" /> : <ArrowDown className="size-3.5 text-primary" />
                      ) : (
                        <ArrowUpDown className="size-3.5 opacity-40" />
                      )}
                    </button>
                  ) : (
                    <span className="text-muted-foreground">{col.label}</span>
                  )}
                </TableHead>
              );
            })}
          </TableRow>
        </TableHeader>
        <TableBody>
          {activities === null
            ? Array.from({ length: 12 }, (_, i) => (
                <TableRow key={i} className="hover:bg-transparent">
                  <TableCell className="pl-4"><Skeleton className="size-4" /></TableCell>
                  {columns.map((col) => (
                    <TableCell key={col.id} className="py-3"><Skeleton className="h-4 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            : rows.map((a, rowIdx) => (
                <ActivityRow
                  key={a.id}
                  activity={a}
                  rowIdx={rowIdx}
                  isSelected={selectedIds.has(a.id)}
                  isFocused={focusedIndex === rowIdx}
                  columns={columns}
                  href={detailHref(a.id, filters)}
                  onRowClick={onRowClick}
                  onToggleCheck={onToggleCheck}
                />
              ))}
        </TableBody>
      </Table>

      {panelVisible && (
        <aside className="w-80 shrink-0 overflow-y-auto border-l p-5 max-h-[calc(100dvh-13rem)] animate-in fade-in slide-in-from-right-2 duration-200">
          {single ? (
            <ActivitySidePanel activity={single} openHref={detailHref(single.id, filters)} onClose={clearSelection} />
          ) : (
            <SelectionSummaryPanel activities={selectedActivities} onClose={clearSelection} />
          )}
        </aside>
      )}
    </div>
  );
}

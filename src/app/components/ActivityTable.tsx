'use client';

import { useCallback, useEffect, useState } from 'react';
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

  const th = (label: string, col: SortKey, extra = '') => (
    <th
      className={`px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer select-none hover:text-gray-800 whitespace-nowrap ${extra}`}
      onClick={() => toggleSort(col)}
    >
      {label}
      <SortIcon col={col} />
    </th>
  );

  const selectedActivity = activities.find((a) => a.id === selectedId) ?? null;

  return (
    <div className="space-y-4">
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
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                {th('Date', 'date')}
                {th('Name', 'name')}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                {th('Distance', 'distance_m', 'text-right')}
                {th('Elevation', 'elevation_gain_m', 'text-right')}
                {th('Duration', 'duration_sec', 'text-right')}
                {th('Avg HR', 'avg_hr', 'text-right')}
                {th('Power', 'avg_power', 'text-right')}
                {th('Avg °C', 'avg_temperature', 'text-right')}
                {th('Min °C', 'min_temperature', 'text-right')}
                {th('Max °C', 'max_temperature', 'text-right')}
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Location
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-gray-400">
                    Loading…
                  </td>
                </tr>
              ) : activities.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-3 py-8 text-center text-gray-400">
                    No activities found.
                  </td>
                </tr>
              ) : (
                activities.map((a) => {
                  const isSelected = selectedId === a.id;
                  const hasNote = !!a.description;
                  return (
                    <tr
                      key={a.id}
                      className={`transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                      onClick={() => setSelectedId(isSelected ? null : a.id)}
                    >
                      <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-700">
                        {fmtDate(a.date)}
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate" title={a.name ?? ''}>
                        <span className="inline-flex items-center gap-1.5">
                          {a.name || <span className="text-gray-400">—</span>}
                          {hasNote && (
                            <span
                              className={`text-xs leading-none px-1 py-0.5 rounded border ${isSelected ? 'bg-blue-200 border-blue-400 text-blue-800' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
                              title="Has diary note"
                            >
                              note
                            </span>
                          )}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap capitalize text-gray-600">
                        {fmtActivity(a.activity_type)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtDistance(a.distance_m)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtElevation(a.elevation_gain_m)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">
                        {fmtDuration(a.duration_sec)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {a.avg_hr != null ? `${a.avg_hr} bpm` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {a.avg_power != null ? `${a.avg_power} W` : '—'}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtTemp(a.avg_temperature)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtTemp(a.min_temperature)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {fmtTemp(a.max_temperature)}
                      </td>
                      <td
                        className="px-3 py-2 text-gray-500 max-w-xs truncate"
                        title={a.location_name ?? ''}
                      >
                        {a.location_name || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Side Panel */}
        {selectedActivity && (
          <ActivitySidePanel
            activity={selectedActivity}
            onClose={() => setSelectedId(null)}
          />
        )}
      </div>

      {!loading && !error && (
        <p className="text-xs text-gray-400 text-right">
          {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
        </p>
      )}
    </div>
  );
}

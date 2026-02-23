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
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
            onClick={() => { setSearch(''); setDateFrom(''); setDateTo(''); }}
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

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
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
              {th('Calories', 'calories', 'text-right')}
              <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Location
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  Loading…
                </td>
              </tr>
            ) : activities.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-3 py-8 text-center text-gray-400">
                  No activities found.
                </td>
              </tr>
            ) : (
              activities.flatMap((a) => {
                const isExpanded = expandedId === a.id;
                const hasNote = !!a.description;
                return [
                  <tr
                    key={a.id}
                    className={`transition-colors ${hasNote ? 'cursor-pointer hover:bg-amber-50' : 'hover:bg-blue-50'} ${isExpanded ? 'bg-amber-50' : ''}`}
                    onClick={() => hasNote && setExpandedId(isExpanded ? null : a.id)}
                  >
                    <td className="px-3 py-2 whitespace-nowrap font-mono text-gray-700">
                      {fmtDate(a.date)}
                    </td>
                    <td className="px-3 py-2 max-w-xs truncate" title={a.name ?? ''}>
                      <span className="inline-flex items-center gap-1.5">
                        {a.name || <span className="text-gray-400">—</span>}
                        {hasNote && (
                          <span
                            className={`text-xs leading-none px-1 py-0.5 rounded border ${isExpanded ? 'bg-amber-200 border-amber-400 text-amber-800' : 'bg-gray-100 border-gray-300 text-gray-500'}`}
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
                    <td className="px-3 py-2 text-right tabular-nums">{fmtDistance(a.distance_m)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtElevation(a.elevation_gain_m)}</td>
                    <td className="px-3 py-2 text-right tabular-nums whitespace-nowrap">{fmtDuration(a.duration_sec)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.avg_hr != null ? `${a.avg_hr} bpm` : '—'}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {a.calories != null ? a.calories.toLocaleString() : '—'}
                    </td>
                    <td className="px-3 py-2 text-gray-500 max-w-xs truncate" title={a.location_name ?? ''}>
                      {a.location_name || '—'}
                    </td>
                  </tr>,
                  ...(isExpanded && a.description
                    ? [
                        <tr key={`${a.id}-note`} className="bg-amber-50">
                          <td colSpan={9} className="px-4 pb-4 pt-1">
                            <div className="border-l-4 border-amber-300 pl-4 py-1 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {a.description}
                            </div>
                          </td>
                        </tr>,
                      ]
                    : []),
                ];
              })
            )}
          </tbody>
        </table>
      </div>

      {!loading && !error && (
        <p className="text-xs text-gray-400 text-right">
          {activities.length} activit{activities.length === 1 ? 'y' : 'ies'}
        </p>
      )}
    </div>
  );
}

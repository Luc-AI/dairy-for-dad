// List filter state, shared by the home page (which keeps it in the URL) and
// the detail page (which carries it so prev/next and "back" keep context).

import { isTypeGroup, type TypeGroup } from './activity-types';

export type SortKey = 'date' | 'distance_m' | 'elevation_gain_m' | 'duration_sec' | 'avg_hr' | 'avg_power';
export type SortDir = 'asc' | 'desc';

const SORT_KEYS: SortKey[] = ['date', 'distance_m', 'elevation_gain_m', 'duration_sec', 'avg_hr', 'avg_power'];

export interface ListFilters {
  search: string;
  from: string;
  to: string;
  type: TypeGroup | '';
  sort: SortKey;
  dir: SortDir;
}

export const DEFAULT_FILTERS: ListFilters = {
  search: '',
  from: '',
  to: '',
  type: '',
  sort: 'date',
  dir: 'desc',
};

export const SORT_OPTIONS: { id: string; label: string; sort: SortKey; dir: SortDir }[] = [
  { id: 'newest', label: 'Neueste', sort: 'date', dir: 'desc' },
  { id: 'oldest', label: 'Älteste', sort: 'date', dir: 'asc' },
  { id: 'distance', label: 'Längste Distanz', sort: 'distance_m', dir: 'desc' },
  { id: 'elevation', label: 'Meiste Höhenmeter', sort: 'elevation_gain_m', dir: 'desc' },
  { id: 'duration', label: 'Längste Dauer', sort: 'duration_sec', dir: 'desc' },
];

export function parseListFilters(params: URLSearchParams): ListFilters {
  const sort = params.get('sort');
  const type = params.get('type');
  return {
    search: params.get('search') ?? '',
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    type: isTypeGroup(type) ? type : '',
    sort: SORT_KEYS.includes(sort as SortKey) ? (sort as SortKey) : 'date',
    dir: params.get('dir') === 'asc' ? 'asc' : 'desc',
  };
}

/** Page URL params (defaults omitted). */
export function toPageParams(f: ListFilters): URLSearchParams {
  const p = new URLSearchParams();
  if (f.sort !== 'date' || f.dir !== 'desc') {
    p.set('sort', f.sort);
    p.set('dir', f.dir);
  }
  if (f.search) p.set('search', f.search);
  if (f.from) p.set('from', f.from);
  if (f.to) p.set('to', f.to);
  if (f.type) p.set('type', f.type);
  return p;
}

/** Query params for GET /api/activities. */
export function toApiParams(f: ListFilters): URLSearchParams {
  const p = new URLSearchParams({ sortBy: f.sort, sortDir: f.dir });
  if (f.search) p.set('search', f.search);
  if (f.from) p.set('dateFrom', f.from);
  if (f.to) p.set('dateTo', f.to);
  if (f.type) p.set('type', f.type);
  return p;
}

function withQuery(path: string, p: URLSearchParams) {
  const qs = p.toString();
  return qs ? `${path}?${qs}` : path;
}

export function listHref(f: ListFilters) {
  return withQuery('/', toPageParams(f));
}

export function detailHref(id: number, f: ListFilters) {
  return withQuery(`/activity/${id}`, toPageParams(f));
}

// Year shortcuts map onto the from/to range.

export function yearRange(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` };
}

export function selectedYear(f: ListFilters): number | null {
  const m = /^(\d{4})-01-01$/.exec(f.from);
  if (!m) return null;
  return f.to === `${m[1]}-12-31` ? Number(m[1]) : null;
}

/** Number of non-default filters inside the filter drawer (sort, type, custom dates). */
export function activeFilterCount(f: ListFilters): number {
  let n = 0;
  if (f.sort !== 'date' || f.dir !== 'desc') n++;
  if (f.type) n++;
  if ((f.from || f.to) && selectedYear(f) === null) n++;
  return n;
}

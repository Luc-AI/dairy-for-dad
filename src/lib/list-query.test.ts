import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FILTERS,
  activeFilterCount,
  detailHref,
  parseListFilters,
  selectedYear,
  toApiParams,
  yearRange,
} from './list-query';

describe('parseListFilters', () => {
  it('returns defaults for empty params', () => {
    expect(parseListFilters(new URLSearchParams())).toEqual(DEFAULT_FILTERS);
  });

  it('ignores unknown sort keys and type groups', () => {
    const f = parseListFilters(new URLSearchParams('sort=name;drop&type=bogus&dir=asc'));
    expect(f.sort).toBe('date');
    expect(f.type).toBe('');
    expect(f.dir).toBe('asc');
  });

  it('round-trips through detailHref', () => {
    const f = { ...DEFAULT_FILTERS, search: 'Zürich', type: 'road' as const, sort: 'distance_m' as const };
    const href = detailHref(5, f);
    expect(href.startsWith('/activity/5?')).toBe(true);
    expect(parseListFilters(new URLSearchParams(href.split('?')[1]))).toEqual(f);
  });

  it('omits defaults from detailHref', () => {
    expect(detailHref(7, DEFAULT_FILTERS)).toBe('/activity/7');
  });
});

describe('toApiParams', () => {
  it('maps page filters to API names', () => {
    const p = toApiParams({ ...DEFAULT_FILTERS, from: '2024-01-01', type: 'mtb' });
    expect(p.get('dateFrom')).toBe('2024-01-01');
    expect(p.get('type')).toBe('mtb');
    expect(p.get('sortBy')).toBe('date');
  });
});

describe('year shortcuts', () => {
  it('detects a full-year range', () => {
    expect(selectedYear({ ...DEFAULT_FILTERS, ...yearRange(2025) })).toBe(2025);
    expect(selectedYear({ ...DEFAULT_FILTERS, from: '2025-01-01', to: '2025-06-30' })).toBeNull();
  });

  it('does not count a year chip as a drawer filter', () => {
    expect(activeFilterCount({ ...DEFAULT_FILTERS, ...yearRange(2025) })).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, from: '2025-03-01', type: 'run' })).toBe(2);
  });
});

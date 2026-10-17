import { describe, it, expect } from 'vitest';
import { findNeighbors, pagerTargets } from './activity-neighbors';

describe('findNeighbors', () => {
  it('returns null for both when id is not in list', () => {
    expect(findNeighbors([1, 2, 3], 99)).toEqual({ prev: null, next: null, index: -1 });
  });

  it('returns null prev when at first position', () => {
    expect(findNeighbors([10, 20, 30], 10)).toEqual({ prev: null, next: 20, index: 0 });
  });

  it('returns null next when at last position', () => {
    expect(findNeighbors([10, 20, 30], 30)).toEqual({ prev: 20, next: null, index: 2 });
  });

  it('returns both neighbors when in the middle', () => {
    expect(findNeighbors([10, 20, 30], 20)).toEqual({ prev: 10, next: 30, index: 1 });
  });

  it('returns null for both when list has a single matching item', () => {
    expect(findNeighbors([42], 42)).toEqual({ prev: null, next: null, index: 0 });
  });

  it('returns null for both when list is empty', () => {
    expect(findNeighbors([], 1)).toEqual({ prev: null, next: null, index: -1 });
  });
});

describe('pagerTargets', () => {
  const n = { prev: 1, next: 3, index: 1 };

  it('puts the older activity on the left for newest-first lists', () => {
    expect(pagerTargets(n, { sort: 'date', dir: 'desc' })).toEqual({ left: 3, right: 1 });
  });

  it('puts the older activity on the left for oldest-first lists', () => {
    expect(pagerTargets(n, { sort: 'date', dir: 'asc' })).toEqual({ left: 1, right: 3 });
  });

  it('follows list order for non-date sorts', () => {
    expect(pagerTargets(n, { sort: 'distance_m', dir: 'desc' })).toEqual({ left: 1, right: 3 });
  });
});

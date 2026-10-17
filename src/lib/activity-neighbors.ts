export interface Neighbors {
  prev: number | null;
  next: number | null;
  index: number;
}

export function findNeighbors(ids: number[], currentId: number): Neighbors {
  const index = ids.indexOf(currentId);
  if (index === -1) return { prev: null, next: null, index: -1 };
  return {
    prev: index > 0 ? ids[index - 1] : null,
    next: index < ids.length - 1 ? ids[index + 1] : null,
    index,
  };
}

export interface PagerTargets {
  left: number | null;
  right: number | null;
}

/**
 * Maps list neighbours onto left/right buttons. When the list is sorted by
 * date, left always means "older" and right "newer" (like flipping a diary),
 * regardless of sort direction. Otherwise it follows list order.
 */
export function pagerTargets(
  neighbors: Neighbors,
  sort: { sort: string; dir: 'asc' | 'desc' }
): PagerTargets {
  if (sort.sort === 'date' && sort.dir === 'desc') {
    return { left: neighbors.next, right: neighbors.prev };
  }
  return { left: neighbors.prev, right: neighbors.next };
}

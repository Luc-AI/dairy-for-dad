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

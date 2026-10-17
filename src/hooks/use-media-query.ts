'use client';

import { useSyncExternalStore } from 'react';

/** Matches a media query; returns null during SSR / before hydration. */
export function useMediaQuery(query: string): boolean | null {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches,
    () => null
  );
}

export function useIsDesktop() {
  return useMediaQuery('(min-width: 768px)');
}

import Link from 'next/link';
import { NotebookPen } from 'lucide-react';
import type { Activity } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { activityBadgeClass, activityTypeLabel } from '@/lib/activity-types';
import { fmtDateWithWeekday, fmtDistance, fmtDuration, fmtElevation } from '@/lib/format';
import { detailHref, type ListFilters } from '@/lib/list-query';

// content-visibility lets the browser skip layout for off-screen cards, which
// keeps a 2'000-item list smooth on phones without virtualisation.
const CARD = 'block px-4 py-3 [content-visibility:auto] [contain-intrinsic-size:auto_96px]';

export function ActivityCard({ activity: a, filters }: { activity: Activity; filters: ListFilters }) {
  const metrics = [
    a.distance_m != null && fmtDistance(a.distance_m),
    a.elevation_gain_m != null && a.elevation_gain_m > 0 && fmtElevation(a.elevation_gain_m),
    a.duration_sec != null && fmtDuration(a.duration_sec),
  ].filter(Boolean) as string[];

  return (
    <Link href={detailHref(a.id, filters)} className={cn(CARD, 'transition-colors active:bg-accent')}>
      <div className="flex items-center justify-between gap-3 text-sm text-muted-foreground">
        <span>{fmtDateWithWeekday(a.date)}</span>
        <Badge className={cn('rounded-full text-xs font-medium', activityBadgeClass(a.activity_type))}>
          {activityTypeLabel(a.activity_type)}
        </Badge>
      </div>
      <p className="mt-1 line-clamp-2 text-base font-semibold leading-snug">
        {a.name || <span className="text-muted-foreground">Ohne Titel</span>}
      </p>
      <div className="mt-1 flex items-center gap-3 font-mono text-sm tabular-nums text-muted-foreground">
        <span>{metrics.join(' · ')}</span>
        {a.description && (
          <NotebookPen
            className="ml-auto size-4 shrink-0 text-amber-600 dark:text-amber-400"
            aria-label="Mit Tagebucheintrag"
          />
        )}
      </div>
    </Link>
  );
}

export default function ActivityCardList({
  activities,
  filters,
}: {
  activities: Activity[];
  filters: ListFilters;
}) {
  return (
    <ul className="-mx-4 divide-y border-y">
      {activities.map((a) => (
        <li key={a.id}>
          <ActivityCard activity={a} filters={filters} />
        </li>
      ))}
    </ul>
  );
}

export function ActivityCardListSkeleton() {
  return (
    <ul className="-mx-4 divide-y border-y" aria-busy="true" aria-label="Wird geladen">
      {Array.from({ length: 8 }, (_, i) => (
        <li key={i} className="space-y-2 px-4 py-3">
          <div className="flex justify-between">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
          <Skeleton className="h-5 w-4/5" />
          <Skeleton className="h-4 w-40" />
        </li>
      ))}
    </ul>
  );
}

'use client';

import Link from 'next/link';
import type { Activity } from '@/lib/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import ActivityStats from '@/app/components/ActivityStats';

function fmtDate(d: string) {
  return new Date(d + 'T00:00:00').toLocaleDateString('de-CH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtActivity(t: string | null) {
  if (!t) return '—';
  return t.replace(/_/g, ' ');
}

const TYPE_BADGE: Record<string, string> = {
  'road biking':    'bg-primary/10 text-primary border-primary/20',
  'virtual ride':   'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  'indoor cycling': 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
};

function activityBadgeClass(type: string | null): string {
  const key = (type ?? '').toLowerCase().replace(/_/g, ' ');
  return TYPE_BADGE[key] ?? 'bg-secondary text-secondary-foreground border-transparent';
}

export default function ActivityDetail({ activity }: { activity: Activity }) {
  return (
    <main className="min-h-screen bg-background px-4 py-6">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="sticky top-0 -mx-4 px-4 py-3 bg-background/95 backdrop-blur border-b border-border z-10">
          <div className="flex items-center justify-between gap-3">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
              ← Back to list
            </Link>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" disabled>◀ Prev</Button>
              <Button variant="outline" size="sm" disabled>Next ▶</Button>
            </div>
            <span className="text-xs text-muted-foreground min-w-[70px] text-right">Saved ✓</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground leading-snug">
            {activity.name || '—'}
          </h1>
          <div className="flex items-center gap-2">
            <Badge className={cn('rounded-full text-[11px] font-medium', activityBadgeClass(activity.activity_type))}>
              {fmtActivity(activity.activity_type)}
            </Badge>
            <span className="text-xs font-mono text-muted-foreground">{fmtDate(activity.date)}</span>
          </div>
        </div>

        <ActivityStats activity={activity} layout="wide" />
      </div>
    </main>
  );
}

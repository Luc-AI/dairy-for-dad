import type { Activity } from '@/lib/db';
import { cn } from '@/lib/utils';
import {
  fmtDistance,
  fmtDuration,
  fmtElevation,
  fmtNumber,
  fmtTemp,
} from '@/lib/format';

type StatItem = { label: string; value: string };

function present(items: (StatItem | null)[]): StatItem[] {
  return items.filter((s): s is StatItem => s !== null);
}

function stat(label: string, value: number | null, format: (v: number) => string): StatItem | null {
  return value == null ? null : { label, value: format(value) };
}

function StatGrid({ items, className }: { items: StatItem[]; className?: string }) {
  if (items.length === 0) return null;
  return (
    <dl className={cn('grid grid-cols-2 gap-x-6 gap-y-4', className)}>
      {items.map((s) => (
        <div key={s.label} className="flex flex-col gap-1">
          <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
          <dd className="text-base font-semibold font-mono tabular-nums">{s.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function basicStats(a: Activity) {
  return present([
    stat('Distanz', a.distance_m, (v) => fmtDistance(v)),
    stat('Höhenmeter', a.elevation_gain_m, (v) => fmtElevation(v)),
    stat('Dauer', a.duration_sec, (v) => fmtDuration(v)),
  ]);
}

/** The three headline numbers, as large tiles. */
export function HeroStats({ activity }: { activity: Activity }) {
  const items = basicStats(activity);
  if (items.length === 0) return null;
  return (
    <dl className="grid grid-cols-3 gap-2">
      {items.map((s) => (
        <div key={s.label} className="rounded-lg border bg-card px-3 py-2.5 shadow-xs">
          <dt className="text-xs font-medium text-muted-foreground">{s.label}</dt>
          <dd className="mt-0.5 text-lg font-semibold font-mono tabular-nums leading-tight sm:text-xl">
            {s.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Secondary stats; missing values are left out rather than shown as "—". */
export default function ActivityStats({
  activity: a,
  showBasics = true,
  className,
}: {
  activity: Activity;
  showBasics?: boolean;
  className?: string;
}) {
  const items = present([
    ...(showBasics ? basicStats(a) : []),
    stat('Ø Tempo', a.avg_speed_kmh, (v) => `${v.toFixed(1)} km/h`),
    stat('Ø Leistung', a.avg_power, (v) => `${fmtNumber(v)} W`),
    stat('TSS', a.tss, (v) => fmtNumber(v)),
    stat('Ø Puls', a.avg_hr, (v) => `${v} bpm`),
    stat('Max. Puls', a.max_hr, (v) => `${v} bpm`),
    stat('Kalorien', a.calories, (v) => `${fmtNumber(v)} kcal`),
    stat('Ø Temperatur', a.avg_temperature, fmtTemp),
    stat('Min. Temperatur', a.min_temperature, fmtTemp),
    stat('Max. Temperatur', a.max_temperature, fmtTemp),
  ]);
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine weiteren Werte vorhanden.</p>;
  }
  return <StatGrid items={items} className={className} />;
}

function sum(activities: Activity[], key: keyof Activity) {
  return activities.reduce((s, a) => s + ((a[key] as number | null) ?? 0), 0);
}

function avg(activities: Activity[], key: keyof Activity): number | null {
  const vals = activities.map((a) => a[key] as number | null).filter((v): v is number => v != null);
  return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
}

/** Totals and averages across several activities. */
export function SummaryStats({ activities }: { activities: Activity[] }) {
  const nonZero = (label: string, v: number, format: (v: number) => string) =>
    v > 0 ? { label, value: format(v) } : null;

  const items = present([
    nonZero('Distanz total', sum(activities, 'distance_m'), fmtDistance),
    stat('Ø Distanz', avg(activities, 'distance_m'), fmtDistance),
    nonZero('Höhenmeter total', sum(activities, 'elevation_gain_m'), fmtElevation),
    nonZero('Dauer total', sum(activities, 'duration_sec'), fmtDuration),
    stat('Ø Puls', avg(activities, 'avg_hr'), (v) => `${Math.round(v)} bpm`),
    stat('Ø Leistung', avg(activities, 'avg_power'), (v) => `${Math.round(v)} W`),
    nonZero('Kalorien total', sum(activities, 'calories'), (v) => `${fmtNumber(v)} kcal`),
    nonZero('TSS total', sum(activities, 'tss'), fmtNumber),
  ]);
  return <StatGrid items={items} />;
}

export function DiaryNote({ description }: { description: string | null }) {
  if (!description) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground mb-1.5">Tagebuch</p>
      <p className="text-sm whitespace-pre-wrap leading-relaxed border-l-4 border-amber-300 pl-3">
        {description}
      </p>
    </div>
  );
}

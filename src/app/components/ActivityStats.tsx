import type { Activity } from '@/lib/db';
import { Separator } from '@/components/ui/separator';

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

function fmtTemp(t: number | null) {
  if (t == null) return '—';
  return t.toFixed(1) + '°C';
}

export type ActivityStatsLayout = 'narrow' | 'wide';

export default function ActivityStats({
  activity,
  layout = 'narrow',
}: {
  activity: Activity;
  layout?: ActivityStatsLayout;
}) {
  const gridCls =
    layout === 'wide'
      ? 'grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-5'
      : 'grid grid-cols-2 gap-x-6 gap-y-5';

  const stat = (label: string, value: string | null) => (
    <div key={label} className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none">{label}</dt>
      <dd className="text-[15px] font-semibold font-mono tabular-nums text-foreground leading-snug">{value || '—'}</dd>
    </div>
  );

  return (
    <div className="space-y-5">
      <dl className={gridCls}>
        {stat('Distance', fmtDistance(activity.distance_m))}
        {stat('Elevation', fmtElevation(activity.elevation_gain_m))}
        {stat('Duration', fmtDuration(activity.duration_sec))}
        {stat('Avg Speed', activity.avg_speed_kmh != null ? `${activity.avg_speed_kmh} km/h` : null)}
      </dl>
      <Separator />
      <dl className={gridCls}>
        {stat('Avg Power', activity.avg_power != null ? `${activity.avg_power} W` : null)}
        {stat('TSS', activity.tss != null ? String(activity.tss) : null)}
        {stat('Avg HR', activity.avg_hr != null ? `${activity.avg_hr} bpm` : null)}
        {stat('Max HR', activity.max_hr != null ? `${activity.max_hr} bpm` : null)}
      </dl>
      <Separator />
      <dl className={gridCls}>
        {stat('Calories', activity.calories != null ? activity.calories.toLocaleString() : null)}
        {stat('Avg Temp', fmtTemp(activity.avg_temperature))}
        {stat('Min Temp', fmtTemp(activity.min_temperature))}
        {stat('Max Temp', fmtTemp(activity.max_temperature))}
      </dl>

      {activity.location_name && (
        <div>
          <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none mb-1.5">Location</p>
          <p className="text-sm text-foreground">{activity.location_name}</p>
        </div>
      )}
    </div>
  );
}

export function DiaryNote({ description }: { description: string | null }) {
  if (!description) return null;
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none mb-1.5">
        Diary Note
      </p>
      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed border-l-4 border-amber-300 pl-3">
        {description}
      </p>
    </div>
  );
}

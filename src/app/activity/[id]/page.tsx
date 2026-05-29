import { notFound, redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import type { Activity } from '@/lib/db';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';
import ActivityDetail from './ActivityDetail';

async function loadActivity(id: number): Promise<Activity | null> {
  const rows = await sql.query(
    `SELECT id, date::text AS date, name, activity_type, duration_sec, distance_m, elevation_gain_m,
            avg_speed_kmh, avg_hr, max_hr, calories, avg_power, tss,
            avg_temperature, min_temperature, max_temperature,
            start_lat, start_lon, location_name, description
     FROM activities WHERE id = $1`,
    [id]
  );
  return (rows[0] as Activity | undefined) ?? null;
}

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) redirect('/login');

  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) notFound();

  const activity = await loadActivity(id);
  if (!activity) notFound();

  return <ActivityDetail activity={activity} />;
}

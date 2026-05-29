import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';
import type { Activity } from '@/lib/db';

const CHUNK_SIZE = 500;

const COLS: (keyof Activity)[] = [
  'id', 'date', 'name', 'activity_type', 'duration_sec', 'distance_m',
  'elevation_gain_m', 'avg_speed_kmh', 'avg_hr', 'max_hr', 'calories',
  'avg_power', 'tss', 'avg_temperature', 'min_temperature', 'max_temperature',
  'start_lat', 'start_lon', 'location_name', 'description',
];

function isActivityShape(x: unknown): x is Activity {
  if (!x || typeof x !== 'object') return false;
  const a = x as Partial<Activity>;
  return typeof a.id === 'number' && typeof a.date === 'string';
}

export async function POST(req: NextRequest) {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const activities = (body as { activities?: unknown })?.activities;
  if (!Array.isArray(activities) || !activities.every(isActivityShape)) {
    return NextResponse.json(
      { error: 'Body must be { activities: Activity[] } with id (number) and date (string) on each row.' },
      { status: 400 }
    );
  }

  let inserted = 0;
  for (let i = 0; i < activities.length; i += CHUNK_SIZE) {
    const batch = activities.slice(i, i + CHUNK_SIZE);
    const values: unknown[] = [];
    const placeholders = batch
      .map((row, rowIdx) => {
        const base = rowIdx * COLS.length;
        COLS.forEach((c) => values.push(row[c] ?? null));
        return '(' + COLS.map((_, j) => `$${base + j + 1}`).join(',') + ')';
      })
      .join(',');

    const query = `
      INSERT INTO activities (${COLS.join(',')})
      VALUES ${placeholders}
      ON CONFLICT (id) DO NOTHING
      RETURNING id
    `;

    try {
      const result = (await sql.query(query, values)) as { id: number }[];
      inserted += result.length;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Insert failed';
      return NextResponse.json({ error: message, inserted }, { status: 500 });
    }
  }

  return NextResponse.json({
    inserted,
    skipped: activities.length - inserted,
  });
}

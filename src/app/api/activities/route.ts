import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { sql } from '@/lib/db';
import { SESSION_COOKIE, isValidSession } from '@/lib/auth';

const SORTABLE = new Set([
  'date', 'distance_m', 'elevation_gain_m', 'duration_sec',
  'avg_hr', 'calories', 'avg_power', 'tss',
  'avg_temperature', 'min_temperature', 'max_temperature',
]);

export async function GET(req: NextRequest) {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!(await isValidSession(token))) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;

  const search = searchParams.get('search') ?? '';
  const sortByParam = searchParams.get('sortBy') ?? 'date';
  const sortDirAsc = searchParams.get('sortDir') === 'asc';
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';

  const column = SORTABLE.has(sortByParam) ? sortByParam : 'date';
  const direction = sortDirAsc ? 'ASC' : 'DESC';

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (search) {
    params.push(`%${search}%`);
    const p = `$${params.length}`;
    conditions.push(
      `(name ILIKE ${p} OR location_name ILIKE ${p} OR activity_type ILIKE ${p} OR description ILIKE ${p})`
    );
  }
  if (dateFrom) {
    params.push(dateFrom);
    conditions.push(`date >= $${params.length}`);
  }
  if (dateTo) {
    params.push(dateTo);
    conditions.push(`date <= $${params.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const query = `
    SELECT id, date, name, activity_type, duration_sec, distance_m, elevation_gain_m,
           avg_speed_kmh, avg_hr, max_hr, calories, avg_power, tss,
           avg_temperature, min_temperature, max_temperature, location_name, description
    FROM activities
    ${where}
    ORDER BY ${column} ${direction}
  `;

  try {
    const rows = await sql.query(query, params);
    return NextResponse.json(rows);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Query failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { supabase, type Activity } from '@/lib/supabase';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;

  const search = searchParams.get('search') ?? '';
  const sortBy = (searchParams.get('sortBy') ?? 'date') as keyof Activity;
  const sortDir = searchParams.get('sortDir') === 'asc' ? true : false;
  const dateFrom = searchParams.get('dateFrom') ?? '';
  const dateTo = searchParams.get('dateTo') ?? '';

  const SORTABLE = [
    'date', 'distance_m', 'elevation_gain_m', 'duration_sec',
    'avg_hr', 'calories', 'avg_power', 'tss',
    'avg_temperature', 'min_temperature', 'max_temperature',
  ];
  const column = SORTABLE.includes(sortBy as string) ? sortBy : 'date';

  let query = supabase
    .from('activities')
    .select(
      'id, date, name, activity_type, duration_sec, distance_m, elevation_gain_m, avg_speed_kmh, avg_hr, max_hr, calories, avg_power, tss, avg_temperature, min_temperature, max_temperature, location_name, description'
    )
    .order(column as string, { ascending: sortDir });

  if (search) {
    query = query.or(
      `name.ilike.%${search}%,location_name.ilike.%${search}%,activity_type.ilike.%${search}%,description.ilike.%${search}%`
    );
  }

  if (dateFrom) query = query.gte('date', dateFrom);
  if (dateTo) query = query.lte('date', dateTo);

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}

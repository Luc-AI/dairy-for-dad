// Activity type labels and filter groups. Garmin types are raw strings like
// "road_biking"; the UI shows German labels and filters by coarse groups.

const TYPE_LABELS: Record<string, string> = {
  road_biking: 'Rennvelo',
  cycling: 'Velo',
  mountain_biking: 'Mountainbike',
  virtual_ride: 'Virtuell',
  indoor_cycling: 'Indoor',
  e_bike_fitness: 'E-Bike',
  running: 'Laufen',
  street_running: 'Laufen',
  hiking: 'Wandern',
  motorcycling_v2: 'Motorrad',
  atv_v2: 'Quad',
  strength_training: 'Krafttraining',
  open_water_swimming: 'Schwimmen',
  fitness_equipment: 'Fitness',
  other: 'Andere',
};

export function activityTypeLabel(type: string | null): string {
  if (!type) return '—';
  return TYPE_LABELS[type] ?? type.replace(/_v\d+$/, '').replace(/_/g, ' ');
}

export type TypeGroup = 'road' | 'mtb' | 'indoor' | 'run' | 'other';

export const TYPE_GROUPS: { id: TypeGroup; label: string; types: string[] }[] = [
  { id: 'road', label: 'Velo', types: ['road_biking', 'cycling', 'e_bike_fitness'] },
  { id: 'mtb', label: 'MTB', types: ['mountain_biking'] },
  { id: 'indoor', label: 'Indoor', types: ['virtual_ride', 'indoor_cycling'] },
  { id: 'run', label: 'Laufen', types: ['running', 'street_running'] },
  { id: 'other', label: 'Andere', types: [] },
];

/** All raw types that belong to a named (non-"other") group. */
export const GROUPED_TYPES = TYPE_GROUPS.flatMap((g) => g.types);

export function isTypeGroup(v: string | null): v is TypeGroup {
  return TYPE_GROUPS.some((g) => g.id === v);
}

export function typeGroupOf(type: string | null): TypeGroup {
  return TYPE_GROUPS.find((g) => g.types.includes(type ?? ''))?.id ?? 'other';
}

const GROUP_BADGE: Record<TypeGroup, string> = {
  road: 'bg-primary/10 text-primary border-primary/20',
  mtb: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20',
  indoor: 'bg-violet-500/10 text-violet-700 dark:text-violet-400 border-violet-500/20',
  run: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  other: 'bg-secondary text-secondary-foreground border-transparent',
};

export function activityBadgeClass(type: string | null): string {
  return GROUP_BADGE[typeGroupOf(type)];
}

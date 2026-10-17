'use client';

import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
import { TYPE_GROUPS, isTypeGroup } from '@/lib/activity-types';
import {
  SORT_OPTIONS,
  activeFilterCount,
  selectedYear,
  yearRange,
  type ListFilters,
} from '@/lib/list-query';

const CHIP =
  'h-9 rounded-full border bg-background px-4 text-sm data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground hover:data-[state=on]:bg-primary/90 hover:data-[state=on]:text-primary-foreground';

type SetFilters = (patch: Partial<ListFilters>) => void;

/** Horizontally scrolling year shortcuts: "Alle", 2026, 2025, … */
export function YearChips({
  years,
  filters,
  setFilters,
}: {
  years: number[];
  filters: ListFilters;
  setFilters: SetFilters;
}) {
  const year = selectedYear(filters);
  // A custom date range (set in the drawer) highlights no chip.
  const value = year !== null ? String(year) : filters.from || filters.to ? '' : 'all';

  return (
    <ToggleGroup
      type="single"
      spacing={2}
      value={value}
      onValueChange={(v) => {
        if (!v) return;
        setFilters(v === 'all' ? { from: '', to: '' } : yearRange(Number(v)));
      }}
      aria-label="Jahr"
      className="-mx-4 w-auto max-w-none flex-nowrap justify-start overflow-x-auto px-4 [scrollbar-width:none] md:mx-0 md:px-0"
    >
      <ToggleGroupItem value="all" className={CHIP}>
        Alle
      </ToggleGroupItem>
      {years.map((y) => (
        <ToggleGroupItem key={y} value={String(y)} className={CHIP}>
          {y}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  );
}

export function FilterDrawer({
  filters,
  setFilters,
  resultCount,
}: {
  filters: ListFilters;
  setFilters: SetFilters;
  resultCount: number | null;
}) {
  const count = activeFilterCount(filters);
  const sortId =
    SORT_OPTIONS.find((o) => o.sort === filters.sort && o.dir === filters.dir)?.id ?? '';

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="outline" size="icon" className="relative size-11 shrink-0" aria-label="Filter und Sortierung">
          <SlidersHorizontal className="size-5" />
          {count > 0 && (
            <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto flex w-full max-w-lg flex-col overflow-y-auto">
          <DrawerHeader className="text-left">
            <DrawerTitle>Filter und Sortierung</DrawerTitle>
          </DrawerHeader>

          <div className="space-y-6 px-4 pb-2">
            <Section title="Sortierung">
              <ToggleGroup
                type="single"
                spacing={2}
                value={sortId}
                onValueChange={(v) => {
                  const opt = SORT_OPTIONS.find((o) => o.id === v);
                  if (opt) setFilters({ sort: opt.sort, dir: opt.dir });
                }}
                className="w-full flex-wrap"
              >
                {SORT_OPTIONS.map((o) => (
                  <ToggleGroupItem key={o.id} value={o.id} className={CHIP}>
                    {o.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Section>

            <Section title="Typ">
              <ToggleGroup
                type="single"
                spacing={2}
                value={filters.type || 'all'}
                onValueChange={(v) => {
                  if (!v) return;
                  setFilters({ type: isTypeGroup(v) ? v : '' });
                }}
                className="w-full flex-wrap"
              >
                <ToggleGroupItem value="all" className={CHIP}>
                  Alle
                </ToggleGroupItem>
                {TYPE_GROUPS.map((g) => (
                  <ToggleGroupItem key={g.id} value={g.id} className={CHIP}>
                    {g.label}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </Section>

            <Section title="Zeitraum">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="filter-from" className="text-muted-foreground">Von</Label>
                  <Input
                    id="filter-from"
                    type="date"
                    value={filters.from}
                    max={filters.to || undefined}
                    onChange={(e) => setFilters({ from: e.target.value })}
                    className="h-11 text-base md:text-base"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="filter-to" className="text-muted-foreground">Bis</Label>
                  <Input
                    id="filter-to"
                    type="date"
                    value={filters.to}
                    min={filters.from || undefined}
                    onChange={(e) => setFilters({ to: e.target.value })}
                    className="h-11 text-base md:text-base"
                  />
                </div>
              </div>
            </Section>
          </div>

          <DrawerFooter className="flex-row pb-[max(1rem,env(safe-area-inset-bottom))]">
            <Button
              variant="outline"
              className="h-11 flex-1"
              onClick={() => setFilters({ sort: 'date', dir: 'desc', type: '', from: '', to: '' })}
            >
              Zurücksetzen
            </Button>
            <DrawerClose asChild>
              <Button className="h-11 flex-1">
                {resultCount === null ? 'Anzeigen' : `${resultCount.toLocaleString('de-CH')} anzeigen`}
              </Button>
            </DrawerClose>
          </DrawerFooter>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

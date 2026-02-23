"use client";

import { useState, useEffect } from "react";
import { Sun, Moon, ArrowUpDown, ArrowUp, ArrowDown, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const activities = [
  { id: 1, date: "03.02.2026", name: "GS Zürichsee Runde über Pfäffikon", type: "Road Biking", distance: 74.3, elevation: 839, duration: "3h 05m", power: 174, avgHR: 142, maxHR: 171, avgSpeed: 24.1, tss: 112.4, calories: 2187, minTemp: 2, maxTemp: 8 },
  { id: 2, date: "01.02.2026", name: "GS Zürichseerunde", type: "Road Biking", distance: 73.6, elevation: 744, duration: "3h 17m", power: 157, avgHR: 138, maxHR: 165, avgSpeed: 22.4, tss: 98.1, calories: 2054, minTemp: 1, maxTemp: 6 },
  { id: 3, date: "31.01.2026", name: "Greifensee Virtuelles Radfahren", type: "Virtual Ride", distance: 30.8, elevation: 286, duration: "1h 15m", power: 138, avgHR: 128, maxHR: 152, avgSpeed: 24.6, tss: 55.2, calories: 812, minTemp: null, maxTemp: null },
  { id: 4, date: "30.01.2026", name: "Greifensee Virtuelles Radfahren", type: "Virtual Ride", distance: 30.9, elevation: 287, duration: "1h 14m", power: 138, avgHR: 130, maxHR: 155, avgSpeed: 25.1, tss: 54.8, calories: 798, minTemp: null, maxTemp: null },
  { id: 5, date: "27.01.2026", name: "Indoor Cycling", type: "Indoor Cycling", distance: 30.8, elevation: null, duration: "1h 13m", power: 178, avgHR: 122, maxHR: 143, avgSpeed: 25, tss: 73.9, calories: 3717, minTemp: 18, maxTemp: 20 },
  { id: 6, date: "24.01.2026", name: "GC 26 Farewell round bei Tetir", type: "Road Biking", distance: 82.1, elevation: 1455, duration: "3h 52m", power: 169, avgHR: 145, maxHR: 178, avgSpeed: 21.2, tss: 145.3, calories: 2876, minTemp: 18, maxTemp: 24 },
  { id: 7, date: "23.01.2026", name: "GC 26 Fataga in dunklen Wolken", type: "Road Biking", distance: 103.0, elevation: 1536, duration: "4h 44m", power: 157, avgHR: 140, maxHR: 172, avgSpeed: 21.8, tss: 162.7, calories: 3412, minTemp: 16, maxTemp: 22 },
  { id: 8, date: "22.01.2026", name: "GC 26 chillige Küstenfahrt", type: "Road Biking", distance: 74.6, elevation: 854, duration: "3h 29m", power: 136, avgHR: 132, maxHR: 158, avgSpeed: 21.4, tss: 89.6, calories: 1987, minTemp: 19, maxTemp: 25 },
  { id: 9, date: "21.01.2026", name: "GC 26 T13 Las Palmas – Maspalomas", type: "Road Biking", distance: 101.8, elevation: 1369, duration: "5h 03m", power: 147, avgHR: 137, maxHR: 168, avgSpeed: 20.2, tss: 151.2, calories: 3156, minTemp: 17, maxTemp: 23 },
  { id: 10, date: "20.01.2026", name: "FV GC26 T12 Pajara FV – Tuineje", type: "Road Biking", distance: 72.2, elevation: 1131, duration: "3h 57m", power: 147, avgHR: 139, maxHR: 166, avgSpeed: 18.3, tss: 118.4, calories: 2543, minTemp: 18, maxTemp: 26 },
  { id: 11, date: "19.01.2026", name: "FV26 T11 Puerto Holan – Cofete", type: "Road Biking", distance: 91.1, elevation: 1502, duration: "4h 29m", power: 159, avgHR: 143, maxHR: 175, avgSpeed: 20.3, tss: 156.8, calories: 3087, minTemp: 16, maxTemp: 24 },
  { id: 12, date: "18.01.2026", name: "LZ FV26 T10 Arrecife – Corralejo", type: "Road Biking", distance: 70.6, elevation: 736, duration: "3h 25m", power: 134, avgHR: 131, maxHR: 160, avgSpeed: 20.6, tss: 82.1, calories: 1876, minTemp: 17, maxTemp: 22 },
  { id: 13, date: "16.01.2026", name: "LZ26 T8 traumhafte Nordküste", type: "Road Biking", distance: 100.5, elevation: 1394, duration: "5h 03m", power: 153, avgHR: 141, maxHR: 170, avgSpeed: 19.9, tss: 148.9, calories: 3234, minTemp: 15, maxTemp: 23 },
  { id: 14, date: "15.01.2026", name: "LZ26 T7 von Ostküste zur Westküste", type: "Road Biking", distance: 100.3, elevation: 1179, duration: "5h 02m", power: 141, avgHR: 136, maxHR: 164, avgSpeed: 19.9, tss: 138.5, calories: 2987, minTemp: 14, maxTemp: 21 },
];

type Activity = typeof activities[number];

// ---------------------------------------------------------------------------
// Badge class map
// ---------------------------------------------------------------------------

const typeBadgeClass: Record<string, string> = {
  "Road Biking":    "bg-primary/10 text-primary border-primary/20",
  "Virtual Ride":   "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
  "Indoor Cycling": "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
};

function activityBadgeClass(type: string) {
  return typeBadgeClass[type] ?? typeBadgeClass["Road Biking"];
}

// ---------------------------------------------------------------------------
// StatBlock
// ---------------------------------------------------------------------------

function StatBlock({ label, value, unit }: { label: string; value: string | number | null; unit?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground leading-none">
        {label}
      </dt>
      <dd className="text-[15px] font-semibold font-mono tabular-nums text-foreground leading-snug">
        {value ?? "—"}
        {unit && value != null && (
          <span className="text-[11px] font-normal text-muted-foreground ml-0.5">{unit}</span>
        )}
      </dd>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Detail content (shared by side panel + sheet)
// ---------------------------------------------------------------------------

function DetailContent({ activity, onClose }: { activity: Activity; onClose: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <div className="flex items-start justify-between gap-3 mb-2">
          <h2 className="text-[17px] font-bold tracking-tight text-foreground leading-snug">
            {activity.name}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Badge className={cn("rounded-full text-[11px] font-medium", activityBadgeClass(activity.type))}>
            {activity.type}
          </Badge>
          <span className="text-xs font-mono text-muted-foreground">{activity.date}</span>
        </div>
      </div>

      <Separator />

      {/* Performance */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
        <StatBlock label="Distance"  value={activity.distance}  unit="km" />
        <StatBlock label="Elevation" value={activity.elevation} unit="m" />
        <StatBlock label="Duration"  value={activity.duration} />
        <StatBlock label="Avg Speed" value={activity.avgSpeed}  unit="km/h" />
      </dl>

      <Separator />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
        <StatBlock label="Avg Power" value={activity.power}  unit="W" />
        <StatBlock label="TSS"       value={activity.tss} />
        <StatBlock label="Avg HR"    value={activity.avgHR}   unit="bpm" />
        <StatBlock label="Max HR"    value={activity.maxHR}   unit="bpm" />
      </dl>

      <Separator />

      <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
        <StatBlock
          label="Calories"
          value={activity.calories ? activity.calories.toLocaleString() : null}
        />
        <StatBlock
          label="Avg Temp"
          value={
            activity.minTemp != null && activity.maxTemp != null
              ? `${activity.minTemp}–${activity.maxTemp}`
              : null
          }
          unit="°C"
        />
      </dl>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop side panel
// ---------------------------------------------------------------------------

function DesktopDetailPanel({ activity, onClose }: { activity: Activity | null; onClose: () => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activity) {
      setVisible(false);
      const t = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [activity?.id]);

  if (!activity) return null;

  return (
    <Card
      className={cn(
        "w-[320px] min-w-[320px] shrink-0 border-l rounded-none overflow-y-auto transition-all duration-200",
        visible ? "opacity-100 translate-x-0" : "opacity-0 translate-x-3"
      )}
    >
      <CardContent className="p-6">
        <DetailContent activity={activity} onClose={onClose} />
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mobile bottom sheet
// ---------------------------------------------------------------------------

function MobileBottomSheet({ activity, onClose }: { activity: Activity | null; onClose: () => void }) {
  return (
    <Sheet open={!!activity} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="bottom" className="max-h-[80vh] overflow-y-auto rounded-t-2xl" showCloseButton={false}>
        <SheetHeader className="mb-1">
          <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border" />
          {activity && (
            <>
              <SheetTitle className="text-base text-left">{activity.name}</SheetTitle>
              <div className="flex items-center gap-2 mt-1">
                <Badge className={cn("rounded-full text-[10px]", activity ? activityBadgeClass(activity.type) : "")}>
                  {activity.type}
                </Badge>
                <span className="text-xs font-mono text-muted-foreground">{activity.date}</span>
              </div>
            </>
          )}
        </SheetHeader>
        <Separator className="my-4" />
        {activity && (
          <div className="flex flex-col gap-5 pb-2">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              <StatBlock label="Distance"  value={activity.distance}  unit="km" />
              <StatBlock label="Elevation" value={activity.elevation} unit="m" />
              <StatBlock label="Duration"  value={activity.duration} />
              <StatBlock label="Avg Speed" value={activity.avgSpeed}  unit="km/h" />
            </dl>
            <Separator />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              <StatBlock label="Avg Power" value={activity.power}  unit="W" />
              <StatBlock label="TSS"       value={activity.tss} />
              <StatBlock label="Avg HR"    value={activity.avgHR}   unit="bpm" />
              <StatBlock label="Max HR"    value={activity.maxHR}   unit="bpm" />
            </dl>
            <Separator />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5">
              <StatBlock
                label="Calories"
                value={activity.calories ? activity.calories.toLocaleString() : null}
              />
              <StatBlock
                label="Avg Temp"
                value={
                  activity.minTemp != null && activity.maxTemp != null
                    ? `${activity.minTemp}–${activity.maxTemp}`
                    : null
                }
                unit="°C"
              />
            </dl>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Mobile activity card
// ---------------------------------------------------------------------------

function MobileActivityCard({
  activity,
  isSelected,
  onSelect,
}: {
  activity: Activity;
  isSelected: boolean;
  onSelect: (a: Activity) => void;
}) {
  return (
    <div
      onClick={() => onSelect(activity)}
      className={cn(
        "px-4 py-3.5 border-b border-border cursor-pointer transition-colors duration-100",
        "border-l-[3px]",
        isSelected
          ? "bg-accent border-l-primary"
          : "border-l-transparent hover:bg-accent/50"
      )}
    >
      <div className="flex justify-between items-start mb-1.5 gap-2">
        <span className="text-sm font-semibold text-foreground leading-snug">
          {activity.name}
        </span>
        <span className="text-[11px] font-mono text-muted-foreground whitespace-nowrap shrink-0 mt-0.5">
          {activity.date}
        </span>
      </div>
      <div className="mb-2.5">
        <Badge className={cn("rounded-full text-[10px] font-medium", activityBadgeClass(activity.type))}>
          {activity.type}
        </Badge>
      </div>
      <div className="flex gap-4">
        {[
          { v: activity.distance.toFixed(1), u: "km" },
          { v: activity.elevation ? String(activity.elevation) : "—", u: activity.elevation ? "m" : "" },
          { v: activity.duration, u: "" },
          { v: String(activity.power), u: "W" },
        ].map((s, i) => (
          <span key={i} className="text-[13px] font-mono font-medium tabular-nums text-foreground">
            {s.v}
            {s.u && (
              <span className="text-[10px] font-normal text-muted-foreground ml-px">{s.u}</span>
            )}
          </span>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({ col, sortCol, sortDir }: { col: string; sortCol: string; sortDir: "asc" | "desc" }) {
  if (sortCol !== col) return <ArrowUpDown className="inline ml-1 w-3 h-3 opacity-30" />;
  return sortDir === "asc"
    ? <ArrowUp className="inline ml-1 w-3 h-3 text-primary" />
    : <ArrowDown className="inline ml-1 w-3 h-3 text-primary" />;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ActivityLog() {
  const [selected, setSelected] = useState<Activity | null>(null);
  const [dark, setDark] = useState(false);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("date");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 720px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const filtered = activities.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.type.toLowerCase().includes(search.toLowerCase())
  );

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === "asc" ? 1 : -1;
    if (sortCol === "date") {
      const [da, ma, ya] = a.date.split(".").map(Number);
      const [db, mb, yb] = b.date.split(".").map(Number);
      return dir * (new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime());
    }
    if (["distance", "elevation", "power"].includes(sortCol)) {
      return dir * (((a as Record<string, unknown>)[sortCol] as number || 0) - ((b as Record<string, unknown>)[sortCol] as number || 0));
    }
    return 0;
  });

  function handleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  const thClass = (align: "left" | "right" = "left") =>
    cn(
      "px-4 py-2.5 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground",
      "select-none whitespace-nowrap sticky top-0 bg-card z-10 border-b border-border",
      align === "right" ? "text-right" : "text-left"
    );

  return (
    <div className={dark ? "dark" : ""}>
      <div className="min-h-screen bg-background text-foreground font-sans transition-colors duration-300">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-8 flex flex-col min-h-screen">

          {/* Header */}
          <header className={cn(
            "flex justify-between items-start",
            isMobile ? "py-5" : "py-8"
          )}>
            <div>
              <h1 className={cn(
                "font-bold tracking-tight text-foreground leading-tight",
                isMobile ? "text-[22px]" : "text-[26px]"
              )}>
                Activity Log
              </h1>
              <p className="text-sm text-muted-foreground mt-1">Garmin history — 2012 to present</p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setDark(!dark)}
                className="h-9 w-9"
                aria-label="Toggle dark mode"
              >
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              {!isMobile && (
                <Button variant="outline" size="sm" className="text-muted-foreground">
                  Sign out
                </Button>
              )}
            </div>
          </header>

          {/* Filters */}
          <div className={cn(
            "flex gap-2.5 items-center",
            isMobile ? "mb-3 flex-wrap" : "mb-5 flex-nowrap"
          )}>
            <div className={cn("relative flex-1", isMobile && "w-full min-w-full")}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="text"
                placeholder="Search activities..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {!isMobile && (
              <>
                <Input type="date" className="w-auto" />
                <Input type="date" className="w-auto" />
              </>
            )}
          </div>

          {/* Content */}
          {isMobile ? (
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden flex-1">
              <div className="overflow-y-auto max-h-[calc(100vh-160px)]">
                {sorted.map((a) => (
                  <MobileActivityCard
                    key={a.id}
                    activity={a}
                    isSelected={selected?.id === a.id}
                    onSelect={(act) => setSelected(selected?.id === act.id ? null : act)}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 rounded-xl border border-border overflow-hidden bg-card shadow-sm">
              {/* Table */}
              <div className="flex-1 overflow-x-auto overflow-y-auto max-h-[calc(100vh-200px)]">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr>
                      <th className={cn(thClass(), "cursor-pointer")} onClick={() => handleSort("date")}>
                        Date<SortIcon col="date" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className={cn(thClass(), "min-w-[240px] cursor-default")}>Name</th>
                      <th className={cn(thClass(), "cursor-default")}>Type</th>
                      <th className={cn(thClass("right"), "cursor-pointer")} onClick={() => handleSort("distance")}>
                        Distance<SortIcon col="distance" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className={cn(thClass("right"), "cursor-pointer")} onClick={() => handleSort("elevation")}>
                        Elevation<SortIcon col="elevation" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                      <th className={cn(thClass("right"), "cursor-default")}>Duration</th>
                      <th className={cn(thClass("right"), "cursor-pointer")} onClick={() => handleSort("power")}>
                        Power<SortIcon col="power" sortCol={sortCol} sortDir={sortDir} />
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((a, i) => {
                      const isSelected = selected?.id === a.id;
                      const isHovered = hoveredRow === a.id;
                      return (
                        <tr
                          key={a.id}
                          onClick={() => setSelected(isSelected ? null : a)}
                          onMouseEnter={() => setHoveredRow(a.id)}
                          onMouseLeave={() => setHoveredRow(null)}
                          className={cn(
                            "cursor-pointer transition-colors duration-100 border-l-[3px]",
                            isSelected
                              ? "bg-primary/10 border-l-primary"
                              : isHovered
                                ? "bg-accent border-l-transparent"
                                : i % 2 === 1
                                  ? "bg-muted/30 border-l-transparent"
                                  : "border-l-transparent"
                          )}
                        >
                          <td className="px-4 py-3 whitespace-nowrap font-mono text-xs text-muted-foreground tabular-nums border-b border-border">
                            {a.date}
                          </td>
                          <td className="px-4 py-3 font-medium text-foreground border-b border-border max-w-[280px] truncate">
                            {a.name}
                          </td>
                          <td className="px-4 py-3 border-b border-border">
                            <Badge className={cn("rounded-full text-[11px] font-medium", activityBadgeClass(a.type))}>
                              {a.type}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-medium border-b border-border">
                            {a.distance.toFixed(1)}{" "}
                            <span className="text-[11px] font-normal text-muted-foreground">km</span>
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-medium border-b border-border">
                            {a.elevation ? a.elevation.toLocaleString() : "—"}
                            {a.elevation && <span className="text-[11px] font-normal text-muted-foreground ml-0.5">m</span>}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-medium border-b border-border">
                            {a.duration}
                          </td>
                          <td className={cn(
                            "px-4 py-3 text-right font-mono tabular-nums font-semibold border-b border-border",
                            a.power >= 170 ? "text-primary" : "text-foreground"
                          )}>
                            {a.power}{" "}
                            <span className="text-[11px] font-normal text-muted-foreground">W</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Desktop side panel */}
              <DesktopDetailPanel activity={selected} onClose={() => setSelected(null)} />
            </div>
          )}

          {/* Footer */}
          <div className="py-4 flex justify-between items-center">
            <span className="text-xs text-muted-foreground">{sorted.length} activities</span>
            <span className="text-[11px] text-muted-foreground opacity-40">Garmin Connect</span>
          </div>
        </div>

        {/* Mobile sheet */}
        {isMobile && (
          <MobileBottomSheet activity={selected} onClose={() => setSelected(null)} />
        )}
      </div>
    </div>
  );
}

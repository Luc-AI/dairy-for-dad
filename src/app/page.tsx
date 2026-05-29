import ActivityTable from './components/ActivityTable';
import LogoutButton from './components/LogoutButton';
import ImportActivitiesButton from './components/ImportActivitiesButton';

export default function Home() {
  return (
    <main className="min-h-screen bg-background px-4 py-8">
      <div className="max-w-[1600px] mx-auto space-y-6">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Activity Log</h1>
            <p className="text-sm text-muted-foreground mt-1">Garmin history — 2012 to present</p>
          </div>
          <div className="flex items-center gap-2">
            <ImportActivitiesButton />
            <LogoutButton />
          </div>
        </div>
        <ActivityTable />
      </div>
    </main>
  );
}

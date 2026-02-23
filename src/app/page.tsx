import ActivityTable from './components/ActivityTable';
import LogoutButton from './components/LogoutButton';

export default function Home() {
  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
            <p className="text-sm text-gray-500 mt-1">Garmin history — 2012 to present</p>
          </div>
          <LogoutButton />
        </div>
        <ActivityTable />
      </div>
    </main>
  );
}

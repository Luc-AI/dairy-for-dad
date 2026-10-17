import { Suspense } from 'react';
import ActivityList from './components/ActivityList';
import AppHeader from './components/AppHeader';

export default function Home() {
  return (
    <main className="min-h-dvh px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))] md:py-8">
      <div className="mx-auto max-w-[1600px] space-y-3 md:space-y-6">
        <AppHeader />
        <Suspense>
          <ActivityList />
        </Suspense>
      </div>
    </main>
  );
}

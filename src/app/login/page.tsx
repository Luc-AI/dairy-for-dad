import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const { message } = await searchParams;

  async function signIn(formData: FormData) {
    'use server';

    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      redirect('/login?message=Invalid+email+or+password');
    }

    redirect('/');
  }

  return (
    <main className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900">Activity Log</h1>
          <p className="text-sm text-gray-500 mt-1">Sign in to continue</p>
        </div>

        <form
          action={signIn}
          className="bg-white border border-gray-200 rounded-lg shadow-sm px-6 py-8 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-xs text-gray-500 mb-1">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-xs text-gray-500 mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
          </div>

          {message && (
            <p className="text-sm text-red-600 text-center">{message}</p>
          )}

          <button
            type="submit"
            className="w-full bg-blue-600 text-white rounded px-4 py-2 text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            Sign in
          </button>
        </form>
      </div>
    </main>
  );
}

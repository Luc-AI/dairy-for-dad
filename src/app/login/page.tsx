import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { SESSION_COOKIE, expectedSessionToken, verifyPassword } from '@/lib/auth';
import { APP_NAME } from '@/lib/app';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  async function signIn(formData: FormData) {
    'use server';

    const password = formData.get('password') as string;

    if (!(await verifyPassword(password))) {
      redirect('/login?error=1');
    }

    const token = await expectedSessionToken();
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    redirect('/');
  }

  return (
    <main className="min-h-dvh flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold">{APP_NAME}</h1>
          <p className="text-muted-foreground mt-1">Bitte anmelden</p>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">Anmelden</CardTitle>
            {error && (
              <CardDescription className="text-destructive" role="alert">
                Falsches Passwort. Bitte nochmals versuchen.
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <form action={signIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password">Passwort</Label>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  autoFocus
                  aria-invalid={error ? true : undefined}
                  className="h-11 text-base md:text-base"
                />
              </div>

              <Button type="submit" className="h-11 w-full text-base">
                Anmelden
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

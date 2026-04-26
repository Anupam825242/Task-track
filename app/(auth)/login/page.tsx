import LoginForm from './LoginForm';

interface LoginPageProps {
  searchParams: Promise<{ redirectTo?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { redirectTo } = await searchParams;

  return (
    <div className="w-full max-w-sm rounded-lg border bg-card p-8 shadow-sm">
      <div className="mb-6 space-y-1.5">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in to Task Track</h1>
        <p className="text-sm text-muted-foreground">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>
      <LoginForm redirectTo={redirectTo ?? '/projects'} />
    </div>
  );
}

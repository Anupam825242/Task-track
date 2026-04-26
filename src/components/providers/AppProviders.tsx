'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { Toaster } from 'sonner';
import { useState, type ReactNode } from 'react';
import { CurrentUserProvider } from './CurrentUserProvider';
import type { AppUser } from '@/types/domain';

interface AppProvidersProps {
  children: ReactNode;
  user: AppUser | null;
}

export function AppProviders({ children, user }: AppProvidersProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry auth errors
              const code = (error as { code?: string })?.code;
              if (code === 'UNAUTHENTICATED' || code === 'FORBIDDEN') return false;
              return failureCount < 2;
            },
          },
          mutations: {
            retry: false,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <CurrentUserProvider user={user}>
        {children}
        <Toaster position="bottom-right" closeButton richColors />
        {process.env.NODE_ENV === 'development' && (
          <ReactQueryDevtools initialIsOpen={false} buttonPosition="bottom-left" />
        )}
      </CurrentUserProvider>
    </QueryClientProvider>
  );
}

'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // @ts-ignore - SessionProvider type mismatch with React 19
  return <SessionProvider>{children}</SessionProvider>;
}

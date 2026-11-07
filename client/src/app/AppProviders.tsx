import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { LazyMotion, MotionConfig } from 'framer-motion';
import { useState, type ReactNode } from 'react';
import { createQueryClient } from '../lib/queryClient';

const loadMotionFeatures = () => import('./motionFeatures').then((m) => m.default);

export function AppProviders({ children, client }: { children: ReactNode; client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <LazyMotion features={loadMotionFeatures} strict>
        <MotionConfig reducedMotion="user">{children}</MotionConfig>
      </LazyMotion>
    </QueryClientProvider>
  );
}

import { useContext } from 'react';
import { SessionManagerContext, type SessionManagerContextValue } from '@/contexts/SessionManagerContext';

export function useSessionManager(): SessionManagerContextValue {
  const ctx = useContext(SessionManagerContext);
  if (!ctx) {
    throw new Error('useSessionManager must be used within a SessionManagerProvider');
  }
  return ctx;
}

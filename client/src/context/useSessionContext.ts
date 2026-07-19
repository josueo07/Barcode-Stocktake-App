import { createContext, useContext } from 'react';
import type { Socket } from 'socket.io-client';
import type { StocktakeSession } from '@barcode-stocktake/shared';

export interface SessionContextValue {
  session: StocktakeSession;
  refreshSession: () => Promise<void>;
  socket: Socket | null;
}

export const SessionContext = createContext<SessionContextValue | null>(null);

export function useSessionContext(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error('useSessionContext must be used within a SessionLayout route');
  }
  return ctx;
}

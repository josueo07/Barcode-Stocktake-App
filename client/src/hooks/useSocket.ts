import { useEffect, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { SOCKET_EVENTS } from '@barcode-stocktake/shared';
import { config } from '../config';

/** Opens one Socket.io connection for a session and joins its room; shared via SessionContext. */
export function useSocket(sessionId: number | null): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (sessionId === null || Number.isNaN(sessionId)) return undefined;

    const instance = io(config.apiBaseUrl, { transports: ['websocket'] });

    instance.on('connect', () => {
      instance.emit(SOCKET_EVENTS.JOIN_SESSION, sessionId);
    });

    setSocket(instance);

    return () => {
      instance.emit(SOCKET_EVENTS.LEAVE_SESSION, sessionId);
      instance.disconnect();
      setSocket(null);
    };
  }, [sessionId]);

  return socket;
}

import { useCallback, useEffect, useState } from 'react';
import { config } from '../config';

const HEARTBEAT_INTERVAL_MS = 10000;
const HEARTBEAT_TIMEOUT_MS = 3000;

/**
 * Combines the browser's online/offline events (which only reflect the network interface,
 * not whether the PC's server is actually reachable) with a periodic health-check heartbeat.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const checkServerReachable = useCallback(async () => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HEARTBEAT_TIMEOUT_MS);
    try {
      const res = await fetch(`${config.apiBaseUrl}/api/health`, { signal: controller.signal });
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    } finally {
      clearTimeout(timeout);
    }
  }, []);

  useEffect(() => {
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', checkServerReachable);
    window.addEventListener('offline', handleOffline);

    checkServerReachable();
    const interval = setInterval(checkServerReachable, HEARTBEAT_INTERVAL_MS);

    return () => {
      window.removeEventListener('online', checkServerReachable);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkServerReachable]);

  return isOnline;
}

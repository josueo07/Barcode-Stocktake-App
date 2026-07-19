const DEFAULT_API_PORT = 4000;

/**
 * Infers the API base URL from whatever host the page itself was loaded from. This means a
 * phone opening the app at http://192.168.x.x:5173 automatically talks to the API at
 * http://192.168.x.x:4000 with zero per-device configuration. Set VITE_API_URL to override.
 */
function inferApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL as string | undefined;
  if (envUrl) return envUrl;
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
}

export const config = {
  apiBaseUrl: inferApiBaseUrl(),
};

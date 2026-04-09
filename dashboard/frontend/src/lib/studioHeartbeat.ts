/**
 * Studio Heartbeat — keeps the backend idle-timer alive while the Studio
 * tab is open.  Fires a lightweight POST every 2 minutes; stops
 * automatically once the opened window is closed.
 */

const HEARTBEAT_INTERVAL_MS = 2 * 60 * 1000; // 2 minutes

export function startStudioHeartbeat(
  studioWindow: Window,
  tenantName: string,
  apiBaseUrl: string,
  token: string | null
): void {
  const interval = setInterval(() => {
    if (studioWindow.closed) {
      clearInterval(interval);
      return;
    }
    fetch(`${apiBaseUrl}/api/studio/heartbeat/${tenantName}`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {}); // fire-and-forget
  }, HEARTBEAT_INTERVAL_MS);
}

// A restored session cookie alone cannot resume a closed browser session.
// An active document, a live peer tab or an explicit login/company-switch handoff is required.
const HANDOFF = 'nairim.browserSession.handoff';
const CONTINUITY = 'nairim.browserSession.continuity';
let activeUser: string | null = null;
let channel: BroadcastChannel | null = null;
let heartbeat: ReturnType<typeof setInterval> | null = null;
function read(key: string): { user: string; at: number } | null {
  try { return JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { return null; }
}
function remember(user: string) {
  try { sessionStorage.setItem(CONTINUITY, JSON.stringify({ user, at: Date.now() })); } catch { /* Storage may be unavailable. */ }
}
function activate(user: string) {
  activeUser = user; remember(user);
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = setInterval(() => remember(user), 4000);
  if (channel) channel.close();
  if (typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel('nairim.active-browser-session');
  channel.onmessage = event => {
    if (event.data?.type === 'probe' && event.data.user === activeUser) channel?.postMessage({ type: 'alive', user: activeUser, nonce: event.data.nonce });
  };
}
export function beginBrowserSession(user: string) {
  try { sessionStorage.setItem(HANDOFF, JSON.stringify({ user, at: Date.now() })); } catch { /* No persistent credential fallback. */ }
  activate(user);
}
export function endBrowserSession() {
  activeUser = null; channel?.close(); channel = null;
  if (heartbeat) clearInterval(heartbeat); heartbeat = null;
  try { sessionStorage.removeItem(HANDOFF); sessionStorage.removeItem(CONTINUITY); } catch { /* Ignore blocked storage. */ }
}
export async function claimBrowserSession(user: string): Promise<boolean> {
  if (activeUser === user) return true;
  const handoff = read(HANDOFF);
  try { sessionStorage.removeItem(HANDOFF); } catch { /* Ignore blocked storage. */ }
  const continuity = read(CONTINUITY);
  const reload = (performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined)?.type === 'reload';
  if ((handoff?.user === user && Date.now() - handoff.at < 30_000)
    || (reload && continuity?.user === user && Date.now() - continuity.at < 15_000)) { activate(user); return true; }
  if (typeof BroadcastChannel === 'undefined') return false;
  const alive = await new Promise<boolean>(resolve => {
    const probe = new BroadcastChannel('nairim.active-browser-session'); const nonce = crypto.randomUUID();
    const timer = setTimeout(() => { probe.close(); resolve(false); }, 500);
    probe.onmessage = event => {
      if (event.data?.type === 'alive' && event.data.user === user && event.data.nonce === nonce) {
        clearTimeout(timer); probe.close(); resolve(true);
      }
    };
    probe.postMessage({ type: 'probe', user, nonce });
  });
  if (alive) activate(user);
  return alive;
}

const endpoint = 'https://marine-comeback-reminders.vercel.app/api/learning';
const hub = 'https://veribatum.github.io/marine-comeback-fitness/?mission=evening';
const isKey = value => /^[a-f0-9]{64}$/.test(value || '');
const makeKey = () => Array.from(crypto.getRandomValues(new Uint8Array(32)), n => n.toString(16).padStart(2, '0')).join('');

export function connectMarineHub(source, snapshot) {
  const keyName = 'marine_learning_connection_v1:' + source;
  const deviceName = 'marine_learning_device_v1:' + source;
  let active = false, pending = false, lastSent = '', retries = 0, retryTimer;
  const fragment = new URLSearchParams(location.hash.slice(1));
  const incoming = fragment.get('marine-hub');
  if (isKey(incoming)) {
    try { localStorage.setItem(keyName, incoming); } catch {}
    history.replaceState(history.state, '', location.pathname + location.search);
  }

  const panel = document.createElement('div');
  panel.className = 'marine-hub-connection';
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  const back = document.createElement('a');
  back.href = hub;
  back.textContent = 'Marine Comeback';
  const connect = document.createElement('button');
  connect.type = 'button';
  connect.textContent = 'Connect learning progress';
  connect.onclick = () => {
    const key = prompt('Paste your Marine Comeback connection code.')?.trim();
    if (!key) return;
    if (!isKey(key)) { status.textContent = 'Use the code from Marine Comeback → Learn.'; return; }
    try { localStorage.setItem(keyName, key); }
    catch { status.textContent = 'Allow app storage to connect progress.'; return; }
    lastSent = '';
    retries = 0;
    void sync();
  };
  panel.append(back, document.createTextNode(' · '), connect, document.createTextNode(' '), status);
  (document.querySelector('#marine-hub-panel') || document.querySelector('.site-footer') || document.body).append(panel);

  async function sync() {
    let key, device;
    try { key = localStorage.getItem(keyName); device = localStorage.getItem(deviceName); } catch { return; }
    if (!isKey(key)) return;
    if (active) { pending = true; return; }
    const progress = snapshot();
    if (!progress) return;
    const payload = JSON.stringify(progress);
    if (payload === lastSent) return;
    if (!isKey(device)) {
      device = makeKey();
      try { localStorage.setItem(deviceName, device); } catch { return; }
    }
    active = true;
    clearTimeout(retryTimer);
    status.textContent = 'Syncing progress…';
    try {
      const response = await fetch(endpoint, {
        method: 'PUT',
        headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ source, device, ...progress }),
        signal: AbortSignal.timeout(12000)
      });
      if (!response.ok) throw Error('Sync failed');
      lastSent = payload;
      retries = 0;
      status.textContent = 'Progress synced.';
    } catch {
      status.textContent = 'Progress saved here. Sync will retry.';
      if (retries < 3) retryTimer = setTimeout(sync, 2000 * ++retries);
    } finally {
      active = false;
      if (pending) { pending = false; void sync(); }
    }
  }
  window.addEventListener('online', sync);
  window.addEventListener('pageshow', sync);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) void sync(); });
  return sync;
}

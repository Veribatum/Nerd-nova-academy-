const BASE = 'http://127.0.0.1:8765';
export function validVMReceipt(data, attempt) {
  const checks = ['linkUp', 'addressCorrect', 'routePresent', 'peerReachable', 'protectedUnchanged'];
  return !!(attempt && data?.verified === true && data.active === true && data.target === 'nova-academy' &&
    data.mission === 'rhel-link' && data.attempt === attempt && checks.every(k => data.checks?.[k] === true) &&
    typeof data.receipt === 'string' && /^[a-f0-9]{64}$/.test(data.receipt));
}
export class Companion extends EventTarget {
  constructor(fetcher = globalThis.fetch, storage = globalThis.sessionStorage) {
    super(); this.fetcher = fetcher; this.storage = storage; this.info = null; this.vm = null; this.lab = null;
    this.error = ''; this.token = ''; this.attempt = '';
    try { this.token = storage.getItem('nova_lab_token') || ''; } catch {}
  }
  async request(path, method = 'GET', body) {
    const response = await this.fetcher(`${BASE}${path}`, { method, mode: 'cors', cache: 'no-store',
      headers: { ...(this.token && path.startsWith('/lab/') ? { Authorization: `Bearer ${this.token}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(method === 'GET' ? 6000 : 24000) });
    const data = await response.json();
    if (!response.ok) { if (response.status === 401) { this.token = ''; try { this.storage.removeItem('nova_lab_token'); } catch {} }
      throw Error(data.error || `Companion returned HTTP ${response.status}.`); }
    return data;
  }
  async probe() {
    this.error = '';
    try {
      // Keep the working original endpoint compatible with version 1.
      this.vm = await this.request('/vm/status');
      try { this.info = await this.request('/health'); } catch { this.info = { version: 1 }; }
      if (this.token && this.info.version >= 2) {
        try { this.lab = await this.request('/lab/status'); this.attempt = this.lab.attempt || ''; }
        catch (error) { this.error = error.message; }
      }
    } catch { this.vm = null; this.info = null; this.lab = null;
      this.error = 'Start companion/start-companion.bat on Windows, then retry. Allow local-network access if your browser asks.'; }
    this.dispatchEvent(new Event('change')); return this.vm;
  }
  async pair(code) {
    const data = await this.request('/pair', 'POST', { code: code.trim().toLowerCase() });
    if (!data.token || data.target !== 'nova-academy') throw Error('Unexpected pairing response.');
    this.token = data.token; try { this.storage.setItem('nova_lab_token', this.token); } catch {}
    await this.probe();
  }
  async operate(op) {
    if (!['deploy', 'verify', 'reset'].includes(op)) throw Error('Unsupported lab operation.');
    const data = await this.request(`/lab/${op}`, 'POST', { mission: 'rhel-link' });
    if (op === 'deploy') {
      if (!data.deployed || !data.active || data.target !== 'nova-academy' || typeof data.attempt !== 'string') throw Error('The VM did not confirm deployment.');
      this.attempt = data.attempt; this.lab = data;
    }
    if (op === 'reset') { this.attempt = ''; this.lab = null; }
    this.dispatchEvent(new Event('change')); return data;
  }
}

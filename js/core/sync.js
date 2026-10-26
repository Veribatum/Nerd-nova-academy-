import { mergeProgress, normalize } from './progress.js?v=1.1.1';
const utf8 = new TextEncoder();
const text = new TextDecoder();
const base64 = bytes => { let s = ''; for (const b of bytes) s += String.fromCharCode(b); return btoa(s); };
const unbase64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
const AUTH_KEY = 'nerdnova_cloud_auth';
const CONFIG_KEY = 'nerdnova_cloud_config';
async function derive(passphrase, salt) {
  const material = await crypto.subtle.importKey('raw', utf8.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function seal(data, passphrase) {
  if (!globalThis.crypto?.subtle) throw Error('Encrypted cloud saving requires HTTPS. Open the published Academy site.');
  const salt = crypto.getRandomValues(new Uint8Array(16)); const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await derive(passphrase, salt);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, utf8.encode(JSON.stringify(data)));
  return { format: 'NNAV1', salt: base64(salt), iv: base64(iv), ciphertext: base64(new Uint8Array(cipher)) };
}
export async function open(envelope, passphrase) {
  if (envelope?.format !== 'NNAV1' || typeof envelope.ciphertext !== 'string' || envelope.ciphertext.length > 4_000_000) throw Error('Unrecognized cloud save. No data was overwritten.');
  try {
    const key = await derive(passphrase, unbase64(envelope.salt));
    const bytes = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unbase64(envelope.iv) }, key, unbase64(envelope.ciphertext));
    return JSON.parse(text.decode(bytes));
  } catch { throw Error('The vault passphrase does not match, or the encrypted save is damaged. Nothing was overwritten.'); }
}
export function validateRepo(repo) {
  if (!/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(repo)) throw Error('Use owner/private-repository, for example Veribatum/nova-academy-save.');
  return repo;
}
export class CloudSync extends EventTarget {
  constructor(store, fetcher = globalThis.fetch, storage = globalThis.localStorage) {
    super(); this.store = store; this.fetcher = fetcher; this.storage = storage;
    this.session = null; this.status = 'Offline save'; this.lastSuccess = ''; this.timer = null; this.busy = null;
    this.config = null;
    try { this.config = JSON.parse(storage.getItem(CONFIG_KEY) || 'null'); } catch {}
    store.addEventListener('change', () => { if (this.session && !this.merging) this.schedule(); });
  }
  setStatus(value) { this.status = value; this.dispatchEvent(new Event('status')); }
  async api(path, options = {}, session = this.session) {
    const response = await this.fetcher(`https://api.github.com${path}`, { ...options,
      headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${session.token}`,
        'X-GitHub-Api-Version': '2022-11-28', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      signal: AbortSignal.timeout(20000), cache: 'no-store' });
    if (response.status === 404 && options.allowMissing) return null;
    if (!response.ok) { const error = Error(response.status === 401 ? 'GitHub token expired or invalid. Reconnect your save.' :
      response.status === 403 ? 'GitHub denied access. Check the token’s Contents permission and expiration.' : `Cloud save returned HTTP ${response.status}. Local progress is safe.`); error.status = response.status; throw error; }
    return response.json();
  }
  async connect(repo, token, passphrase, remember = true) {
    validateRepo(repo);
    if (passphrase.length < 12) throw Error('Choose a vault passphrase with at least 12 characters. Use the same phrase on both devices.');
    if (!token.trim()) throw Error('Enter a fine-grained GitHub token limited to your private save repository.');
    const session = { repo, token: token.trim(), passphrase };
    this.setStatus('Connecting…');
    try {
      const metadata = await this.api(`/repos/${repo}`, {}, session);
      if (!metadata.private) throw Error('Choose a private save repository. Progress will not be written into the public game repository.');
      session.branch = metadata.default_branch || 'main';
      const remote = await this.readRemote(session);
      if (remote) { const decrypted = normalize(await open(remote.envelope, passphrase)); this.merging = true;
        try { this.store.merge(decrypted); } finally { this.merging = false; } }
      this.session = session;
      this.config = { repo, lastSuccess: this.config?.lastSuccess || '' };
      this.storage.setItem(CONFIG_KEY, JSON.stringify(this.config));
      if (remember) this.storage.setItem(AUTH_KEY, JSON.stringify(await seal({ repo, token: session.token }, passphrase)));
      else this.storage.removeItem(AUTH_KEY);
      await this.synchronize();
    } catch (error) { this.session = null; this.setStatus('Connection needs attention'); throw error; }
  }
  async unlock(passphrase) {
    const saved = this.storage.getItem(AUTH_KEY);
    if (!saved) throw Error('Connect this device using its GitHub token first.');
    const auth = await open(JSON.parse(saved), passphrase);
    return this.connect(auth.repo, auth.token, passphrase, true);
  }
  hasRememberedAuth() { return !!this.storage.getItem(AUTH_KEY); }
  path(session = this.session) { return `/repos/${session.repo}/contents/academy/progress.enc.json`; }
  async readRemote(session = this.session) {
    const file = await this.api(this.path(session), { allowMissing: true }, session);
    if (!file) return null;
    if (file.type !== 'file' || file.size > 3_000_000 || typeof file.sha !== 'string') throw Error('Cloud save file is unavailable. Local progress is safe.');
    // GitHub omits inline Contents API bytes for files over 1 MiB.
    const blob = file.content ? file : await this.api(`/repos/${session.repo}/git/blobs/${file.sha}`, {}, session);
    if (!blob.content || (blob.encoding && blob.encoding !== 'base64')) throw Error('The encrypted cloud bytes could not be read. Local progress is safe.');
    return { sha: file.sha, envelope: JSON.parse(text.decode(unbase64(blob.content.replace(/\s/g, '')))) };
  }
  schedule() { clearTimeout(this.timer); this.setStatus('Save queued'); this.timer = setTimeout(() => this.synchronize().catch(() => {}), 1800); }
  async synchronize() {
    if (!this.session) return;
    if (this.busy) { this.again = true; return this.busy; }
    this.busy = this.performSync();
    try { await this.busy; }
    catch (error) { this.setStatus(error.message); throw error; }
    finally { this.busy = null; if (this.again && this.session) { this.again = false; this.schedule(); } }
  }
  async performSync() {
    this.setStatus('Synchronizing…');
    const session = this.session;
    for (let attempt = 0; attempt < 3; attempt++) {
      const remote = await this.readRemote(session);
      let merged = normalize(this.store.data); let remoteProgress = null;
      if (remote) { remoteProgress = normalize(await open(remote.envelope, session.passphrase)); merged = mergeProgress(merged, remoteProgress); }
      this.merging = true; try { this.store.merge(merged); } finally { this.merging = false; }
      if (this.session !== session) return;
      // Focus changes do not create commits when both copies already agree.
      if (remoteProgress && canonical(remoteProgress) === canonical(merged)) {
        this.markCurrent(session); return;
      }
      const envelope = await seal(merged, session.passphrase);
      if (this.session !== session) return;
      try {
        await this.api(this.path(session), { method: 'PUT', body: JSON.stringify({ message: 'Back up Academy progress',
          content: base64(utf8.encode(JSON.stringify(envelope))), ...(remote ? { sha: remote.sha } : {}), branch: session.branch }) }, session);
        this.markCurrent(session); return;
      } catch (error) { if (![409, 422].includes(error.status) || attempt === 2) throw error; }
    }
  }
  markCurrent(session) {
    this.lastSuccess = new Date().toISOString(); this.config = { repo: session.repo, lastSuccess: this.lastSuccess };
    this.storage.setItem(CONFIG_KEY, JSON.stringify(this.config)); this.setStatus('Cloud save current');
  }
  lock() { clearTimeout(this.timer); this.session = null; this.setStatus('Cloud vault locked'); }
  forget() { this.lock(); this.storage.removeItem(AUTH_KEY); this.storage.removeItem(CONFIG_KEY); this.config = null; }
}
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

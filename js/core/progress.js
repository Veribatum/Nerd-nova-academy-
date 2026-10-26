export const SAVE_KEY = 'nerdnova_v3';
const LEGACY_KEYS = ['nerdnova_v2', 'nerdnova_v1_progress'];
const SCHEMA = 3;
const strings = value => Array.isArray(value) ? [...new Set(value.filter(v => typeof v === 'string' && v.length < 160))].sort() : [];
const number = value => Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
const now = () => new Date().toISOString();
function newId() {
  if (globalThis.crypto.randomUUID) return globalThis.crypto.randomUUID();
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = [...bytes].map(v => v.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function normalize(raw = {}) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('This is not an Academy save.');
  if (raw.schema > SCHEMA) throw Error('This save needs a newer version of Academy. Your original is preserved.');
  const legacy = raw.schema !== SCHEMA;
  const rewards = {};
  for (const [id, event] of Object.entries(raw.rewards || {})) {
    if (!event || typeof event !== 'object' || id.length > 180) continue;
    rewards[id] = { ...event, xp: number(event.xp), skills: strings(event.skills) };
  }
  const attempts = {};
  const sourceAttempts = Array.isArray(raw.attempts) ? raw.attempts : Object.values(raw.attempts || {});
  for (const item of sourceAttempts) if (item && typeof item.id === 'string') attempts[item.id] = item;
  if (legacy && !('xp' in raw) && !('completed' in raw) && Object.keys(raw).length) throw Error('This file is not an Academy save.');
  return { schema: SCHEMA, legacyBaseXp: legacy ? number(raw.xp) : number(raw.legacyBaseXp),
    legacyCompleted: strings(legacy ? raw.completed : raw.legacyCompleted),
    completed: strings(raw.completed), medals: strings(raw.medals), rewards, attempts,
    history: Array.isArray(raw.history) ? raw.history.filter(v => v && typeof v === 'object') : [],
    current: raw.current && typeof raw.current === 'object' ? raw.current : null,
    updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : '',
    preferences: raw.preferences && typeof raw.preferences === 'object' ? raw.preferences : {} };
}
export function mergeProgress(a, b) {
  a = normalize(a); b = normalize(b);
  const rewards = { ...a.rewards };
  for (const [id, event] of Object.entries(b.rewards)) {
    // Completion rewards have stable IDs. Merge cannot award the same mission twice.
    if (!rewards[id] || event.xp > rewards[id].xp) rewards[id] = event;
  }
  const attempts = { ...a.attempts };
  for (const [id, item] of Object.entries(b.attempts)) {
    if (!attempts[id] || (item.updatedAt || '') > (attempts[id].updatedAt || '')) attempts[id] = item;
  }
  const history = new Map([...a.history, ...b.history].map(v => [JSON.stringify(v), v]));
  const current = (a.current?.updatedAt || '') >= (b.current?.updatedAt || '') ? a.current : b.current;
  return normalize({ schema: SCHEMA, legacyBaseXp: Math.max(a.legacyBaseXp, b.legacyBaseXp),
    legacyCompleted: strings([...a.legacyCompleted, ...b.legacyCompleted]),
    completed: strings([...a.completed, ...b.completed]), medals: strings([...a.medals, ...b.medals]),
    rewards, attempts, history: [...history.values()], current,
    updatedAt: a.updatedAt > b.updatedAt ? a.updatedAt : b.updatedAt,
    preferences: { ...(a.updatedAt > b.updatedAt ? b.preferences : a.preferences), ...(a.updatedAt > b.updatedAt ? a.preferences : b.preferences) } });
}
export function xpTotal(progress) { return number(progress.legacyBaseXp) + Object.values(progress.rewards).reduce((n, v) => n + number(v.xp), 0); }
export function achievements(progress) {
  const earned = new Set(progress.medals);
  const events = Object.values(progress.rewards);
  if (progress.completed.length) earned.add('FIRST CONTACT');
  if (progress.completed.length >= 3) earned.add('T.I.T.S.');
  if (events.some(e => e.mode === 'vm')) earned.add('TRUST BUT VERIFY');
  if (events.some(e => e.noHints)) earned.add('COOL HEAD');
  if (events.some(e => e.skills.includes('Packets')) && events.some(e => e.skills.includes('Switching'))) earned.add('WIRE WHISPERER');
  if (new Set(events.flatMap(e => e.skills)).size >= 5) earned.add('ALL HANDS');
  if (['nova-wifi', 'sylvanas-wifi', 'samus-wifi', 'jenny-wifi'].every(id => progress.completed.includes(id))) earned.add('CREW CONNECTION');
  return [...earned];
}
export class ProgressStore extends EventTarget {
  constructor(storage = globalThis.localStorage) {
    super(); this.storage = storage; this.warning = ''; this.data = normalize();
    let found = false;
    for (const key of [SAVE_KEY, ...LEGACY_KEYS]) {
      try {
        const text = storage.getItem(key);
        if (text) { this.data = mergeProgress(this.data, JSON.parse(text)); found = true; }
      } catch (error) { this.warning = `A saved record could not be read (${key}). Its original has been retained. Use Backups to recover it.`; }
    }
    if (found) { if (this.warning) this.backup(); this.persist(false); }
  }
  backup() {
    try {
      const old = this.storage.getItem(SAVE_KEY);
      if (!old) return;
      const backups = JSON.parse(this.storage.getItem('nerdnova_backups') || '[]');
      if (backups[0]?.data === old) return;
      backups.unshift({ at: now(), data: old });
      this.storage.setItem('nerdnova_backups', JSON.stringify(backups.slice(0, 8)));
    } catch { this.warning = 'Local backup storage is full. Download a backup in Service record.'; }
  }
  persist(withBackup = true) {
    try {
      if (withBackup) this.backup();
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
    } catch { this.warning = 'Browser storage is unavailable. Keep this tab open and export a backup.'; }
    this.dispatchEvent(new Event('change'));
  }
  update(fn) {
    const next = structuredClone(this.data); fn(next); next.updatedAt = now();
    next.medals = achievements(next); this.data = normalize(next); this.persist();
  }
  merge(raw) { this.data = mergeProgress(this.data, raw); this.persist(); }
  start(mission, mode, snapshot = null) {
    const id = newId();
    this.update(p => {
      p.attempts[id] = { id, mission, mode, startedAt: now(), updatedAt: now(), outcome: 'active', hints: 0, changes: 0, snapshot };
      p.current = { attempt: id, mission, mode, snapshot, updatedAt: now() };
    }); return id;
  }
  checkpoint(id, snapshot, updates = {}) {
    this.update(p => {
      if (p.attempts[id]) {
        Object.assign(p.attempts[id], updates, { updatedAt: now(), snapshot });
        p.current = { attempt: id, mission: p.attempts[id].mission, mode: p.attempts[id].mode, snapshot, updatedAt: now() };
      }
    });
  }
  finish(id, mission, mode, reward, skills, evidence, noHints, newPhotos = []) {
    let awarded = 0;
    this.update(p => {
      const key = `${mission}:${mode}`;
      if (!p.rewards[key]) {
        awarded = mode === 'sim' && p.legacyCompleted.includes(mission) ? 0 : reward;
        p.rewards[key] = { mission, mode, xp: awarded, skills, at: now(), noHints, evidence };
      }
      p.completed = strings([...p.completed, mission]);
      if (p.attempts[id]) { Object.assign(p.attempts[id], { outcome: 'success', evidence, xpAwarded: awarded, newPhotos, updatedAt: now() }); delete p.attempts[id].snapshot; }
      if (p.current?.attempt === id) p.current = { ...p.current, finished: true, updatedAt: now() };
    }); return awarded;
  }
  abandon(id) {
    this.update(p => { if (p.attempts[id]) Object.assign(p.attempts[id], { outcome: 'reset', updatedAt: now() });
      if (p.current?.attempt === id) p.current = { ...p.current, finished: true, updatedAt: now() }; });
  }
  export() { return JSON.stringify(this.data, null, 2); }
  import(text) {
    if (text.length > 3_000_000) throw Error('Save file is too large.');
    let raw;
    try { raw = JSON.parse(text); }
    catch { try { raw = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(text.trim()), c => c.charCodeAt(0)))); }
      catch { throw Error('Paste a complete Academy save code or select an Academy JSON backup.'); } }
    this.backup(); this.merge(normalize(raw));
  }
  backups() { try { return JSON.parse(this.storage.getItem('nerdnova_backups') || '[]'); } catch { return []; } }
}

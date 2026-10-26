import { ProgressStore, xpTotal } from './core/progress.js?v=1.1.1';
import { CloudSync } from './core/sync.js?v=1.1.1';
import { Companion, validVMReceipt } from './lab/companion.js?v=1.1.1';
import { MISSIONS, missionById, GALLERY } from './data/missions.js?v=1.1.1';
import { CREW, crewById, photoUnlocked } from './data/crew.js?v=1.1.1';
import { createSimulation, restoreSimulation, runCommand, verifySimulation, applyCamera } from './sim/engine.js?v=1.1.1';
import { createPcap } from './sim/pcap.js?v=1.1.1';
import * as screens from './ui/screens.js?v=1.1.1';
import { h, icon, download, dateLabel } from './ui/utils.js?v=1.1.1';

const $ = id => document.getElementById(id);
const store = new ProgressStore();
const sync = new CloudSync(store);
const companion = new Companion();
const ctx = { store, sync, companion, active: null, busy: false,
  ui: { page: 'watch', mission: '', filter: 'ALL', manualSearch: '', tool: 'terminal', node: 'control',
    packet: 0, packetFilter: '', checks: null, awarded: null, dialog: '', photo: 0, crew: null, galleryCrew: 'all' } };
let commandHistory = []; let historyPosition = 0; let toastTimer;
const nav = [['watch', 'Watchdesk', 'compass'], ['operations', 'Operations', 'orders'], ['manual', 'Field manual', 'book'], ['crew', 'The crew', 'radio'], ['record', 'Service record', 'shield']];

function toast(message) { $('toast').textContent = message; $('toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => { $('toast').classList.remove('visible'); $('toast').textContent = ''; }, 5000); }
function shell() {
  const page = ['briefing', 'mission', 'debrief'].includes(ctx.ui.page) ? 'operations' : ctx.ui.page === 'morale' ? 'crew' : ctx.ui.page;
  $('navigation').innerHTML = nav.map(([id, label, glyph]) => `<a href="#/${id}" class="${id === page ? 'active' : ''}" ${id === page ? 'aria-current="page"' : ''}>${icon(glyph, 19)}<span>${label}</span></a>`).join('');
  updateSaveBeacon();
  const warning = $('storage-warning'); warning.hidden = !store.warning; warning.textContent = store.warning;
}
function updateSaveBeacon() {
  const label = sync.session ? (sync.status === 'Cloud save current' ? 'CLOUD CURRENT' : 'SAVE SYNC') : sync.config ? 'VAULT LOCKED' : 'LOCAL SAVE';
  $('save-beacon').innerHTML = `${icon(sync.session ? 'cloud' : sync.config ? 'lock' : 'shield', 21)}<span><strong>${label}</strong>${sync.config?.repo ? h(sync.config.repo.split('/')[1]) : 'Connect cross-device'}</span>`;
  $('save-beacon').setAttribute('aria-label', `${sync.status}. Open save connection.`);
}
function serializeActive() { return ctx.active.mode === 'sim' ? ctx.active.snapshot : { version: 1, remoteAttempt: ctx.active.remoteAttempt, hints: ctx.active.hints || 0, notes: ctx.active.notes || '' }; }
function checkpoint(updates = {}) { if (ctx.active) store.checkpoint(ctx.active.attempt, serializeActive(), updates); }
function loadActive(id) {
  let current = store.data.current;
  if (!current || current.mission !== id) {
    const previous = Object.values(store.data.attempts).filter(a => a.mission === id && a.snapshot && a.outcome !== 'reset').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
    if (!previous) return null;
    current = { mission: previous.mission, mode: previous.mode, attempt: previous.id, snapshot: previous.snapshot, finished: previous.outcome === 'success' };
  }
  try {
    return { attempt: current.attempt, mission: id, mode: current.mode, finished: !!current.finished,
      ...(current.mode === 'sim' ? { snapshot: restoreSimulation(current.snapshot) } : { snapshot: null, ...current.snapshot }) };
  } catch (e) { toast(e.message); return null; }
}
function render() {
  shell(); const m = missionById(ctx.ui.mission);
  let html;
  switch (ctx.ui.page) {
    case 'operations': html = screens.operations(ctx); break;
    case 'briefing': html = screens.briefing(ctx, m || MISSIONS[0]); break;
    case 'mission': html = ctx.active ? screens.workstation(ctx, m || MISSIONS[0]) : screens.briefing(ctx, m || MISSIONS[0]); break;
    case 'debrief': html = ctx.active ? screens.debrief(ctx, m || MISSIONS[0]) : screens.record(ctx); break;
    case 'manual': html = screens.manual(ctx); break;
    case 'morale': html = screens.morale(ctx); break;
    case 'crew': html = screens.crew(ctx, crewById(ctx.ui.crew)); break;
    case 'record': html = screens.record(ctx); break;
    default: html = screens.watchdesk(ctx);
  }
  $('main').innerHTML = html;
  const terminal = $('terminal-output'); if (terminal) terminal.scrollTop = terminal.scrollHeight;
}
function route() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const page = parts[0] || 'watch'; const mission = missionById(parts[1]);
  ctx.ui.page = ['watch', 'operations', 'briefing', 'mission', 'debrief', 'manual', 'morale', 'crew', 'record'].includes(page) ? page : 'watch';
  ctx.ui.crew = page === 'crew' ? crewById(parts[1])?.id : null;
  ctx.ui.mission = mission?.id || '';
  if (['mission', 'debrief'].includes(ctx.ui.page)) {
    if (!ctx.active || ctx.active.mission !== mission?.id) ctx.active = mission ? loadActive(mission.id) : null;
    if (!ctx.active) ctx.ui.page = mission ? 'briefing' : 'watch';
    else if (ctx.active.finished && ctx.ui.page === 'mission') ctx.ui.page = 'debrief';
    ctx.ui.tool = ctx.active?.mode === 'vm' ? 'live' : ctx.ui.tool === 'live' ? 'terminal' : ctx.ui.tool;
  }
  ctx.ui.checks = null; render(); window.scrollTo({ top: 0, behavior: 'instant' });
  $('main').focus({ preventScroll: true });
}
function go(path) { if (location.hash === `#/${path}`) route(); else location.hash = `/${path}`; }
function showDialog(kind) {
  ctx.ui.dialog = kind; $('dialog').classList.remove('photo-dialog');
  let html = '';
  if (kind === 'lab') html = screens.labDialog(ctx);
  if (kind === 'sync') html = screens.syncDialog(ctx);
  if (kind === 'import') html = `<div class="eyebrow">BACKUP / NONDESTRUCTIVE MERGE</div><h2>Bring your record aboard.</h2><p>Choose a JSON backup or paste an earlier Academy save code. Existing achievements and higher legacy XP are retained.</p><form id="import-form"><label>Academy backup file<input id="backup-file" name="backup" type="file" accept=".json,application/json,text/plain"></label><label>Or paste a save code<textarea name="save" id="import-text" rows="5" placeholder="Legacy code or Academy JSON"></textarea></label><button class="button primary">Merge progress</button></form>`;
  if (kind === 'backups') {
    const backups = store.backups();
    html = `<div class="eyebrow">RECOVERY / LAST EIGHT LOCAL CHECKPOINTS</div><h2>Your safety copies.</h2><p>Restoring merges valid progress. Download any entry to retain its original bytes.</p><div class="backup-list">${backups.length ? backups.map((b, i) => `<div><span>${dateLabel(b.at)}</span><button class="button ghost" data-action="restore-backup" data-index="${i}">Merge</button><button class="text-link" data-action="download-backup" data-index="${i}">${icon('download', 17)} Download</button></div>`).join('') : '<p>No automatic backups yet. An earlier copy is retained whenever your saved record changes.</p>'}</div>`;
  }
  if (kind === 'photo') {
    const unlocked = GALLERY.filter(g => photoUnlocked(g, store.data));
    const photo = unlocked[ctx.ui.photo]; if (!photo) return;
    $('dialog').classList.add('photo-dialog');
    const owner = crewById(photo.crew);
    html = `<div class="eyebrow">${owner.name.toUpperCase()} / PRIVATE PHOTO ${ctx.ui.photo + 1} OF ${unlocked.length}</div><h2>${h(photo.title)}</h2><img class="full-photo" src="${photo.file}" alt="${owner.name} — ${h(photo.title)}"><div class="photo-navigation"><button class="button ghost" data-action="photo-prev" aria-label="Previous photo">${icon('back', 18)}</button><p>${h(photo.caption)}</p><button class="button ghost" data-action="photo-next" aria-label="Next photo">${icon('arrow', 18)}</button></div>`;
  }
  $('dialog-content').innerHTML = html; $('dialog-error').hidden = true;
  if (!$('dialog').open) $('dialog').showModal();
}
function closeDialog() { $('dialog').close(); ctx.ui.dialog = ''; }
function dialogError(message) { $('dialog-error').textContent = message; $('dialog-error').hidden = false; }
async function busy(task, inDialog = false) {
  if (ctx.busy) return;
  ctx.busy = true;
  if (inDialog && ctx.ui.dialog) {
    $('dialog-content').querySelectorAll('button[type="submit"],form button,.button').forEach(b => { b.disabled = true; });
  } else render();
  try { await task(); }
  catch (error) { if (inDialog && $('dialog').open) dialogError(error.message); else toast(error.message || 'The operation could not complete. Your progress is retained.'); }
  finally { ctx.busy = false;
    if (inDialog && $('dialog').open) $('dialog-content').querySelectorAll('button').forEach(b => { b.disabled = false; });
    else render();
  }
}
function startSimulation(m) {
  const current = store.data.current;
  if (current?.mission === m.id && current.mode === 'sim' && !current.finished) {
    ctx.active = loadActive(m.id); if (ctx.active) { ctx.ui.tool = 'terminal'; go(`mission/${m.id}`); return; }
  }
  const snapshot = createSimulation(m.id); const id = store.start(m.id, 'sim', snapshot);
  ctx.active = { attempt: id, mission: m.id, mode: 'sim', snapshot, finished: false };
  ctx.ui.checks = null; ctx.ui.awarded = null; ctx.ui.tool = 'terminal'; ctx.ui.node = 'control';
  go(`mission/${m.id}`);
}
async function startVM(m) {
  if (!companion.token || !companion.lab?.installed) { showDialog('lab'); return; }
  await busy(async () => {
    const deployment = await companion.operate('deploy');
    const current = store.data.current;
    if (current?.mission === m.id && current.mode === 'vm' && current.snapshot?.remoteAttempt === deployment.attempt && !current.finished) ctx.active = loadActive(m.id);
    else {
      const snapshot = { version: 1, remoteAttempt: deployment.attempt, hints: 0, notes: '' };
      const id = store.start(m.id, 'vm', snapshot);
      ctx.active = { attempt: id, mission: m.id, mode: 'vm', snapshot: null, ...snapshot, finished: false };
    }
    ctx.ui.checks = null; ctx.ui.awarded = null; ctx.ui.tool = 'live'; closeDialog(); go(`mission/${m.id}`);
    toast(deployment.resumed ? 'Existing isolated lab resumed.' : 'Isolated training fault deployed on nova-academy.');
  });
}
async function verify() {
  if (!ctx.active || ctx.active.finished) return;
  const active = ctx.active; const mission = missionById(active.mission);
  await busy(async () => {
    let passed, evidence, checks;
    if (active.mode === 'sim') {
      const result = verifySimulation(active.snapshot); active.snapshot = result.state;
      ({ passed, evidence, checks } = result); checkpoint();
    } else {
      const result = await companion.operate('verify');
      const labels = { linkUp: 'Training link administratively UP', addressCorrect: 'Approved 192.0.2.10/30 address', routePresent: 'Connected peer route present', peerReachable: 'Three real peer replies', protectedUnchanged: 'Management networking unchanged' };
      checks = Object.entries(labels).map(([key, label]) => [label, result.checks?.[key] === true]);
      passed = validVMReceipt(result, active.remoteAttempt);
      if (result.attempt !== active.remoteAttempt) throw Error('The deployed VM attempt changed. Reopen the real mission to resume the current deployment.');
      evidence = result;
    }
    ctx.ui.checks = checks;
    if (!passed) { checkpoint({ outcome: 'active', lastCheckAt: new Date().toISOString() }); toast('Verification found an unresolved condition. Review the evidence.'); return; }
    const hints = active.mode === 'sim' ? active.snapshot.hints : active.hints;
    const anticipated = { ...store.data, completed: [...new Set([...store.data.completed, mission.id])] };
    const newPhotos = GALLERY.filter(g => photoUnlocked(g, anticipated) && !photoUnlocked(g, store.data)).map(g => g.id);
    const earned = store.finish(active.attempt, mission.id, active.mode, active.mode === 'vm' ? mission.vmXp : mission.xp, mission.skills, evidence, hints === 0, newPhotos);
    active.finished = true; ctx.ui.awarded = earned; go(`debrief/${mission.id}`); toast('Repair verified. Your service record is saved.');
    // Hash navigation clears transient checks; the AAR also reads saved evidence.
  });
}
async function resetMission() {
  const active = ctx.active; if (!active) return;
  if (active.mode === 'vm') {
    await busy(async () => { await companion.operate('reset'); store.abandon(active.attempt); ctx.active = null; go(`briefing/${active.mission}`); toast('Owned training namespaces removed. Management connection retained.'); });
  } else {
    store.abandon(active.attempt); ctx.active = null;
    startSimulation(missionById(active.mission)); toast('Fresh fault deployed. Earlier attempt retained in your watch log.');
  }
}
async function cleanupVM() {
  await busy(async () => { await companion.operate('reset');
    const current = store.data.current;
    if (current?.mode === 'vm' && !current.finished) { store.abandon(current.attempt); if (ctx.active?.mode === 'vm') ctx.active = null; }
    closeDialog(); if (ctx.ui.page === 'mission' && !ctx.active) go('watch'); toast('Isolated lab cleaned up.');
  });
}
document.addEventListener('click', async event => {
  const closeLink = event.target.closest('[data-close-dialog]'); if (closeLink) closeDialog();
  const b = event.target.closest('button[data-action]'); if (!b || b.disabled) return;
  const action = b.dataset.action;
  try {
    if (action === 'sync-dialog') return showDialog('sync');
    if (action === 'lab-dialog') return showDialog('lab');
    if (action === 'close-dialog') return closeDialog();
    if (action === 'import-dialog') return showDialog('import');
    if (action === 'backup-dialog') return showDialog('backups');
    if (action === 'deploy-sim') return startSimulation(missionById(b.dataset.mission));
    if (action === 'deploy-vm') return startVM(missionById(b.dataset.mission));
    if (action === 'filter') { ctx.ui.filter = b.dataset.value; return render(); }
    if (action === 'gallery-filter') { ctx.ui.galleryCrew = CREW.some(c => c.id === b.dataset.crew) ? b.dataset.crew : 'all'; return render(); }
    if (action === 'tool') { ctx.ui.tool = b.dataset.tool; render(); if (ctx.ui.tool === 'terminal') $('command-input')?.focus({ preventScroll: true }); return; }
    if (action === 'inspect') { ctx.ui.node = b.dataset.node; if (ctx.active?.snapshot) { const s = ctx.active.snapshot; if (!s.inspected.includes('topology')) s.inspected.push('topology'); checkpoint(); } return render(); }
    if (action === 'packet') { ctx.ui.packet = Number(b.dataset.packet); const s = ctx.active?.snapshot;
      if (s && !s.inspected.includes('packets')) { s.inspected.push('packets'); checkpoint(); } return render(); }
    if (action === 'insert-command') { $('command-input').value = b.dataset.command; $('command-input').focus(); return; }
    if (action === 'hint') { if (ctx.active?.mode === 'sim') ctx.active.snapshot.hints = Math.min(3, ctx.active.snapshot.hints + 1);
      else if (ctx.active) ctx.active.hints = Math.min(3, (ctx.active.hints || 0) + 1); checkpoint(); return render(); }
    if (action === 'verify') return verify();
    if (action === 'reset-mission') return resetMission();
    if (action === 'cleanup-vm') return cleanupVM();
    if (action === 'download-pcap') { download(`nova-${ctx.active.mission}-${ctx.active.snapshot.cameraPort}.pcap`, createPcap(ctx.active.snapshot.cameraPort), 'application/vnd.tcpdump.pcap'); return toast('Synthetic PCAP downloaded. Open it in Wireshark.'); }
    if (action === 'copy-ssh') { await navigator.clipboard.writeText('ssh -p 2224 jamean@127.0.0.1'); return toast('SSH command copied. Paste it in PowerShell.'); }
    if (action === 'probe') return busy(async () => { await companion.probe(); showDialog('lab'); }, true);
    if (action === 'export') return download(`Nerd-Nova-Academy-${new Date().toISOString().slice(0, 10)}.json`, store.export());
    if (action === 'restore-backup') { const backup = store.backups()[Number(b.dataset.index)]; store.import(backup.data); closeDialog(); render(); return toast('Backup merged. Existing progress retained.'); }
    if (action === 'download-backup') { const backup = store.backups()[Number(b.dataset.index)]; return download(`Academy-backup-${Number(b.dataset.index) + 1}.json`, backup.data); }
    if (action === 'sync-now') return busy(async () => { await sync.synchronize(); showDialog('sync'); }, true);
    if (action === 'lock-cloud') { sync.lock(); return showDialog('sync'); }
    if (action === 'forget-cloud') { sync.forget(); return showDialog('sync'); }
    if (action === 'open-photo') { const unlocked = GALLERY.filter(g => photoUnlocked(g, store.data)); ctx.ui.photo = unlocked.findIndex(g => g.id === b.dataset.photo); return showDialog('photo'); }
    if (action === 'photo-prev' || action === 'photo-next') { const count = GALLERY.filter(g => photoUnlocked(g, store.data)).length;
      if (count) ctx.ui.photo = (ctx.ui.photo + (action === 'photo-next' ? 1 : -1) + count) % count; return showDialog('photo'); }
  } catch (e) { if ($('dialog').open) dialogError(e.message); else toast(e.message); }
});
document.addEventListener('submit', async event => {
  const form = event.target; event.preventDefault();
  if (ctx.busy) return;
  const data = new FormData(form);
  try {
    if (form.id === 'command-form') {
      const raw = String(data.get('command') || '').trim(); if (!raw || ctx.active?.mode !== 'sim') return;
      commandHistory.push(raw); historyPosition = commandHistory.length;
      ctx.active.snapshot = runCommand(ctx.active.snapshot, raw); ctx.ui.checks = null;
      checkpoint({ changes: ctx.active.snapshot.changes, hints: ctx.active.snapshot.hints });
      render(); $('command-input')?.focus({ preventScroll: true }); return;
    }
    if (form.id === 'packet-filter-form') { ctx.ui.packetFilter = $('packet-filter').value; return render(); }
    if (form.id === 'camera-form') { ctx.active.snapshot = applyCamera(ctx.active.snapshot, Number(data.get('port')), String(data.get('vlan')));
      ctx.ui.checks = null; checkpoint({ changes: ctx.active.snapshot.changes }); render(); return toast('Camera configuration applied. Verify the result.'); }
    if (form.id === 'manual-search-form') { ctx.ui.manualSearch = $('manual-search').value; return render(); }
    if (form.id === 'pair-form') { const code = String(data.get('code')); return busy(async () => { await companion.pair(code); showDialog('lab'); }, true); }
    if (form.id === 'cloud-connect-form') {
      const repo = String(data.get('repo')).trim(), token = String(data.get('token')), passphrase = String(data.get('passphrase')), remember = data.get('remember') === 'on';
      return busy(async () => { await sync.connect(repo, token, passphrase, remember); showDialog('sync'); render(); toast('Encrypted cloud save connected. Progress merged.'); }, true);
    }
    if (form.id === 'unlock-form') return busy(async () => { await sync.unlock(String(data.get('passphrase'))); showDialog('sync'); render(); }, true);
    if (form.id === 'import-form') {
      const file = $('backup-file').files[0]; if (file && file.size > 3_000_000) throw Error('Choose an Academy backup smaller than 3 MB.');
      const input = file ? await file.text() : String(data.get('save') || ''); store.import(input);
      closeDialog(); ctx.active = null; go('record'); render(); return toast('Record merged. Your achievements are retained.');
    }
  } catch (e) { if ($('dialog').open) dialogError(e.message); else toast(e.message); }
});
document.addEventListener('change', event => {
  if (event.target.id === 'watch-notes' && ctx.active) {
    const value = event.target.value.slice(0, 12000);
    if (ctx.active.mode === 'sim') ctx.active.snapshot.notes = value; else ctx.active.notes = value; checkpoint();
  }
});
document.addEventListener('keydown', event => {
  if (event.target.id !== 'command-input') return;
  if (['ArrowUp', 'ArrowDown'].includes(event.key)) { event.preventDefault(); historyPosition = Math.max(0, Math.min(commandHistory.length, historyPosition + (event.key === 'ArrowUp' ? -1 : 1))); event.target.value = commandHistory[historyPosition] || ''; }
});
$('dialog').addEventListener('close', () => { ctx.ui.dialog = ''; });
window.addEventListener('hashchange', route);
store.addEventListener('change', () => { updateSaveBeacon(); const warning = $('storage-warning'); warning.hidden = !store.warning; warning.textContent = store.warning; });
sync.addEventListener('status', updateSaveBeacon);
window.addEventListener('online', () => sync.synchronize().catch(() => {}));
document.addEventListener('visibilitychange', () => { if (!document.hidden) sync.synchronize().catch(() => {}); });
window.addEventListener('storage', event => {
  if (event.key === 'nerdnova_v3' && event.newValue) {
    try { const incoming = JSON.parse(event.newValue); store.data = (awaitImportMerge(store.data, incoming));
      // In-memory merge only. Writing here would create a cross-tab ping-pong.
      updateSaveBeacon(); if (!ctx.active && !$('dialog').open) render(); }
    catch { toast('Another tab’s save could not be read. Your current record is retained.'); }
  }
});
// Static import keeps this event handler synchronous and testable.
import { mergeProgress as awaitImportMerge } from './core/progress.js?v=1.1.1';
function clock() { $('watch-clock').textContent = new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' }).toUpperCase() + ' / ' + new Date().toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }); }
clock(); setInterval(clock, 60000);
if (sync.config) sync.setStatus('Cloud vault locked');
route();

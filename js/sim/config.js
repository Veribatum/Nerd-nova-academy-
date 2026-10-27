// Finite, browser-only filesystem and configuration lifecycle. No host IO.
export const CONFIG_PATHS = {
  'config-hosts': '/etc/hosts',
  'config-profile': '/etc/NetworkManager/system-connections/academy-link.nmconnection',
  'config-endpoint': '/etc/rapscallion/relay.conf'
};
export const isConfigMission = id => Object.hasOwn(CONFIG_PATHS, id);
const HOSTS = '127.0.0.1 localhost localhost.localdomain\n::1 localhost localhost.localdomain\n192.0.2.99 relay.rapscallion.test relay\n';
const PROFILE = '[connection]\nid=Academy Link\nuuid=57975926-7431-4d77-9344-e9aca1d67511\ntype=ethernet\ninterface-name=lab0\n\n[ipv4]\nmethod=manual\naddress1=192.0.2.11/30\nnever-default=true\n\n[ipv6]\nmethod=disabled\n';
const ENDPOINT = '# Rapscallion training relay\nendpoint=192.0.2.99\nport=8042\nmode=receive\n';
export function initialConfig(id) {
  const original = id === 'config-hosts' ? HOSTS : id === 'config-profile' ? PROFILE : ENDPOINT;
  return { path: CONFIG_PATHS[id], original, disk: original, backup: null, loaded: original,
    applied: original, running: false, editor: null, reviewed: false };
}
function inspect(s, key) { if (!s.inspected.includes(key)) s.inspected.push(key); }
function changed(s) { s.changes++; s.verified = false; }
function properties(text, sections = false) {
  let section = ''; const result = {};
  for (const raw of text.split('\n')) {
    const line = raw.trim(); if (!line || line.startsWith('#') || line.startsWith(';')) continue;
    if (sections && /^\[[\w-]+\]$/.test(line)) { section = line.slice(1, -1); continue; }
    const pair = line.match(/^([^=\s]+)\s*=\s*(.*?)\s*$/);
    if (!pair || (sections && !section)) return null;
    const key = sections ? `${section}.${pair[1]}` : pair[1];
    if (Object.hasOwn(result, key)) return null;
    result[key] = pair[2];
  }
  return result;
}
function profile(text) {
  const p = properties(text, true);
  if (!p || p['connection.id'] !== 'Academy Link' || p['connection.uuid'] !== '57975926-7431-4d77-9344-e9aca1d67511' ||
    p['connection.type'] !== 'ethernet' || p['connection.interface-name'] !== 'lab0' || p['ipv4.method'] !== 'manual' ||
    p['ipv4.never-default'] !== 'true' || p['ipv6.method'] !== 'disabled' || Object.keys(p).length !== 8 ||
    !/^192\.0\.2\.(10|11)\/30$/.test(p['ipv4.address1'])) return null;
  return p;
}
function endpoint(text) {
  const p = properties(text);
  return p && Object.keys(p).length === 3 && /^192\.0\.2\.(42|99)$/.test(p.endpoint) && p.port === '8042' && p.mode === 'receive' ? p : null;
}
function hosts(text) {
  return text.split('\n').map(line => line.split('#')[0].trim().split(/\s+/)).filter(row => row.length > 1);
}
function resolved(text) { return hosts(text).find(row => row.slice(1).includes('relay.rapscallion.test'))?.[0]; }
function hostsCorrect(text) {
  const rows = hosts(text);
  return resolved(text) === '192.0.2.42' && rows.some(r => r[0] === '192.0.2.42' && r.includes('relay')) && rows.filter(r => r.slice(1).includes('relay.rapscallion.test')).length === 1 &&
    rows.some(r => r[0] === '127.0.0.1' && r.includes('localhost') && r.includes('localhost.localdomain')) && rows.some(r => r[0] === '::1' && r.includes('localhost') && r.includes('localhost.localdomain')) &&
    rows.length === 3 && rows.every(r => ['127.0.0.1', '::1', '192.0.2.42'].includes(r[0]));
}
export function configChecks(s) {
  const f = s.config;
  const base = [['Original file backed up', f.backup === f.original], ['Vim closed after saving', !f.editor], ['Saved change compared with backup', f.reviewed]];
  if (s.id === 'config-hosts') return [...base, ['Relay resolves to approved address; localhost preserved', hostsCorrect(f.disk)], ['Resolved relay responds', resolved(f.disk) === '192.0.2.42']];
  if (s.id === 'config-profile') return [...base, ['Approved lab0 profile saved', profile(f.disk)?.['ipv4.address1'] === '192.0.2.10/30'],
    ['Saved profile loaded by NetworkManager', f.loaded === f.disk], ['Approved address active on lab0', profile(f.applied)?.['ipv4.address1'] === '192.0.2.10/30'],
    ['Active profile matches saved file', f.applied === f.disk], ['Peer reachable; management unchanged', profile(f.applied)?.['ipv4.address1'] === '192.0.2.10/30']];
  return [...base, ['Approved application endpoint saved; port and mode preserved', endpoint(f.disk)?.endpoint === '192.0.2.42'],
    ['Service restarted with saved configuration', f.running && f.applied === f.disk], ['Application relay check succeeds', f.running && endpoint(f.applied)?.endpoint === '192.0.2.42']];
}
export function configCommand(s, raw) {
  const c = raw.trim().replace(/\s+/g, ' '), f = s.config, bare = c.replace(/^sudo /, '');
  if (f.editor) return 'Vim is open. Use its mode controls, then :wq or :q! to return to the shell.';
  if (bare === `cat ${f.path}` || bare === `cat ${f.path}.bak`) { inspect(s, 'file'); return bare.endsWith('.bak') ? f.backup ?? 'cat: backup does not exist' : f.disk; }
  if (bare === `cp ${f.path} ${f.path}.bak`) { f.backup = f.disk; inspect(s, 'backup'); return 'Backup created in the simulated filesystem.'; }
  if (bare === `cp ${f.path}.bak ${f.path}`) {
    if (f.backup === null) return 'cp: backup does not exist';
    if (f.disk !== f.backup) { f.disk = f.backup; f.reviewed=false; changed(s); }
    return 'Backup restored on disk. Reload/restart is still required for a running consumer.';
  }
  if (bare === `vim ${f.path}` || bare === `vi ${f.path}`) {
    inspect(s, 'editor'); f.editor = { path: f.path, buffer: f.disk, beforeInsert: f.disk, mode: 'normal', readonly: !c.startsWith('sudo '), message: 'NORMAL: press i to edit. Escape returns to normal mode. :wq saves and quits.' };
    return 'Opened Vim basics trainer. Only the mission file is available; no host files are accessed.';
  }
  if (bare === `diff -u ${f.path}.bak ${f.path}`) {
    inspect(s, 'diff');
    if (f.backup === null) return 'diff: backup does not exist';
    f.reviewed = true;
    return f.backup === f.disk ? '(no differences)' : `--- ${f.path}.bak\n+++ ${f.path}\n@@ -1,${f.backup.trimEnd().split('\n').length} +1,${f.disk.trimEnd().split('\n').length} @@\n${f.backup.trimEnd().split('\n').map(l => '-'+l).join('\n')}\n${f.disk.trimEnd().split('\n').map(l => '+'+l).join('\n')}`;
  }
  if (bare === `ls -l ${f.path}`) { inspect(s, 'permissions'); return `${s.id === 'config-profile' ? '-rw-------' : '-rw-r--r--'} 1 root root ${f.disk.length} Oct 27 12:00 ${f.path}`; }
  if (c === 'getent hosts relay.rapscallion.test' && s.id === 'config-hosts') { inspect(s, 'resolution'); return `${resolved(f.disk) || '(no match)'} relay.rapscallion.test relay`; }
  if (/^ping(?: -c [1-5])? (relay\.rapscallion\.test|192\.0\.2\.(9|42|99))$/.test(c)) {
    inspect(s, 'reachability'); const host = c.split(' ').at(-1), ip = host.includes('.test') ? resolved(f.disk) : host;
    const up = s.id === 'config-profile' ? ip === '192.0.2.9' && profile(f.applied)?.['ipv4.address1'] === '192.0.2.10/30' : ip === '192.0.2.42';
    return `PING ${host} (${ip || 'unresolved'})\n${up ? '3 packets transmitted, 3 received, 0% packet loss' : 'Destination Host Unreachable\n3 packets transmitted, 0 received, 100% packet loss'}`;
  }
  if (s.id === 'config-profile') {
    if (['nmcli connection reload', `nmcli connection load ${f.path}`].includes(bare)) {
      if (!c.startsWith('sudo ')) return 'Error: reload requires authorization in this lab.';
      if (!profile(f.disk)) return 'Error: invalid or unauthorized lab0 profile. Check sections, identity, address and never-default. Active settings retained.';
      f.loaded = f.disk; inspect(s, 'loaded'); return 'Profile loaded from disk. The active interface has not changed.';
    }
    if (/^nmcli (connection|con) (up|show) "Academy Link"$/.test(bare)) {
      inspect(s, 'profile');
      if (bare.includes(' show ')) return `connection.id: Academy Link\nconnection.interface-name: lab0\nipv4.addresses: ${profile(f.loaded)?.['ipv4.address1']}\nipv4.never-default: yes\nLoaded profile, not the active address. Use ip -br address to inspect live state.`;
      if (!c.startsWith('sudo ')) return 'Error: activation requires authorization in this lab.';
      f.applied = f.loaded; changed(s); return 'Academy Link activated on simulated lab0. Management remains unchanged.';
    }
    if (['nmcli connection show', 'nmcli con show'].includes(c)) { inspect(s, 'profile'); return 'NAME          TYPE      DEVICE\nAcademy Link  ethernet  lab0\nManagement    ethernet  enp0s3'; }
    if (['ip -br address', 'ip -br addr', 'ip addr', 'ip a'].includes(c)) { inspect(s, 'interface'); return `lo       UNKNOWN 127.0.0.1/8\nlab0     UP      ${profile(f.applied)?.['ipv4.address1']}\nenp0s3   UP      10.0.2.15/24 (protected management)`; }
    if (['ip route', 'ip route show'].includes(c)) { inspect(s, 'route'); return 'default via 10.0.2.2 dev enp0s3 (protected)\n192.0.2.8/30 dev lab0 scope link'; }
  }
  if (s.id === 'config-endpoint') {
    if (/^systemctl (status|restart) relay-watch(?:\.service)?$/.test(bare)) {
      inspect(s, 'service');
      if (bare.includes('restart')) {
        if (!c.startsWith('sudo ')) return 'Error: restart requires authorization in this lab.';
        f.applied = f.disk; f.running = !!endpoint(f.disk); changed(s);
        return f.running ? 'relay-watch started. Inspect its application check; running does not prove the destination is right.' : 'relay-watch failed: invalid endpoint, port or mode. Inspect the journal.';
      }
      return `relay-watch.service - Rapscallion relay monitor\nActive: ${f.running ? 'active (running)' : 'failed'}\nLast relay check: ${f.running && endpoint(f.applied)?.endpoint === '192.0.2.42' ? 'OK' : 'FAILED'}`;
    }
    if (/^journalctl -u relay-watch(?:\.service)?(?: -n (?:10|20|50))?(?: --no-pager)?$/.test(bare)) {
      inspect(s, 'journal'); const p=endpoint(f.applied);
      return !p ? 'relay-watch: invalid configuration; startup failed.' : `relay-watch: loaded endpoint=${p.endpoint} port=${p.port} mode=${p.mode}\nrelay-watch: ${f.running && p.endpoint === '192.0.2.42' ? 'relay health OK; telemetry received' : 'relay connection failed; destination unreachable'}`;
    }
    if (c === 'curl http://192.0.2.42:8042/health') { inspect(s, 'application'); return 'HTTP/1.1 200 OK\n{"status":"healthy","service":"training-relay"}'; }
  }
  return 'Not modeled in this configuration lab. Type help. Paths and commands are confined to the mission.';
}
export function editConfig(state, action, value = '') {
  const s = structuredClone(state), f=s.config, e=f?.editor;
  if (!e) return s;
  if (action === 'input' && e.mode === 'insert') { e.buffer=String(value).slice(0,12000); e.message='INSERT: edit the text, then press Escape.'; }
  if (action === 'insert' && e.mode !== 'insert') { e.beforeInsert=e.buffer; e.canUndo=true; e.mode='insert'; e.message='INSERT: ordinary text editing is enabled. Escape returns to normal mode.'; }
  if (action === 'normal') { e.mode='normal'; e.message='NORMAL: :w writes, :wq writes and quits, :q! discards unsaved edits, u undoes the last Insert session.'; }
  if (action === 'undo' && e.mode === 'normal') { if (e.canUndo) { e.buffer=e.beforeInsert; e.canUndo=false; e.message='Last Insert session undone. This trainer keeps one undo step.'; } else e.message='No earlier undo step in this limited trainer.'; }
  if (action === 'ex' && e.mode === 'normal') {
    const cmd=String(value).trim();
    if ([':w',':wq',':x'].includes(cmd)) {
      if (e.readonly) { e.message='E45: readonly file. :q! to quit, then reopen with sudo vim.'; return s; }
      if (e.buffer !== f.disk) { f.disk=e.buffer; f.reviewed=false; changed(s); }
      e.message=`"${e.path}" written. Saving does not reload a service or activate a network profile.`;
      if (cmd !== ':w') f.editor=null;
    } else if (cmd === ':q!' || (cmd === ':q' && e.buffer === f.disk)) f.editor=null;
    else if (cmd === ':q') e.message='E37: unsaved changes. Use :wq to save or :q! to discard.';
    else if (cmd === ':e!') { e.buffer=f.disk; e.message='Unsaved buffer discarded; file reloaded from simulated disk.'; }
    else e.message='This trainer models :w, :wq, :x, :q, :q!, :e! and u. Full Vim commands are available in your real VM.';
    if (!f.editor) s.log.push({command:`vim ${cmd}`,output:'Editor closed. Inspect the saved file, compare it with the backup, then test the consuming system.'});
  }
  return s;
}
export function configEquipment(s) {
  const f=s.config;
  return [{id:'control',name:'Training console',type:'RHEL / CONFIGURATION',status:'ONLINE',detail:'Browser-only configuration investigation. Protected management and real laptop files are outside the simulator.'},
    {id:'file',name:'Configuration file',type:'FILESYSTEM',status:f.editor?'VIM OPEN':'ON DISK',detail:`${f.path}\nOriginal backup: ${f.backup === f.original ? 'retained' : 'not retained'}\nChange compared: ${f.reviewed ? 'yes' : 'no'}\n${s.id === 'config-profile' ? 'Disk, loaded profile and active interface are separate.' : s.id === 'config-endpoint' ? 'The service reads its file at startup.' : 'getent uses the local hosts mapping in this lab.'}`},
    {id:'peer',name:s.id==='config-profile'?'Training peer':'Replacement relay',type:'APPROVED BASELINE',status:'HEALTHY',detail:s.id==='config-profile'?'Peer 192.0.2.9/30\nApproved lab0 192.0.2.10/30\nNo default route on lab0.':'relay.rapscallion.test\n192.0.2.42\nApplication port 8042\nThe old node at 192.0.2.99 is retired.'}];
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { MISSIONS, rankFor } from '../js/data/missions.js';
import { ProgressStore } from '../js/core/progress.js';
import { MemoryStorage } from './helpers.mjs';
import { createSimulation } from '../js/sim/engine.js';
import * as screens from '../js/ui/screens.js';
const store = new ProgressStore(new MemoryStorage());
const ctx = { store, sync: { status: 'Offline save', config: null, hasRememberedAuth: () => false }, companion: {}, busy: false,
  ui: { filter: 'ALL', manualSearch: '', tool: 'terminal', node: 'control', packetFilter: '', packet: 0 } };
test('every mission’s briefing, tool views and after-action report render with realistic saved state', () => {
  for (const mission of MISSIONS) {
    ctx.active = { mission: mission.id, mode: 'sim', snapshot: createSimulation(mission.id), hints: 0, attempt: 'fixture' };
    assert.match(screens.briefing(ctx, mission), /Deploy simulator/);
    for (const tool of ['terminal', 'map', 'notes', ...(['cam', 'arp'].includes(mission.id) ? ['packets'] : []), ...(mission.id === 'cam' ? ['camera'] : [])]) {
      ctx.ui.tool = tool; const html = screens.workstation(ctx, mission); assert.ok(html.includes('Verify repair')); assert.ok(!html.includes('undefined'));
    }
    assert.ok(screens.debrief(ctx, mission).includes(mission.title));
  }
});
test('real lab presentation renders without a synthetic snapshot and uses actual namespace commands', () => {
  const lab = { installed: true, active: true, attempt: 'fixture', expiresAt: Date.now() / 1000 + 60 };
  const live = { ...ctx, ui: { ...ctx.ui, tool: 'live' }, companion: { lab },
    active: { mission: 'rhel-link', mode: 'vm', snapshot: null, hints: 0, remoteAttempt: 'fixture' } };
  const active = screens.workstation(live, MISSIONS[0]);
  assert.match(active, /LAB ACTIVE/);
  assert.match(active, /sudo ip -n nn-academy link show dev &lt;interface&gt;/);
  assert.doesNotMatch(active, /link set dev lab0 up/);
  assert.doesNotMatch(active, /data-action="verify" disabled/);
  lab.expiresAt = Date.now() / 1000 - 60;
  const expired = screens.workstation(live, MISSIONS[0]);
  assert.match(expired, /LAB EXPIRED/);
  assert.match(expired, /Redeploy training lab/);
  assert.match(expired, /data-action="verify" disabled/);
});
test('rank thresholds retain the legacy 500 XP progression', () => { assert.equal(rankFor(499), 0); assert.equal(rankFor(500), 1); assert.equal(rankFor(1100), 2); });

test('Work mode only emits dedicated crew artwork, and hides private transmissions', () => {
  const work = { ...ctx, ui: { ...ctx.ui, workMode: true }, store: {
    data: { ...store.data, completed: MISSIONS.map(m => m.id) }
  } };
  const mission = MISSIONS[0];
  work.active = { mission: mission.id, mode: 'sim', snapshot: createSimulation(mission.id), attempt: 'fixture' };
  const pages = [screens.watchdesk(work), screens.crew(work), screens.briefing(work, mission),
    screens.workstation(work, mission), screens.debrief(work, mission)];
  for (const html of pages) {
    const art = [...html.matchAll(/src="(assets\/[^"]+\.webp)"/g)].map(match => match[1]);
    assert.ok(art.length);
    assert.doesNotMatch(html, /#\/morale/);
    assert.ok(art.every(src => src.startsWith('assets/work-')), art.join(', '));
  }
  assert.match(pages[0], /work-nova-bridge\.webp/);
  assert.match(pages[1], /work-sylvanas-crew\.webp/);
  assert.match(pages[2], /work-nova-mission\.webp/);
  assert.doesNotMatch(screens.morale(work), /gallery-grid|open-photo|<img/);
  const offDuty = { ...work, ui: { ...work.ui, workMode: false } };
  assert.match(screens.watchdesk(offDuty), /rapscallion-command\.webp/);
  assert.match(screens.morale(offDuty), /nova-wifi-reward\.webp/);
});

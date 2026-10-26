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
  ctx.active = { mission: 'rhel-link', mode: 'vm', snapshot: null, hints: 0, remoteAttempt: 'fixture' }; ctx.ui.tool = 'live';
  const html = screens.workstation(ctx, MISSIONS[0]); assert.ok(html.includes('sudo ip -n nn-academy')); assert.ok(html.includes('Verify real VM'));
});
test('rank thresholds retain the legacy 500 XP progression', () => { assert.equal(rankFor(499), 0); assert.equal(rankFor(500), 1); assert.equal(rankFor(1100), 2); });

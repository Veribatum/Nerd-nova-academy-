import test from 'node:test';
import assert from 'node:assert/strict';
import { ProgressStore, normalize, mergeProgress, xpTotal } from '../js/core/progress.js';
import { MemoryStorage } from './helpers.mjs';
test('v1 and v2 migrate without losing unknown achievements or double-counting XP', () => {
  const storage = new MemoryStorage({ nerdnova_v2: JSON.stringify({ xp: 570, completed: ['cam', 'arp', 'route'], medals: ['FIRST CONTACT', 'CUSTOM'], history: [{ id: 'cam', at: '2026-10-23' }] }),
    nerdnova_v1_progress: JSON.stringify({ xp: 250, completed: ['cam'] }) });
  const store = new ProgressStore(storage); assert.equal(xpTotal(store.data), 570); assert.ok(store.data.medals.includes('CUSTOM'));
  assert.ok(storage.getItem('nerdnova_v2')); assert.equal(store.data.history.length, 1);
  const id = store.start('cam', 'sim'); assert.equal(store.finish(id, 'cam', 'sim', 250, ['Packets'], {}, true), 0);
  const vm = store.start('rhel-link', 'vm'); assert.equal(store.finish(vm, 'rhel-link', 'vm', 450, ['Linux'], {}, true), 450);
  const reloaded = new ProgressStore(storage); assert.equal(xpTotal(reloaded.data), 1020); assert.ok(reloaded.data.completed.includes('arp'));
});
test('two-device merge is commutative, preserves both missions, and duplicate reward IDs do not farm XP', () => {
  const a = new ProgressStore(new MemoryStorage()), b = new ProgressStore(new MemoryStorage());
  a.finish(a.start('cam', 'sim'), 'cam', 'sim', 250, ['Packets'], {}, true);
  b.finish(b.start('route', 'sim'), 'route', 'sim', 350, ['Linux'], {}, true);
  const ab = mergeProgress(a.data, b.data), ba = mergeProgress(b.data, a.data);
  assert.equal(xpTotal(ab), 600); assert.deepEqual(ab.completed, ba.completed);
  assert.equal(xpTotal(mergeProgress(ab, ab)), 600);
  a.merge(ab); const replay = a.start('cam', 'sim'); assert.equal(a.finish(replay, 'cam', 'sim', 250, ['Packets'], {}, false), 0);
});
test('legacy code imports merge rather than replace and retain future/unknown mission IDs', () => {
  const store = new ProgressStore(new MemoryStorage());
  store.import(btoa(JSON.stringify({ xp: 500, completed: ['unknown-future', 'cam'], medals: ['LEGACY'] })));
  store.import(JSON.stringify({ xp: 10, completed: ['route'] }));
  assert.equal(xpTotal(store.data), 500); assert.deepEqual(store.data.completed, ['cam', 'route', 'unknown-future']);
  assert.ok(store.backups().length > 0); assert.throws(() => store.import('garbage'), /complete Academy/);
});
test('malformed v3 bytes are backed up before fallback migration writes a valid record', () => {
  const storage = new MemoryStorage({ nerdnova_v3: '{broken', nerdnova_v2: JSON.stringify({ xp: 250, completed: ['cam'] }) });
  const store = new ProgressStore(storage); assert.equal(xpTotal(store.data), 250);
  assert.ok(store.backups().some(b => b.data === '{broken')); assert.match(store.warning, /original/);
});
test('checkpoint survives reload and concurrent remote current mission can be superseded by local activity', () => {
  const storage = new MemoryStorage(), store = new ProgressStore(storage);
  const id = store.start('rhel-link', 'sim', { test: 1 });
  store.data.current = { mission: 'cam', attempt: 'other' };
  store.checkpoint(id, { test: 2 }); const reloaded = new ProgressStore(storage);
  assert.equal(reloaded.data.current.attempt, id); assert.equal(reloaded.data.current.snapshot.test, 2);
  assert.equal(reloaded.data.attempts[id].snapshot.test, 2);
});
test('future schema fails closed instead of resetting', () => { assert.throws(() => normalize({ schema: 20 }), /newer/); });

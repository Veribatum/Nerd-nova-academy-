import test from 'node:test';
import assert from 'node:assert/strict';
import { Companion, validVMReceipt } from '../js/lab/companion.js';
import { MemoryStorage } from './helpers.mjs';
const valid = { active: true, verified: true, target: 'nova-academy', mission: 'rhel-link', attempt: 'attempt-a', receipt: 'f'.repeat(64),
  checks: { linkUp: true, addressCorrect: true, routePresent: true, peerReachable: true, protectedUnchanged: true } };
test('VM reward gate rejects missing checks, stale attempts, and a browser-only true flag', () => {
  assert.equal(validVMReceipt(valid, 'attempt-a'), true);
  assert.equal(validVMReceipt({ verified: true }, 'attempt-a'), false);
  assert.equal(validVMReceipt(valid, 'stale'), false);
  assert.equal(validVMReceipt({ ...valid, checks: { ...valid.checks, protectedUnchanged: false } }, 'attempt-a'), false);
});
test('original companion status works even with a stale newer pairing token', async () => {
  const seen = []; const c = new Companion(async (url, options) => {
    seen.push([url, options]);
    return new Response(JSON.stringify(url.endsWith('/health') ? { version: 1 } : { connected: true, running: true, vm: 'RHEL 9.8 Vehicle Node', state: 'running' }));
  }, new MemoryStorage({ nova_lab_token: 'old-session' }));
  await c.probe(); assert.equal(c.vm.running, true);
  assert.ok(seen.every(([, options]) => !options.headers.Authorization));
  await assert.rejects(c.operate('exec'), /Unsupported/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { seal, open, validateRepo, CloudSync } from '../js/core/sync.js';
import { ProgressStore, xpTotal } from '../js/core/progress.js';
import { MemoryStorage } from './helpers.mjs';
const pass = 'Marine-vault-test-2026';
function fakeGitHub() {
  let file = null, revision = 0, conflictOnce = false, writes = 0;
  const api = async (url, options = {}) => {
    assert.match(url, /^https:\/\/api.github.com\/repos\/Veribatum\/save/);
    assert.equal(options.headers.Authorization, 'Bearer test-token');
    if (url.endsWith('/save')) return new Response(JSON.stringify({ private: true, default_branch: 'main' }));
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      if (conflictOnce) { conflictOnce = false; return new Response('{}', { status: 409 }); }
      if (file && body.sha !== file.sha) return new Response('{}', { status: 409 });
      file = { type: 'file', content: body.content, sha: `sha-${++revision}`, size: body.content.length }; writes++;
      return new Response('{}', { status: 201 });
    }
    return file ? new Response(JSON.stringify(file)) : new Response('{}', { status: 404 });
  };
  return { api, get file() { return file; }, get writes() { return writes; }, conflict() { conflictOnce = true; } };
}
test('AES-GCM vault is authenticated, randomized, and rejects a wrong passphrase', async () => {
  const a = await seal({ xp: 42 }, pass), b = await seal({ xp: 42 }, pass);
  assert.notEqual(a.ciphertext, b.ciphertext); assert.deepEqual(await open(a, pass), { xp: 42 });
  await assert.rejects(open(a, 'wrong-password'), /Nothing was overwritten/);
  assert.throws(() => validateRepo('https://evil/path'), /owner/);
});
test('cloud sync merges two devices, encrypts credentials at rest, retries conflicts, and rejects wrong-passphrase overwrites', async () => {
  const github = fakeGitHub(); const aStorage = new MemoryStorage(), bStorage = new MemoryStorage();
  const a = new ProgressStore(aStorage), b = new ProgressStore(bStorage);
  const sa = new CloudSync(a, github.api, aStorage), sb = new CloudSync(b, github.api, bStorage);
  a.finish(a.start('cam', 'sim'), 'cam', 'sim', 250, ['Packets'], {}, true);
  await sa.connect('Veribatum/save', 'test-token', pass);
  assert.ok(!aStorage.getItem('nerdnova_cloud_auth').includes('test-token'));
  b.finish(b.start('route', 'sim'), 'route', 'sim', 350, ['Linux'], {}, true);
  github.conflict(); await sb.connect('Veribatum/save', 'test-token', pass); await sa.synchronize();
  assert.equal(xpTotal(a.data), 600); assert.equal(xpTotal(b.data), 600);
  const writes = github.writes; const wrong = new CloudSync(new ProgressStore(new MemoryStorage()), github.api, new MemoryStorage());
  await assert.rejects(wrong.connect('Veribatum/save', 'test-token', 'not-the-right-passphrase'), /Nothing was overwritten/);
  assert.equal(github.writes, writes); sa.lock(); sb.lock();
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { CREW, photoUnlocked, crewForMission } from '../js/data/crew.js';
import { MISSIONS, GALLERY } from '../js/data/missions.js';
import { ProgressStore } from '../js/core/progress.js';
import { MemoryStorage } from './helpers.mjs';
import { crewDeck } from '../js/ui/crew-screens.js';
import { missionCard } from '../js/ui/screens.js';
test('the four established adults own actual mission loops and distinct Wi-Fi rewards', () => {
  assert.deepEqual(CREW.map(c => c.name), ['Nova', 'Sylvanas', 'Samus', 'Jenny']);
  const store = new ProgressStore(new MemoryStorage());
  for (const crew of CREW) {
    const mission = MISSIONS.find(m => m.id === crew.wifiMission); assert.equal(crewForMission(mission).id, crew.id);
    const photo = GALLERY.find(g => g.mission === mission.id); assert.equal(photo.crew, crew.id);
    assert.equal(photoUnlocked(photo, store.data), false);
    const id = store.start(mission.id, 'sim'); store.finish(id, mission.id, 'sim', mission.xp, mission.skills, {}, true, [photo.id]);
    assert.equal(photoUnlocked(photo, store.data), true); assert.deepEqual(store.data.attempts[id].newPhotos, [photo.id]);
    assert.ok(crewDeck({ store }, crew, missionCard).includes(mission.title));
  }
  assert.ok(store.data.medals.includes('CREW CONNECTION'));
});
test('legacy photo unlocks are retained while new crew photos require their own repairs', () => {
  const store = new ProgressStore(new MemoryStorage({ nerdnova_v2: JSON.stringify({ xp: 570, completed: ['cam', 'arp', 'route'] }) }));
  assert.equal(photoUnlocked(GALLERY.find(g => g.id === 'hangar'), store.data), true);
  for (const photo of GALLERY.filter(g => g.mission)) assert.equal(photoUnlocked(photo, store.data), false);
});
test('replay record reports zero new XP and no new-photo claim', () => {
  const store = new ProgressStore(new MemoryStorage());
  let id = store.start('nova-wifi','sim'); store.finish(id,'nova-wifi','sim',350,['Wireless'],{},true,['nova-wifi-photo']);
  id = store.start('nova-wifi','sim'); store.finish(id,'nova-wifi','sim',350,['Wireless'],{},true);
  assert.equal(store.data.attempts[id].xpAwarded, 0); assert.deepEqual(store.data.attempts[id].newPhotos, []);
});

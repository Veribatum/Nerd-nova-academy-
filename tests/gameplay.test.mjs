import test from 'node:test';
import assert from 'node:assert/strict';
import { createSimulation, runCommand, verifySimulation, applyCamera, filterPackets, packetRows, restoreSimulation } from '../js/sim/engine.js';
import { MISSIONS } from '../js/data/missions.js';
import { createPcap } from '../js/sim/pcap.js';
const solve = {
  'rhel-link': ['ip -br address', 'ping -c 3 192.0.2.9', 'sudo ip link set lab0 up'],
  cam: ['ss -uln', 'show camera', 'camera set destination-port 5700'],
  'switch-watch': ['show interfaces gigabitEthernet 0/7', 'show vlan brief', 'configure terminal', 'interface gigabitEthernet 0/7', 'switchport access vlan 20', 'end', 'write memory'],
  route: ['ip route get 203.0.113.20', 'sudo ip route replace 203.0.113.0/24 via 198.51.100.1 dev enp0s8'],
  'ovs-island': ['ip -br link', 'ovs-vsctl show', 'sudo ovs-vsctl add-port br-lab tap-sensor'],
  'service-watch': ['systemctl status telemetry', 'journalctl -u telemetry -n 20', 'ls -l /srv/academy/telemetry.cfg', 'sudo chmod 640 /srv/academy/telemetry.cfg', 'sudo systemctl restart telemetry'],
  arp: ['ip neigh', 'sudo ip neigh del 10.0.0.42 dev eth0', 'ping 10.0.0.42']
};
for (const mission of MISSIONS) {
  test(`${mission.id}: fault fails, real repair sequence passes, checkpoint resumes`, () => {
    let state = createSimulation(mission.id, 22);
    assert.equal(verifySimulation(state).passed, false);
    for (const command of solve[mission.id]) state = runCommand(state, command);
    state = restoreSimulation(JSON.parse(JSON.stringify(state)));
    const verified = verifySimulation(state); assert.equal(verified.passed, true, JSON.stringify(verified.checks));
    assert.ok(state.inspected.length > 0);
  });
}
test('camera: a matching port does not excuse wrong VLAN', () => {
  assert.equal(verifySimulation(applyCamera(createSimulation('cam'), 5700, '20')).passed, false);
});
test('switch: configuration must be saved; wrong CLI context cannot apply it', () => {
  let state = runCommand(createSimulation('switch-watch'), 'switchport access vlan 20');
  assert.notEqual(state.switchVlan, 20);
  for (const command of solve['switch-watch'].slice(0, -1)) state = runCommand(state, command);
  const result = verifySimulation(state); assert.equal(result.passed, false); assert.ok(result.checks.some(([label, passed]) => label.includes('saved') && !passed));
});
test('service: blind restart and world-readable config fail the objective', () => {
  let state = runCommand(createSimulation('service-watch'), 'sudo systemctl restart telemetry'); assert.equal(state.service, false);
  state = runCommand(state, 'sudo chmod 644 /srv/academy/telemetry.cfg'); state = runCommand(state, 'sudo systemctl restart telemetry');
  assert.equal(state.service, true); assert.equal(verifySimulation(state).passed, false);
});
test('synthetic terminal never interprets shell chaining or unknown real commands', () => {
  const state = runCommand(createSimulation('rhel-link'), 'sudo ip link set lab0 up; curl attacker');
  assert.equal(state.link, false); assert.match(state.log.at(-1).output, /one supported command/);
});
test('packet filters distinguish ARP, UDP transport ports and IP fields', () => {
  const rows = packetRows(createSimulation('cam', 0));
  assert.equal(filterPackets(rows, 'arp').length, 2); assert.equal(filterPackets(rows, 'udp.port == 5600').length, 2);
  assert.equal(filterPackets(rows, 'udp.port == 5700').length, 0); assert.equal(filterPackets(rows, 'ip.addr == 10.0.0.42').length, 4);
  assert.throws(() => filterPackets(rows, 'tcp && arbitrary'), /Supported/);
});
test('PCAP records have complete Ethernet frames, consistent lengths and valid IPv4 checksums', () => {
  const bytes = createPcap(5900); const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(0, true), 0xa1b2c3d4); assert.equal(view.getUint32(20, true), 1);
  let at = 24, count = 0;
  while (at < bytes.length) {
    const size = view.getUint32(at + 8, true); assert.equal(size, view.getUint32(at + 12, true));
    const start = at + 16; assert.ok(start + size <= bytes.length); const type = view.getUint16(start + 12);
    if (type === 0x0800) {
      let checksum = 0; for (let i = start + 14; i < start + 34; i += 2) checksum += view.getUint16(i);
      while (checksum >> 16) checksum = (checksum & 65535) + (checksum >> 16);
      assert.equal(checksum, 65535);
      if (bytes[start + 23] === 17) assert.equal(view.getUint16(start + 36), 5900);
    }
    at += 16 + size; count++;
  }
  assert.equal(at, bytes.length); assert.equal(count, 6);
});

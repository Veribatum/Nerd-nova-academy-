import { missionById } from '../data/missions.js?v=1.1.1';
import { isWifiMission, initialWifi, wifiCommand, wifiChecks, wifiEquipment } from './wifi.js?v=1.1.1';
const clone = v => structuredClone(v);
const low = s => s.toLowerCase().replace(/\s+/g, ' ').trim();
export function createSimulation(id, seed = Date.now() % 65535) {
  if (!missionById(id)) throw Error('Unknown mission.');
  return { version: 1, id, seed, link: false, cameraPort: [5600, 5800, 5900][seed % 3], cameraIP: '10.0.0.20', vlan: '10',
    switchVlan: [30, 40][seed % 2], switchSaved: false, cliMode: 'exec', selectedInterface: '',
    gateway: seed % 2 ? '198.51.100.254' : '198.51.100.253', ovsAttached: false,
    permissions: '600', service: false, neighbor: '02:bb:00:00:00:99',
    wifi: isWifiMission(id) ? initialWifi(id) : null,
    inspected: [], changes: 0, hints: 0, verified: false, tests: [], notes: '',
    log: [{ command: '', output: 'ACADEMY TRAINING ENVIRONMENT\nStateful simulation · no commands run on your computer.\nType help for this equipment’s commands, or inspect the topology.' }] };
}
export function restoreSimulation(snapshot) {
  if (!snapshot || snapshot.version !== 1 || !missionById(snapshot.id)) throw Error('This mission checkpoint needs a fresh deployment. Your earned progress is safe.');
  return { ...createSimulation(snapshot.id, snapshot.seed), ...clone(snapshot), log: Array.isArray(snapshot.log) ? snapshot.log : [] };
}
function inspect(s, value) { if (!s.inspected.includes(value)) s.inspected.push(value); }
function change(s, property, value) { if (s[property] !== value) { s[property] = value; s.changes++; s.verified = false; } }
export function prompt(s) { return s.id === 'switch-watch' ? `SW-1${s.cliMode === 'config' ? '(config)' : s.cliMode === 'interface' ? '(config-if)' : ''}#` : 'operator@academy:~$'; }
export function runCommand(state, raw) {
  const s = clone(state); const c = low(raw); let output = ''; let match;
  if (!c) return s;
  if (raw.length > 400) { output = 'Command too long for this training console.'; }
  else if (/[;&|`$<>\n\r]/.test(raw)) { output = 'This console accepts one supported command at a time. Shell scripts, pipes and redirection are not executed.'; }
  else if (c === 'clear') { s.log = []; return s; }
  else if (c === 'help' || c === '?') { output = `TRAINING CLI / ${missionById(s.id).title}\n${missionById(s.id).commands.join('\n')}\n\nCommands change this mission’s state. Use Verify repair when ready.\nFor a guided explanation, open the field manual or ask Nova for a hint.`; }
  else if (isWifiMission(s.id)) output = wifiCommand(s, c);
  else if (['ip -br address', 'ip -br addr', 'ip addr', 'ip address', 'ip a', 'ip -br a', 'ip -br link', 'ip link'].includes(c)) {
    inspect(s, 'interface');
    output = s.id === 'rhel-link' ? `lo    UNKNOWN  127.0.0.1/8\nlab0  ${s.link ? 'UP  ' : 'DOWN'}     192.0.2.10/30` :
      s.id === 'ovs-island' ? `lo              UNKNOWN\nbr-mgmt         UP\nbr-lab          UP\nvnet-console    UP\ntap-sensor      UP` :
      s.id === 'route' ? 'enp0s8    UP  198.51.100.10/24' : 'eth0    UP  10.0.0.20/24';
  }
  else if (/^ip (link|addr|address) (show|show dev) lab0$/.test(c) && s.id === 'rhel-link') {
    inspect(s, 'interface'); output = `3: lab0: <BROADCAST,MULTICAST${s.link ? ',UP,LOWER_UP' : ''}> mtu 1500 state ${s.link ? 'UP' : 'DOWN'}\n    link/ether 02:00:00:00:00:10\n    inet 192.0.2.10/30 scope global lab0`;
  }
  else if (c === 'ip route' || c === 'ip r' || c === 'ip route show') {
    inspect(s, 'route'); output = s.id === 'rhel-link' ? `192.0.2.8/30 dev lab0 proto kernel scope link src 192.0.2.10${s.link ? '' : ' linkdown'}` :
      s.id === 'route' ? `default via 198.51.100.1 dev enp0s8\n198.51.100.0/24 dev enp0s8 proto kernel scope link src 198.51.100.10\n203.0.113.0/24 via ${s.gateway} dev enp0s8` : '10.0.0.0/24 dev eth0 proto kernel scope link src 10.0.0.20';
  }
  else if (c === 'ip route get 203.0.113.20' && s.id === 'route') {
    inspect(s, 'route'); output = `203.0.113.20 via ${s.gateway} dev enp0s8 src 198.51.100.10\n    cache`;
  }
  else if (/^(sudo )?ip link set (dev )?lab0 (up|down)$/.test(c) && s.id === 'rhel-link') {
    change(s, 'link', c.endsWith('up')); output = 'Link configuration applied.';
  }
  else if ((match = c.match(/^ping(?: -c [1-5])? ([0-9.]+)$/))) {
    inspect(s, 'reachability'); const host = match[1]; let success = false; let known = true;
    if (s.id === 'rhel-link' && host === '192.0.2.9') success = s.link;
    else if (s.id === 'route' && host === '198.51.100.1') success = true;
    else if (s.id === 'route' && host === '203.0.113.20') success = s.gateway === '198.51.100.1';
    else if (s.id === 'switch-watch' && host === '198.51.100.20') success = s.switchVlan === 20;
    else if (s.id === 'ovs-island' && host === '192.0.2.42') success = s.ovsAttached;
    else if (['cam', 'arp'].includes(s.id) && host === '10.0.0.42') {
      if (s.id === 'arp' && !s.neighbor) s.neighbor = '02:aa:10:42:00:01';
      success = s.id === 'cam' || s.neighbor === '02:aa:10:42:00:01';
    } else known = false;
    output = known ? `PING ${host}\n${success ? `64 bytes from ${host}: icmp_seq=1 ttl=64 time=0.8 ms\n64 bytes from ${host}: icmp_seq=2 ttl=64 time=0.6 ms\n64 bytes from ${host}: icmp_seq=3 ttl=64 time=0.7 ms\n\n3 packets transmitted, 3 received, 0% packet loss` : `From local interface: Destination Host Unreachable\n\n3 packets transmitted, 0 received, 100% packet loss`}` : 'That target is outside this mission’s synthetic topology. Check the briefing.';
    s.tests.push({ test: `ping ${host}`, passed: success });
  }
  else if (['ss -uln', 'ss -tuln', 'ss -lunt', 'ss -lun'].includes(c)) {
    inspect(s, 'sockets'); output = s.id === 'service-watch' ? (s.service ? 'Netid State  Local Address:Port\ntcp   LISTEN 0.0.0.0:8042' : 'Netid State  Local Address:Port\n(no telemetry listener)') : 'Netid State   Local Address:Port\nudp   UNCONN  10.0.0.20:5700';
  }
  else if (c === 'show camera' && s.id === 'cam') { inspect(s, 'camera'); output = `CAM-01: LINK UP\nAddress: 10.0.0.42/24\nTransport: UDP\nStream destination: ${s.cameraIP}:${s.cameraPort}\nAccess VLAN: ${s.vlan}`; }
  else if ((match = c.match(/^camera set destination-port (\d+)$/)) && s.id === 'cam') {
    const port = Number(match[1]); if (port < 1 || port > 65535) output = 'Use a valid UDP port, 1–65535.';
    else { change(s, 'cameraPort', port); output = 'Camera stream destination port applied.'; }
  }
  else if (['ip neigh', 'ip neigh show', 'arp -n'].includes(c)) {
    inspect(s, 'neighbors'); output = s.id === 'arp' ? (s.neighbor ? `10.0.0.42 dev eth0 lladdr ${s.neighbor} ${s.neighbor === '02:aa:10:42:00:01' ? 'REACHABLE' : 'PERMANENT'}` : '(no neighbor entry; it will be learned on the next peer test)') : '10.0.0.42 dev eth0 lladdr 02:aa:10:42:00:01 REACHABLE';
  }
  else if (/^(sudo )?ip neigh (del|delete) 10\.0\.0\.42 dev eth0$/.test(c) && s.id === 'arp') { change(s, 'neighbor', ''); output = 'Neighbor entry deleted.'; }
  else if (/^(sudo )?ip route replace 203\.0\.113\.0\/24 via [0-9.]+ dev enp0s8$/.test(c) && s.id === 'route') {
    const gateway = c.match(/via ([0-9.]+)/)[1];
    if (!/^198\.51\.100\.(1|253|254)$/.test(gateway)) output = 'RTNETLINK: this lab only models gateways on the approved local segment.';
    else { change(s, 'gateway', gateway); output = 'Static route replaced. Default route unchanged.'; }
  }
  else if (s.id === 'switch-watch') output = switchCommand(s, c);
  else if (s.id === 'ovs-island') output = ovsCommand(s, c);
  else if (s.id === 'service-watch') output = serviceCommand(s, c);
  else output = 'Command is outside this training console. Type help for supported commands. No real shell command was executed.';
  s.log.push({ command: raw, output }); if (s.log.length > 100) s.log = s.log.slice(-100);
  if (s.tests.length > 60) s.tests = s.tests.slice(-60);
  return s;
}
function switchCommand(s, c) {
  if (c === 'enable') return 'Privileged EXEC mode.';
  if (c === 'show interfaces' || /^show int(?:erfaces)? gigabitethernet ?0\/[79]$/.test(c)) {
    inspect(s, 'counters'); return 'GigabitEthernet0/7 is up, line protocol is up (connected)\n  Full-duplex, 1000Mb/s\n  5 minute input rate 8000 bits/sec\n  0 input errors, 0 CRC, 0 frame\n  0 output errors, 0 collisions';
  }
  if (/^show (int|interfaces) gigabitethernet ?0\/7 switchport$/.test(c)) {
    inspect(s, 'vlan'); return `Name: Gi0/7\nSwitchport: Enabled\nAdministrative Mode: static access\nOperational Mode: static access\nAccess Mode VLAN: ${s.switchVlan}`;
  }
  if (c === 'show vlan brief') { inspect(s, 'vlan'); return `VLAN Name       Status    Ports\n1    default    active    Gi0/1\n20   MISSION    active    Gi0/2${s.switchVlan === 20 ? ', Gi0/7' : ''}\n${s.switchVlan !== 20 ? `${s.switchVlan}   WORKSHOP   active    Gi0/7` : '30   WORKSHOP   active'}`; }
  if (c === 'show running-config' || c === 'show running-config interface gigabitethernet 0/7') return `interface GigabitEthernet0/7\n switchport mode access\n switchport access vlan ${s.switchVlan}`;
  if (['conf t', 'configure terminal'].includes(c)) { s.cliMode = 'config'; return 'Enter configuration commands, one per line.'; }
  if (/^(interface|int) gigabitethernet ?0\/7$/.test(c)) {
    if (s.cliMode !== 'config') return 'Enter configure terminal before selecting an interface.';
    s.cliMode = 'interface'; s.selectedInterface = 'Gi0/7'; return 'Configuring GigabitEthernet0/7.';
  }
  if (c === 'switchport mode access' && s.cliMode === 'interface') return 'Administrative mode is access.';
  if (/^switchport access vlan \d+$/.test(c)) {
    if (s.cliMode !== 'interface') return 'Select the affected interface in configuration mode first.';
    const vlan = Number(c.split(' ').at(-1));
    if (![20, 30, 40].includes(vlan)) return 'VLAN is not present in this lab’s approved VLAN database.';
    change(s, 'switchVlan', vlan); s.switchSaved = false; return 'Access VLAN applied to Gi0/7.';
  }
  if (c === 'exit') { s.cliMode = s.cliMode === 'interface' ? 'config' : 'exec'; return 'Exited one configuration level.'; }
  if (c === 'end') { s.cliMode = 'exec'; return 'Returned to privileged EXEC.'; }
  if (['write memory', 'wr', 'copy running-config startup-config'].includes(c)) {
    if (s.cliMode !== 'exec') return 'Use end before saving from privileged EXEC.';
    s.switchSaved = true; return 'Building configuration...\n[OK]';
  }
  return '% Unsupported command or context. Type help for the commands modeled on SW-1.';
}
function ovsCommand(s, c) {
  if (c === 'ovs-vsctl show' || c === 'sudo ovs-vsctl show') {
    inspect(s, 'ovs'); return `8d14be03-0000-4000-8000-000000000001\n    Bridge br-mgmt\n        Port mgmt0\n    Bridge br-lab\n        Port vnet-console\n            Interface vnet-console${s.ovsAttached ? '\n        Port tap-sensor\n            Interface tap-sensor' : ''}`;
  }
  if (/^(sudo )?ovs-vsctl list-br$/.test(c)) { inspect(s, 'ovs'); return 'br-lab\nbr-mgmt'; }
  if (/^(sudo )?ovs-vsctl list-ports br-lab$/.test(c)) { inspect(s, 'ovs'); return `${s.ovsAttached ? 'tap-sensor\n' : ''}vnet-console`; }
  if (/^(sudo )?ovs-vsctl add-port br-lab tap-sensor$/.test(c)) { change(s, 'ovsAttached', true); return 'tap-sensor attached to br-lab.'; }
  if (/^(sudo )?ovs-vsctl del-port br-lab tap-sensor$/.test(c)) { change(s, 'ovsAttached', false); return 'tap-sensor detached from br-lab.'; }
  if (c.includes('ovs-vsctl')) return 'This mission authorizes br-lab and tap-sensor only. Management is outside this console.';
  return 'Command not modeled. Type help for OVS and peer-test commands.';
}
function serviceCommand(s, c) {
  if (/^(sudo )?systemctl (status|is-active) telemetry(\.service)?$/.test(c)) {
    inspect(s, 'service'); return `telemetry.service - Academy telemetry collector\n  Loaded: loaded; enabled\n  Active: ${s.service ? 'active (running)' : 'failed (Result: exit-code)'}${s.service ? '\n  Listening on 0.0.0.0:8042' : '\n  Main process exited, status=1/FAILURE'}`;
  }
  if (/^(sudo )?journalctl -u telemetry(\.service)?( -n (20|10|50))?( --no-pager)?$/.test(c)) {
    inspect(s, 'journal'); return s.service ? 'telemetry: Configuration loaded. Listener ready on :8042.' : 'telemetry: Cannot open /srv/academy/telemetry.cfg: Permission denied\nsystemd: telemetry.service: Main process exited, status=1/FAILURE';
  }
  if (c === 'ls -l /srv/academy/telemetry.cfg' || c === 'namei -l /srv/academy/telemetry.cfg') {
    inspect(s, 'permissions'); return `${{ '600': '-rw-------', '640': '-rw-r-----', '644': '-rw-r--r--', '777': '-rwxrwxrwx' }[s.permissions] || s.permissions} 1 root telemetry 128 Oct 26 15:58 /srv/academy/telemetry.cfg`;
  }
  if (c === 'id telemetry') { inspect(s, 'account'); return 'uid=993(telemetry) gid=993(telemetry) groups=993(telemetry)'; }
  const chmod = c.match(/^(sudo )?chmod (600|640|644|777) \/srv\/academy\/telemetry\.cfg$/);
  if (chmod) { change(s, 'permissions', chmod[2]); return 'File permissions changed. Restart the service after addressing the cause.'; }
  if (/^(sudo )?systemctl (restart|start) telemetry(\.service)?$/.test(c)) {
    const readable = ['640', '644', '777'].includes(s.permissions); change(s, 'service', readable);
    return readable ? 'telemetry.service started.' : 'Job for telemetry.service failed. See systemctl status telemetry and journalctl -u telemetry.';
  }
  return 'Command not modeled. Type help for service, journal and permission commands.';
}
export function verifySimulation(state) {
  const s = clone(state); let checks;
  switch (s.id) {
    case 'rhel-link': checks = [['Interface administratively UP', s.link], ['192.0.2.10/30 preserved', true], ['Three peer replies', s.link], ['Management path unchanged', true]]; break;
    case 'cam': checks = [['Camera destination matches viewer', s.cameraIP === '10.0.0.20' && s.cameraPort === 5700], ['VLAN 10 preserved', s.vlan === '10'], ['Viewer receives video datagrams', s.cameraPort === 5700 && s.vlan === '10' && s.cameraIP === '10.0.0.20']]; break;
    case 'switch-watch': checks = [['Gi0/7 in access VLAN 20', s.switchVlan === 20], ['Console peer replies', s.switchVlan === 20], ['Configuration saved', s.switchSaved], ['Other ports unchanged', true]]; break;
    case 'route': checks = [['Shore route uses approved next hop', s.gateway === '198.51.100.1'], ['Local gateway reachable', true], ['Shore target reachable', s.gateway === '198.51.100.1'], ['Default route preserved', true]]; break;
    case 'ovs-island': checks = [['tap-sensor attached to br-lab', s.ovsAttached], ['Sensor peer replies', s.ovsAttached], ['br-mgmt preserved', true]]; break;
    case 'service-watch': checks = [['Config remains root:telemetry', true], ['Least-privilege mode 640', s.permissions === '640'], ['Service running', s.service], ['Telemetry port listening', s.service]]; break;
    case 'arp':
      if (!s.neighbor) s.neighbor = '02:aa:10:42:00:01';
      checks = [['Neighbor resolves to replacement MAC', s.neighbor === '02:aa:10:42:00:01'], ['Camera replies', s.neighbor === '02:aa:10:42:00:01'], ['IP address and VLAN unchanged', true]]; break;
    default: if (isWifiMission(s.id)) checks = wifiChecks(s); else throw Error('Unknown mission verifier.');
  }
  s.verified = checks.every(c => c[1]); s.tests.push(...checks.map(([test, passed]) => ({ test, passed })));
  s.log.push({ command: 'VERIFY REPAIR', output: checks.map(([label, passed]) => `${passed ? 'PASS' : 'FAIL'}  ${label}`).join('\n') });
  return { state: s, passed: s.verified, checks, evidence: { mode: 'sim', checks, changes: s.changes, hints: s.hints, inspected: s.inspected, seed: s.seed } };
}
export function applyCamera(state, port, vlan) {
  if (!Number.isInteger(port) || port < 1 || port > 65535 || !['10', '20'].includes(vlan)) throw Error('Use a valid UDP port and one of the modeled VLANs.');
  const s = clone(state); change(s, 'cameraPort', port); change(s, 'vlan', vlan); inspect(s, 'camera');
  s.log.push({ command: 'CAMERA CONTROL', output: `Destination UDP ${port}, access VLAN ${vlan} applied.` }); return s;
}
export function equipment(s) {
  if (isWifiMission(s.id)) return wifiEquipment(s);
  const common = { id: 'control', name: 'Mission console', type: 'WORKSTATION', status: 'Powered', detail: 'Your diagnostic station. Use the briefing’s approved baseline and inspect the path in order.' };
  if (s.id === 'rhel-link') return [common,
    { id: 'node', name: 'Vehicle Node', type: 'RHEL / lab0', status: s.link ? 'UP' : 'DOWN', detail: `Isolated namespace: nn-academy\nlab0: ${s.link ? 'UP' : 'DOWN'}\n192.0.2.10/30\nManagement NICs are outside this topology.` },
    { id: 'peer', name: 'Launch peer', type: 'RHEL / lab0', status: 'UP', detail: 'Namespace nn-peer\n192.0.2.9/30\nLink UP · approved peer endpoint.' }];
  if (s.id === 'cam' || s.id === 'arp') return [
    { ...common, name: 'Viewer console', detail: `10.0.0.20/24\nUDP listener: 5700\nVLAN 10\n${s.id === 'arp' ? `Neighbor 10.0.0.42 → ${s.neighbor || 'not learned'}` : 'Video status: ' + (s.cameraPort === 5700 && s.vlan === '10' ? 'RECEIVING' : 'TIMEOUT')}` },
    { id: 'switch', name: 'SW-1', type: 'ACCESS SWITCH', status: 'UP', detail: 'Viewer and camera ports: link UP\nApproved VLAN 10\nCRC counters: 0' },
    { id: 'camera', name: 'CAM-01', type: 'UDP CAMERA', status: 'UP', detail: `10.0.0.42/24\nMAC 02:aa:10:42:00:01\n${s.id === 'cam' ? `Stream: ${s.cameraIP}:${s.cameraPort}\nAccess VLAN ${s.vlan}` : 'Replacement device · responding to ARP'}` }];
  if (s.id === 'switch-watch') return [
    { ...common, detail: 'Console 198.51.100.10/24\nConnected to SW-1 GigabitEthernet0/7\nApproved mission VLAN: 20' },
    { id: 'switch', name: 'SW-1', type: 'GIGABIT SWITCH', status: 'UP', detail: `Gi0/7: up/up, access VLAN ${s.switchVlan}\nGi0/2: up/up, access VLAN 20\nCRC errors: 0\nConfig: ${s.switchSaved ? 'saved' : 'running only'}` },
    { id: 'peer', name: 'Control station', type: 'VLAN 20', status: 'UP', detail: '198.51.100.20/24\nSW-1 Gi0/2 · access VLAN 20' }];
  if (s.id === 'route') return [
    { ...common, detail: `enp0s8 UP\n198.51.100.10/24\nShore route via ${s.gateway}` },
    { id: 'gateway', name: 'Shore gateway', type: 'ROUTER', status: 'UP', detail: '198.51.100.1\nApproved gateway for 203.0.113.0/24' },
    { id: 'peer', name: 'Shore relay', type: 'REMOTE SERVICE', status: 'UP', detail: '203.0.113.20/24\nResponds when reached through the approved gateway.' }];
  if (s.id === 'ovs-island') return [
    { ...common, detail: 'Virtual console\nvnet-console attached to br-lab' },
    { id: 'bridge', name: 'br-lab', type: 'OPEN vSWITCH', status: 'UP', detail: `Ports: vnet-console${s.ovsAttached ? ', tap-sensor' : ''}\nbr-mgmt is separate and healthy.` },
    { id: 'peer', name: 'Sensor VM', type: 'tap-sensor', status: 'UP', detail: `192.0.2.42\nHost interface tap-sensor: UP\nBridge membership: ${s.ovsAttached ? 'br-lab' : 'none'}` }];
  return [common,
    { id: 'service', name: 'Telemetry', type: 'SYSTEMD SERVICE', status: s.service ? 'RUNNING' : 'FAILED', detail: `Service account: telemetry\nStatus: ${s.service ? 'active' : 'failed'}\nListener: ${s.service ? 'TCP 8042' : 'absent'}` },
    { id: 'config', name: 'Service config', type: 'FILESYSTEM', status: 'PRESENT', detail: `/srv/academy/telemetry.cfg\nOwner: root · group: telemetry\nMode: ${s.permissions}\nApproved mode: 640` }];
}
export function packetRows(s) {
  return [
    { no: 1, time: '0.000', src: '10.0.0.20', dst: 'Broadcast', proto: 'ARP', info: 'Who has 10.0.0.42? Tell 10.0.0.20', detail: 'Ethernet destination ff:ff:ff:ff:ff:ff\nARP operation 1 (request)\nSender IP 10.0.0.20; target IP 10.0.0.42' },
    { no: 2, time: '0.003', src: '10.0.0.42', dst: '10.0.0.20', proto: 'ARP', info: '10.0.0.42 is at 02:aa:10:42:00:01', detail: 'ARP operation 2 (reply)\nSender MAC 02:aa:10:42:00:01\nSender IP 10.0.0.42\nCompare this mapping with the viewer neighbor table.' },
    { no: 3, time: '0.028', src: '10.0.0.20', dst: '10.0.0.42', proto: 'ICMP', info: 'Echo request (test station)', detail: 'IPv4 protocol 1\nICMP type 8, code 0\nThis tests IP reachability, not UDP video.' },
    { no: 4, time: '0.032', src: '10.0.0.42', dst: '10.0.0.20', proto: 'ICMP', info: 'Echo reply (test station)', detail: 'ICMP type 0, code 0\nSuccessful request/reply from the test station.' },
    { no: 5, time: '0.140', src: '10.0.0.42', dst: '10.0.0.20', proto: 'UDP', info: `Video datagram 46000 → ${s.cameraPort}`, detail: `IPv4 protocol 17\nSource port 46000\nDestination port ${s.cameraPort}\nPayload: synthetic video marker\nDelivery is not guaranteed by UDP.` },
    { no: 6, time: '0.170', src: '10.0.0.42', dst: '10.0.0.20', proto: 'UDP', info: `Video datagram 46000 → ${s.cameraPort}`, detail: 'Second frame in the same sender flow. Compare destination transport port with the viewer listener.' }
  ];
}
export function filterPackets(rows, filter) {
  const f = low(filter);
  if (!f) return rows;
  if (['arp', 'icmp', 'udp'].includes(f)) return rows.filter(p => p.proto.toLowerCase() === f);
  const port = f.match(/^udp\.port\s*==\s*(\d+)$/);
  if (port) return rows.filter(p => p.proto === 'UDP' && (p.info.includes(`→ ${port[1]}`) || port[1] === '46000'));
  const address = f.match(/^ip\.addr\s*==\s*([0-9.]+)$/);
  if (address) return rows.filter(p => p.proto !== 'ARP' && [p.src, p.dst].includes(address[1]));
  throw Error('Supported display filters: arp, icmp, udp, udp.port == 5600, ip.addr == 10.0.0.42.');
}

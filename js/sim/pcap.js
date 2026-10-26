// A valid Ethernet/IPv4 PCAP built from fictional frames. No capture permissions.
const concat = (...items) => Uint8Array.from(items.flatMap(v => Array.from(v)));
const u16 = n => [n >> 8 & 255, n & 255];
const mac = s => s.split(':').map(v => parseInt(v, 16));
const ip = s => s.split('.').map(Number);
function checksum(a) { let total = 0; for (let i = 0; i < a.length; i += 2) total += (a[i] << 8) + (a[i + 1] || 0); while (total >> 16) total = (total & 65535) + (total >> 16); return ~total & 65535; }
const VMAC = '02:aa:10:20:00:01', CMAC = '02:aa:10:42:00:01';
function ethernet(src, dst, type, payload) { return concat(mac(dst), mac(src), u16(type), payload); }
function arp(reply) {
  const srcMac = reply ? CMAC : VMAC, srcIp = reply ? '10.0.0.42' : '10.0.0.20';
  const dstMac = reply ? VMAC : '00:00:00:00:00:00', dstIp = reply ? '10.0.0.20' : '10.0.0.42';
  return ethernet(srcMac, reply ? VMAC : 'ff:ff:ff:ff:ff:ff', 0x0806,
    concat(u16(1), u16(0x0800), [6, 4], u16(reply ? 2 : 1), mac(srcMac), ip(srcIp), mac(dstMac), ip(dstIp)));
}
function ipv4(protocol, payload, reply = false) {
  const from = reply ? '10.0.0.42' : '10.0.0.20', to = reply ? '10.0.0.20' : '10.0.0.42';
  const header = concat([0x45, 0], u16(20 + payload.length), u16(1), u16(0x4000), [64, protocol], [0, 0], ip(from), ip(to));
  const sum = checksum(header); header[10] = sum >> 8; header[11] = sum & 255;
  return ethernet(reply ? CMAC : VMAC, reply ? VMAC : CMAC, 0x0800, concat(header, payload));
}
function icmp(reply) {
  const payload = concat([reply ? 0 : 8, 0, 0, 0], u16(1), u16(1), new TextEncoder().encode('NOVA-LAB'));
  const sum = checksum(payload); payload[2] = sum >> 8; payload[3] = sum & 255;
  return ipv4(1, payload, reply);
}
function udp(port) {
  const data = new TextEncoder().encode('NOVA SYNTHETIC VIDEO');
  return ipv4(17, concat(u16(46000), u16(port), u16(data.length + 8), [0, 0], data), true);
}
export function createPcap(port = 5600) {
  const frames = [arp(false), arp(true), icmp(false), icmp(true), udp(port), udp(port)];
  const total = 24 + frames.reduce((n, v) => n + 16 + v.length, 0);
  const bytes = new Uint8Array(total); const view = new DataView(bytes.buffer);
  view.setUint32(0, 0xa1b2c3d4, true); view.setUint16(4, 2, true); view.setUint16(6, 4, true);
  view.setUint32(16, 65535, true); view.setUint32(20, 1, true);
  let at = 24;
  frames.forEach((frame, i) => { view.setUint32(at, 1700000000, true); view.setUint32(at + 4, [0, 3000, 28000, 32000, 140000, 170000][i], true);
    view.setUint32(at + 8, frame.length, true); view.setUint32(at + 12, frame.length, true); bytes.set(frame, at + 16); at += 16 + frame.length; });
  return bytes;
}

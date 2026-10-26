export const isWifiMission = id => ['nova-wifi', 'sylvanas-wifi', 'samus-wifi', 'jenny-wifi'].includes(id);
export function initialWifi(id) {
  return { radio: id !== 'sylvanas-wifi', connected: id !== 'sylvanas-wifi', ssid: id === 'samus-wifi' ? 'Rapscallion-Guest' : 'Rapscallion-Crew',
    dnsSaved: id === 'nova-wifi' ? '192.0.2.99' : '192.0.2.53', dnsApplied: id === 'nova-wifi' ? '192.0.2.99' : '192.0.2.53',
    bandSaved: id === 'jenny-wifi' ? 'bg' : 'a', bandApplied: id === 'jenny-wifi' ? 'bg' : 'a' };
}
const observe = (s, value) => { if (!s.inspected.includes(value)) s.inspected.push(value); };
function change(s, property, value) { if (s.wifi[property] !== value) { s.wifi[property] = value; s.changes++; s.verified = false; } }
const onCrew = w => w.radio && w.connected && w.ssid === 'Rapscallion-Crew';
const lossFree = w => onCrew(w) && w.bandApplied === 'a';
const resolves = w => onCrew(w) && w.dnsApplied === '192.0.2.53';
export function wifiCommand(s, raw) {
  const w = s.wifi; const c = raw.replace(/^sudo /, ''); let match;
  if (['nmcli device status', 'nmcli dev status'].includes(c)) {
    observe(s, 'wireless-device'); return `DEVICE  TYPE  STATE         CONNECTION\nwlp2s0  wifi  ${w.connected && w.radio ? 'connected     ' : 'unavailable   '}${w.connected && w.radio ? (onCrew(w) ? 'Rapscallion Crew' : 'Rapscallion Guest') : '--'}\nlo      loopback unmanaged  --`;
  }
  if (c === 'nmcli radio wifi') { observe(s, 'radio'); return w.radio ? 'enabled' : 'disabled'; }
  if (c === 'rfkill list') { observe(s, 'radio'); return `0: phy0: Wireless LAN\n    Soft blocked: ${w.radio ? 'no' : 'yes'}\n    Hard blocked: no`; }
  if (c === 'nmcli radio wifi on' || c === 'nmcli radio wifi off') {
    const enable = c.endsWith('on'); change(s, 'radio', enable); change(s, 'connected', enable);
    if (enable) { change(s, 'ssid', 'Rapscallion-Crew'); change(s, 'dnsApplied', w.dnsSaved); change(s, 'bandApplied', w.bandSaved); }
    return enable ? 'Wi-Fi radio enabled. Saved autoconnect profile Rapscallion Crew activated.' : 'Wi-Fi radio disabled.';
  }
  if (/^nmcli (connection|con) show --active$/.test(c)) {
    observe(s, 'active-profile'); return `NAME               UUID                                  TYPE  DEVICE\n${w.connected && w.radio ? `${onCrew(w) ? 'Rapscallion Crew ' : 'Rapscallion Guest'} 8d14be03-0000-4000-8000-000000000003  wifi  wlp2s0` : '(no active wireless connection)'}`;
  }
  if (/^nmcli (connection|con) show ["']rapscallion crew["']$/.test(c)) {
    observe(s, 'saved-profile'); return `connection.id:                    Rapscallion Crew\nconnection.autoconnect:           yes\n802-11-wireless.ssid:              Rapscallion-Crew\n802-11-wireless.band:              ${w.bandSaved}\nipv4.method:                      auto\nipv4.dns:                         ${w.dnsSaved}\nipv4.ignore-auto-dns:             yes`;
  }
  if (c === 'nmcli device show wlp2s0' || c === 'nmcli dev show wlp2s0') {
    observe(s, 'wireless-device'); return `GENERAL.DEVICE:     wlp2s0\nGENERAL.STATE:      ${w.connected && w.radio ? '100 (connected)' : '20 (unavailable)'}\nGENERAL.CONNECTION:${w.connected && w.radio ? (onCrew(w) ? ' Rapscallion Crew' : ' Rapscallion Guest') : ' --'}\nIP4.ADDRESS[1]:     ${w.connected && w.radio ? (onCrew(w) ? '192.0.2.20/24' : '198.51.100.50/24') : '--'}\nIP4.GATEWAY:        ${w.connected && w.radio ? (onCrew(w) ? '192.0.2.1' : '198.51.100.1') : '--'}\nIP4.DNS[1]:         ${w.dnsApplied}`;
  }
  if (c === 'nmcli -g ip4.dns device show wlp2s0') { observe(s, 'resolver'); return w.dnsApplied; }
  if (c === 'ip -br address' || c === 'ip addr' || c === 'ip -br addr') {
    observe(s, 'wireless-device'); return `lo      UNKNOWN  127.0.0.1/8\nwlp2s0  ${w.radio && w.connected ? `UP       ${onCrew(w) ? '192.0.2.20/24' : '198.51.100.50/24'}` : 'DOWN'}`;
  }
  if (c === 'ip route' || c === 'ip route show') {
    observe(s, 'route'); return w.radio && w.connected ? (onCrew(w) ? 'default via 192.0.2.1 dev wlp2s0\n192.0.2.0/24 dev wlp2s0 scope link src 192.0.2.20' : 'default via 198.51.100.1 dev wlp2s0\n198.51.100.0/24 dev wlp2s0 scope link src 198.51.100.50') : '(no wireless routes)';
  }
  if (c === 'nmcli device wifi list' || c === 'nmcli dev wifi list' || c === 'nmcli -f in-use,ssid,chan,rate,signal device wifi list') {
    observe(s, 'scan'); if (!w.radio) return 'Error: Scanning not allowed while device is unavailable. Check the Wi-Fi radio.';
    return `IN-USE  SSID                CHAN  RATE        SIGNAL  SECURITY\n${onCrew(w) && w.bandApplied === 'bg' ? '*' : ' '}       Rapscallion-Crew     1     54 Mbit/s   42      WPA2\n${onCrew(w) && w.bandApplied === 'a' ? '*' : ' '}       Rapscallion-Crew     36    540 Mbit/s  92      WPA2\n${w.ssid === 'Rapscallion-Guest' ? '*' : ' '}       Rapscallion-Guest    44    540 Mbit/s  87      WPA2`;
  }
  if (c === 'iw dev wlp2s0 link') {
    observe(s, 'link-quality'); return w.radio && w.connected ? `Connected to 02:52:41:50:53:01 (on wlp2s0)\n    SSID: ${w.ssid}\n    freq: ${w.bandApplied === 'a' ? '5180' : '2412'}\n    signal: ${w.bandApplied === 'a' ? '-43' : '-74'} dBm\n    tx bitrate: ${w.bandApplied === 'a' ? '433.3' : '6.0'} MBit/s` : 'Not connected.';
  }
  if ((match = c.match(/^nmcli (?:connection|con) (?:modify|mod) ["']rapscallion crew["'] ipv4\.dns ["']?(192\.0\.2\.(?:53|99))["']?$/))) {
    change(s, 'dnsSaved', match[1]); return 'Saved DNS setting updated. Apply it to the active connection before testing.';
  }
  if ((match = c.match(/^nmcli (?:connection|con) (?:modify|mod) ["']rapscallion crew["'] (?:802-11-wireless|wifi)\.band (a|bg)$/))) {
    change(s, 'bandSaved', match[1]); return 'Saved wireless band updated. Reactivate the profile to reassociate.';
  }
  if (c === 'nmcli device reapply wlp2s0' || c === 'nmcli dev reapply wlp2s0') {
    if (!w.radio || !w.connected) return 'Error: device is not connected.';
    change(s, 'dnsApplied', w.dnsSaved); return 'DNS settings reapplied. Wireless band changes require profile reactivation.';
  }
  if ((match = c.match(/^nmcli (?:connection|con) up ["']rapscallion (crew|guest)["']$/))) {
    if (!w.radio) return 'Error: no suitable device found; wireless radio is disabled.';
    change(s, 'connected', true); change(s, 'ssid', match[1] === 'crew' ? 'Rapscallion-Crew' : 'Rapscallion-Guest');
    change(s, 'dnsApplied', w.dnsSaved); change(s, 'bandApplied', w.bandSaved);
    return `Connection successfully activated: Rapscallion ${match[1] === 'crew' ? 'Crew' : 'Guest'}.`;
  }
  if (c === 'getent hosts archive.rapscallion.test') {
    observe(s, 'name-resolution'); const passed = resolves(w); s.tests.push({ test: 'Resolve archive.rapscallion.test', passed });
    return passed ? '203.0.113.25  archive.rapscallion.test' : '(no matching hosts; exit status 2)';
  }
  if ((match = c.match(/^ping(?: -c ([1-5]))? ([0-9.]+|archive\.rapscallion\.test)$/))) {
    observe(s, 'reachability'); const target = match[2]; const count = Number(match[1] || 3);
    if (target === 'archive.rapscallion.test' && !resolves(w)) { s.tests.push({ test: `ping ${target}`, passed: false }); return `ping: ${target}: Name or service not known`; }
    const accessible = onCrew(w) && ['192.0.2.1', '203.0.113.25', 'archive.rapscallion.test'].includes(target);
    const passed = accessible && lossFree(w); const lost = accessible && !passed ? 1 : accessible ? 0 : count;
    s.tests.push({ test: `ping ${target}`, passed });
    return `PING ${target}\n${accessible ? `64 bytes from ${target}: icmp_seq=1 ttl=64 time=${passed ? '2.1' : '124.0'} ms` : 'Destination Host Unreachable'}\n\n${count} packets transmitted, ${count - lost} received, ${Math.round(lost / count * 100)}% packet loss`;
  }
  return 'Command not modeled on this crew terminal. Type help. Connection names containing spaces need quotes, for example "Rapscallion Crew".';
}
export function wifiChecks(s) {
  const w = s.wifi;
  const common = [['Wireless radio enabled', w.radio], ['Associated to Rapscallion-Crew', onCrew(w)]];
  if (s.id === 'nova-wifi') return [...common, ['Approved resolver saved', w.dnsSaved === '192.0.2.53'], ['Approved resolver applied', w.dnsApplied === '192.0.2.53'], ['Archive name resolves', resolves(w)]];
  if (s.id === 'jenny-wifi') return [...common, ['Approved band a saved', w.bandSaved === 'a'], ['Active link reassociated on 5 GHz', w.bandApplied === 'a'], ['Repeated peer test has zero loss', lossFree(w)]];
  return [...common, ['Approved crew address and gateway', onCrew(w)], ['Crew service reachable', lossFree(w)]];
}
export function wifiEquipment(s) {
  const w = s.wifi;
  return [
    { id: 'control', name: 'Crew terminal', type: 'wlp2s0 / WI-FI', status: w.radio && w.connected ? 'ASSOCIATED' : 'UNAVAILABLE', detail: `Radio: ${w.radio ? 'enabled' : 'disabled'}\nSSID: ${w.connected ? w.ssid : 'none'}\nProfile DNS: ${w.dnsSaved}\nApplied DNS: ${w.dnsApplied}\nSaved band: ${w.bandSaved}\nActive band: ${w.bandApplied === 'a' ? '5 GHz' : '2.4 GHz'}` },
    { id: 'ap', name: 'Crew access point', type: 'DUAL-BAND / WPA2', status: 'UP', detail: 'Approved SSID: Rapscallion-Crew\n2.4 GHz channel 1: signal 42\n5 GHz channel 36: signal 92\nGuest network is isolated. No access-point repair is needed.' },
    { id: 'peer', name: 'Ship services', type: 'DNS / FLIGHT DATA', status: 'UP', detail: 'Crew gateway: 192.0.2.1\nApproved resolver: 192.0.2.53\nArchive: 203.0.113.25\narchive.rapscallion.test\nAll addresses and frames are fictional.' }
  ];
}

export const MANUAL = [
  { id: 'link-triage', title: 'Link triage / Interface DOWN or no carrier', icon: 'network',
    lead: 'Check administrative state, carrier, addressing, and route selection before changing configuration.',
    sections: [
      ['Find the device from the approved address', 'ip -br address\nExample row: test0@if7  DOWN  198.51.100.1/30\nip link show dev test0', 'Match the address and prefix to the work order. In this virtual Ethernet example, test0 is the device name and @if7 is the peer interface index. Pass only test0 to the next command. On a physical host, the interface could be named enp0s8 or something else. Use the name your machine reports.'],
      ['Read the flags', 'ip link show dev test0\nExample flags: <BROADCAST,MULTICAST,UP,LOWER_UP>', 'The UP flag inside angle brackets means the interface is administratively enabled. If UP is absent, it is disabled. If UP is present and LOWER_UP is absent on an Ethernet link, investigate carrier, the peer, or the virtual connection. The brief state column reports operational state. An IP address can still appear on a disabled interface.'],
      ['Network is unreachable / No route', 'ip route\nip route get 198.51.100.2', 'This error means the kernel cannot find a usable route to that destination. Compare the link flags, address and prefix, and connected route. A missing route can also result from a wrong prefix or a missing gateway on a routed network.'],
      ['Change one thing and retest', 'sudo ip link set dev test0 up\nping -c 3 198.51.100.2', 'This example enables a fictional interface after confirming it was administratively disabled. Substitute the device you identified and the approved peer. In a namespace lab, insert -n and the namespace name after ip. To run ping there, use sudo ip netns exec followed by the namespace name and the ping command. Recheck link state and routing before retesting the peer.']
    ], url: 'https://man7.org/linux/man-pages/man8/ip-link.8.html' },

  { id:'vim', title:'Vim / Change the right file', icon:'terminal',
    lead:'First identify what the file controls. Back up, edit one setting, inspect the diff, apply only where required and verify behavior.',
    sections:[
      ['Know the consumer', '/etc/hosts\n/etc/NetworkManager/system-connections/*.nmconnection\n/etc/rapscallion/relay.conf', 'Hosts files map names to addresses. A NetworkManager keyfile configures a connection. The relay file is a fictional application endpoint, not a standard RHEL file. Knowing Vim does not identify which setting should change.'],
      ['Backup and compare', 'sudo cp /etc/hosts /etc/hosts.bak\nsudo vim /etc/hosts\nsudo diff -u /etc/hosts.bak /etc/hosts', 'Take the backup before changing anything. Diff exit status 1 normally means the files differ; it is not automatically a failed repair. Inspect what changed. Academy models one original .bak; real work may need a timestamped backup to retain earlier versions.'],
      ['Modes and exact keys', 'i → type your edit → Escape → :wq → Enter\nEscape → :q! → Enter', 'i enters Insert mode. Escape returns to Normal. Type the colon as part of :wq. :w writes; :wq writes and quits; :q! discards only edits since the last write. u in Normal mode undoes a change. The browser trainer models these basics with a normal text area during Insert; the real VM has full Vim.'],
      ['RHEL 9 keyfile lifecycle', 'sudo nmcli connection reload\nnmcli connection show "Academy Link"\nsudo nmcli connection up "Academy Link"\nip -br address', 'RHEL 9 normally uses keyfiles; older installations can still have legacy ifcfg profiles. Root owns keyfiles and mode 600 restricts access. A manual edit needs loading before activation. Loading alone does not update the active device. Activation can interrupt its link; the Academy simulator uses only fictional lab0.'],
      ['Verify the right outcome', 'getent hosts relay.rapscallion.test\nping -c 3 relay.rapscallion.test\nsystemctl status relay-watch\njournalctl -u relay-watch -n 20', 'getent follows the system lookup configuration; dig queries DNS instead of the local hosts file. Check the interface after profile changes and application logs after service changes. Restore the backup and reapply if the result is wrong.']
    ],url:'https://vimhelp.org/usr_02.txt.html'},
  { id: 'wifi', title: 'Crew Wi-Fi / Check the right connection', icon: 'radio',
    lead: 'Association, addressing, name resolution and radio quality are separate observations. The four crew requests exercise each one.',
    sections: [
      ['Local radio and association', 'nmcli radio wifi\nrfkill list\nnmcli device status\nnmcli device wifi list', 'A disabled local radio can prevent scanning and association while the shared access point remains healthy.'],
      ['Saved and active profiles', 'nmcli connection show --active\nnmcli connection show "Rapscallion Crew"\nnmcli device show wlp2s0', 'Connection names with spaces require quotes. A saved profile can differ from the settings currently applied to the interface.'],
      ['IP versus name resolution', 'ping 203.0.113.25\ngetent hosts archive.rapscallion.test', 'If a working IP path and failed name lookup agree, inspect the resolver before changing routes or restarting the access point. The .test name and addresses here are fictional.'],
      ['Applying a controlled change', 'sudo nmcli device reapply wlp2s0\nsudo nmcli connection up "Rapscallion Crew"', 'DNS can be reapplied to an active connection. A wireless band change requires reassociation. These are simulator exercises; the VirtualBox VM mission does not pretend its Ethernet adapters are Wi-Fi radios.'],
      ['Link quality', 'iw dev wlp2s0 link\nping -c 5 192.0.2.1', 'Compare the actual band and signal with scan results and the approved local baseline, then repeat the same peer test after one justified change.']
    ], url: 'https://networkmanager.pages.freedesktop.org/NetworkManager/NetworkManager/nmcli.html' },
  { id: 'rhel', title: 'RHEL / Read the machine', icon: 'terminal',
    lead: 'State, configuration and evidence are different things. Compare what is running with the approved baseline.',
    sections: [
      ['First look', 'ip -br address\nip link show dev enp0s8', 'The brief view lists addresses and operational state. Use the detailed link flags to check administrative UP and carrier (LOWER_UP).'],
      ['NetworkManager', 'nmcli device status\nnmcli connection show\nnmcli device show enp0s8\nsudo nmcli connection up "Approved Profile" ifname enp0s8', 'A device is a network interface. A connection is a NetworkManager profile. The last line is an example that activates the approved profile on a specific device after you have identified both. ip link set changes the kernel link state directly. NetworkManager activation also applies the profile’s settings. Use the authorized procedure for the host and protect any management path you rely on.'],
      ['The route actually used', 'ip route\nip route get 203.0.113.20', 'Linux chooses the most specific matching prefix first. Inspect the selected next hop rather than guessing from the default route.'],
      ['Services and access', 'systemctl status telemetry\njournalctl -u telemetry -n 20\nls -l /srv/academy/telemetry.cfg', 'The service account needs access through every directory in the path and to the file. Read logs before changing permissions.']
    ], url: 'https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_networking/index' },
  { id: 'minicom', title: 'Minicom / Serial console access to a switch', icon: 'terminal',
    lead: 'Need to know: minicom -s opens the setup menu on your Linux computer so you can configure a serial console connection to a switch or router. It does not require the switch to have a reachable IP address.',
    sections: [
      ['Open setup on the Linux host', 'minicom -s', 'The -s option means setup. Run this in the terminal of the Linux machine connected to the console cable. If local permissions require elevated access, use sudo minicom -s. Commands entered after connecting go to the device console, not your Linux shell.'],
      ['Identify the serial adapter', 'ls -l /dev/serial/by-id/\nls -l /dev/ttyUSB* /dev/ttyACM*', 'Look for the console adapter on the connected Linux host. USB serial adapters often appear as ttyUSB or ttyACM devices; a missing match is possible. These are examples, not the confirmed port for your switch. In a VM, the adapter must be attached to that VM.'],
      ['Match the switch console settings', 'Serial port setup → Serial device\nBps/Par/Bits → baud rate, parity, data bits, stop bits\nHardware Flow Control / Software Flow Control', 'Choose the detected device and match the manufacturer’s console requirements. Baud rates such as 9600 or 115200 and 8N1 are common examples, not confirmed settings for your switch. 8N1 means eight data bits, no parity and one stop bit. Flow-control settings must also match.'],
      ['Save and connect', 'Save setup as dfl → Exit', 'Save setup as dfl preserves the Minicom defaults. Exit leaves setup and enters the terminal session; Exit from Minicom closes the program instead. Press Enter to check for the switch prompt. Saving Minicom settings does not save the switch configuration.'],
      ['Help, exit and troubleshoot', 'Ctrl+A, release, then Z → help\nCtrl+A, release, then O → setup\nCtrl+A, release, then Q → quit without modem reset', 'These use the default command prefix. Blank screen: check cable, device selection, switch power and console settings. Garbled text: compare baud and framing. Output but no response to typing: inspect flow control and cable compatibility. Permission errors belong to the Linux host; do not change switch settings to fix them.']
    ], url: 'https://man7.org/linux/man-pages/man1/minicom.1.html' },
  { id: 'vehicle-link', title: 'Vehicle link / LOS, BLOS and switch-port triage', icon: 'network',
    lead: 'Vehicle communications fault? Establish power, local physical link, switchport state, addressing and routing before blaming the beyond-line-of-sight path. These are generic, sanitized diagnostics, not vendor-specific Starshield commands.',
    sections: [
      ['Brief the fault before touching hardware', 'Reported symptom: vehicle cannot reach approved test peer\nKnown-good: alternate local console or management access\nBoundary: do not change operational radio, satellite, keys or protected network configuration', 'Confirm which path is failing: local Ethernet, vehicle LAN, line-of-sight radio, BLOS terminal, or the remote service. Record the approved test target and baseline. Separate the management path from the path under test.'],
      ['Establish power and physical evidence', 'Power / status LEDs -> cable / connector -> link LEDs -> switch interface', 'A powered console does not mean its upstream link is healthy. Inspect approved status indicators and physical seating first. Do not infer satellite registration from a switch link light. Escalate terminal alarms using the equipment-specific approved procedure.'],
      ['Read the switchport without changing it', 'show interfaces gigabitEthernet 0/7\nshow interfaces status\nshow vlan brief\nshow interfaces gigabitEthernet 0/7 switchport', 'These are Cisco-style examples; syntax varies by platform. Identify the actual port from an approved diagram or console. Read line protocol, input errors, CRC counters, speed, duplex, operational VLAN and traffic counters. Compare with a known-good port.'],
      ['Read a RHEL endpoint', 'nmcli device status\nip -br address\nip route\nip route get 203.0.113.20\nping -c 3 203.0.113.20', 'Use a fictional documentation address only as an example: substitute the authorized test destination. A working local interface is not proof of an end-to-end path; a failed remote ping alone does not pinpoint the radio. Check the selected route and whether the peer is expected to answer ICMP.'],
      ['If IP access is unknown, use the console', 'minicom -s\nPress Enter after establishing serial connection', 'A micro-USB or serial console can reveal the switch configuration without a known IP. Identify the host serial device and approved console settings first. No prompt? Confirm power, cable, correct serial adapter, framing and flow control. See Minicom in this manual.'],
      ['One hypothesis, one test, one record', 'Observation -> hypothesis -> safe test -> result -> next boundary', 'Example: the switch reports interface down/down. Hypothesis: the local physical segment is absent. Verify power and cabling before editing VLAN or routes. If local link and VLAN pass but the remote application still fails, capture authorized evidence and escalate to the responsible link owner instead of making blind changes.']
    ] },
  { id: 'switching', title: 'Switches / Follow the port', icon: 'network',
    lead: 'A green link light does not validate VLAN membership, Layer 3 reachability or application traffic.',
    sections: [
      ['Physical evidence', 'show interfaces gigabitEthernet 0/7', 'Read status, line protocol, negotiated speed/duplex and error counters. Increasing CRC errors support a link-quality investigation; zero CRC errors do not prove the whole path.'],
      ['Layer 2 membership', 'show vlan brief\nshow interfaces gigabitEthernet 0/7 switchport', 'Confirm operational access/trunk mode and membership against the approved diagram. Commands vary by switch model and software.'],
      ['One controlled repair', 'configure terminal\ninterface gigabitEthernet 0/7\nswitchport access vlan 20\nend', 'This example selects one synthetic access port and assigns the approved VLAN. It is not a blanket production prescription. Verify traffic before saving.'],
      ['Persistence', 'write memory', 'Running configuration and startup configuration have different jobs. Verify the repair, then preserve it.']
    ], url: 'https://www.cisco.com/c/en/us/support/switches/catalyst-9000-series-switches/series.html' },
  { id: 'ovs', title: 'Open vSwitch / Trace the bridge', icon: 'link',
    lead: 'A host interface can exist without participating in the virtual switch you expect.',
    sections: [
      ['Inventory', 'ovs-vsctl show\novs-vsctl list-br\novs-vsctl list-ports br-lab', 'Compare bridges, ports and interfaces with the lab diagram. A port can contain one interface or multiple bonded interfaces.'],
      ['Host perspective', 'ip -br link', 'This shows Linux interfaces. It does not replace the OVS database’s membership view.'],
      ['Restore the attachment', 'sudo ovs-vsctl add-port br-lab tap-sensor', 'In the Academy scenario, the existing synthetic tap belongs to br-lab. The management bridge stays separate.']
    ], url: 'https://www.openvswitch.org/support/dist-docs/ovs-vsctl.8.html' },
  { id: 'packets', title: 'Wireshark / Ask a packet', icon: 'radio',
    lead: 'A capture answers questions at the point where it was collected. Always keep the observation point in mind.',
    sections: [
      ['ARP and reachability', 'arp\nicmp', 'ARP maps local IPv4 addresses to Ethernet addresses. ICMP echo/reply demonstrates that exchange, not application health.'],
      ['Follow the flow', 'udp\nudp.port == 5600\nip.addr == 10.0.0.42', 'Display filters narrow visible frames; capture filters decide what gets recorded. These examples are display filters.'],
      ['Hands on', 'Download the mission PCAP → Open in Wireshark → Select a frame', 'Camera and ARP missions export valid, entirely synthetic PCAP files. Expand Ethernet, IPv4 and UDP or ARP to compare the exact fields with the mission evidence.']
    ], url: 'https://www.wireshark.org/docs/wsug_html_chunked/ChapterWork.html' },
  { id: 'virtualbox', title: 'VirtualBox / Know the boundary', icon: 'shield',
    lead: 'The Academy connection already works. Keep the management path separate from a fault injection.',
    sections: [
      ['Verified management path', 'ssh -p 2224 jamean@127.0.0.1', 'Windows localhost forwards to the designated Vehicle Node. NAT enp0s3 and the internal-network enp0s8 are protected.'],
      ['Training isolation', 'sudo ip netns list\nsudo ip -n nn-academy -br address', 'The real mission creates a veth pair inside two owned namespaces. It does not unplug a VirtualBox adapter or modify a NetworkManager profile.'],
      ['Cannot open network namespace / No such file or directory', 'sudo ip netns list', 'If SSH works and nn-academy is missing, check Real Lab in the Academy. The VM can accept SSH while the mission is absent. An expired 45-minute attempt is cleaned up by the VM. Use Deploy real VM or Redeploy training lab in the Academy, then rerun this check in your existing SSH session.']
    ], url: 'https://www.virtualbox.org/manual/ch06.html' },
  { id: 'method', title: 'Troubleshooting / Work the evidence', icon: 'compass',
    lead: 'Observe → form a hypothesis → make one controlled change → verify → document.',
    sections: [
      ['Write a useful hypothesis', 'Observation: peer ping fails; interface is DOWN.\nHypothesis: administrative link state prevents egress.\nTest: bring only the training link UP and repeat peer test.', 'A useful hypothesis predicts an observable result and limits what you change.'],
      ['OSI as a tool', '1 Physical → 2 Data link → 3 Network → 4 Transport\n5 Session → 6 Presentation → 7 Application', 'Use layers to organize evidence. They are not a rule that every incident requires seven separate fixes.'],
      ['After action', 'What failed? What proved it? What changed? What verified recovery?', 'Record the reasoning, not only the command that happened to work.'],
      ['Python alongside the watch', 'Parse a synthetic log → summarize failures → report evidence', 'Continue your separate VS Code Python lessons. Academy’s mission definitions and verifiers are modular so a later Python track can reuse progression without resetting it.']
    ] }
];

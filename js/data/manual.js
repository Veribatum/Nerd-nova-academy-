export const MANUAL = [
  { id: 'rhel', title: 'RHEL / Read the machine', icon: 'terminal',
    lead: 'State, configuration and evidence are different things. Compare what is running with the approved baseline.',
    sections: [
      ['First look', 'ip -br address', 'Shows addresses and current interface state. UP is administrative; LOWER_UP indicates carrier.'],
      ['NetworkManager', 'nmcli device status\nnmcli connection show\nnmcli device show enp0s8', 'A device is a network interface. A connection is a saved NetworkManager profile. Read them before modifying them. The first real Academy mission uses iproute2 inside a namespace; it does not modify your saved profiles.'],
      ['The route actually used', 'ip route\nip route get 203.0.113.20', 'Linux chooses the most specific matching prefix first. Inspect the selected next hop rather than guessing from the default route.'],
      ['Services and access', 'systemctl status telemetry\njournalctl -u telemetry -n 20\nls -l /srv/academy/telemetry.cfg', 'The service account needs access through every directory in the path and to the file. Read logs before changing permissions.']
    ], url: 'https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_networking/index' },
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
      ['Recovery', 'Reset lab in Academy', 'Reset deletes the owned training namespaces. The VM also checks the lease every minute and cleans up after 45 minutes. The Clean Baseline snapshot remains your broader manual fallback; the website never restores snapshots automatically.']
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

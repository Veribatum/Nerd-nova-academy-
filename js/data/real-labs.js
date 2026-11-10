export const REAL_LABS = {
 'switch-watch': {
  tool:'Cisco Packet Tracer', status:'REAL-TOOL PRACTICE / MANUAL EVIDENCE', setup:'Use your installed Packet Tracer on Windows. This runs in Packet Tracer, not in the browser; Academy does not yet read or grade its configuration.',
  steps:[
   ['Create the network','In a new Packet Tracer file add one 2960 switch and three PCs. Connect PC0 to Fa0/7, PC1 to Fa0/8, PC2 to Fa0/9 with copper straight-through cables.'],
   ['Address the PCs','PC0 = 192.0.2.10/24, PC1 = 192.0.2.20/24, PC2 = 192.0.2.30/24 (Desktop → IP Configuration, mask 255.255.255.0). No default gateway is needed on this same-VLAN test.'],
   ['Seed the fault in your own lab','On the switch CLI create VLAN 10 and VLAN 20. Configure Fa0/8 and Fa0/9 as access VLAN 20, but Fa0/7 as access VLAN 10. This is an intentionally faulty isolated topology, not a production setting.'],
   ['Investigate','Ping PC1 from PC0. Examine show interfaces status, show vlan brief, and show interfaces fastEthernet 0/7 switchport. Compare against Fa0/8. Interpret evidence before making a change.'],
   ['Repair and verify','Make one justified change to Fa0/7. Retest PC0 to PC1 and PC1 to PC2. Inspect port membership again and, after successful verification, use copy running-config startup-config.'],
   ['Report the evidence','Write the initial symptom, two diagnostic commands, your hypothesis, the change, and test results in the Academy journal. No automatic Packet Tracer verification exists yet.']
  ],note:'Packet Tracer emulates a Cisco CLI with realistic commands, but it is not a physical switch or general-purpose RHEL terminal.'
 },
 'rhel-link':{tool:'VirtualBox / RHEL 9',status:'ACTUAL VM / VERIFIED BY ACADEMY',setup:'Start the existing Windows companion. The current verified live backend supports Lost at Launch only.',steps:[['Start the lab','Run companion/start-companion.bat and use Deploy real VM in Academy.'],['Inspect','Use actual ip, ping, and namespace commands in the designated isolated RHEL VM.'],['Protect','Do not change the management or NAT interfaces. Diagnose and repair only the provisioned training link.'],['Verify','Return to Academy for receipt-based real VM verification.']]},
 'cam':{tool:'Wireshark',status:'REAL WIRESHARK / SYNTHETIC PACKETS',setup:'Use the installed Wireshark application. Academy exports a synthetic PCAP; it does not capture your physical network.',steps:[['Export','Open the simulation packet analyzer and download the PCAP.'],['Investigate','Open it in Wireshark; filter udp and inspect destination ports. Compare against ss -uln in the simulator.'],['Explain','Describe why ICMP ping can work when UDP video fails.']]},
 'arp':{tool:'Wireshark',status:'REAL WIRESHARK / SYNTHETIC PACKETS',setup:'Use the installed Wireshark application to analyze the mission PCAP.',steps:[['Export','Download the synthetic PCAP from the packet analyzer.'],['Inspect','Use the arp display filter. Compare the replacement camera MAC with the viewer neighbor table.'],['Explain','Record what the evidence proves and what it does not.']]}
};
export const realLabFor=id=>REAL_LABS[id]||null;

# Nerd Nova Academy — Real Tool Overhaul

Status: November 10, 2026. This document records implementation truth, not marketing claims.

## Goal
Academy is a mission-control interface for real technical practice, with safe desktop tools as the source of truth. A browser terminal simulation is a mobile/offline fallback, never evidence of a configured host or switch.

## Current integration inventory
- **RHEL / VirtualBox:** Only mission `rhel-link` has a deployed isolated network namespace and receipt-based VM verification via Windows companion. Live execution and verification for the remaining missions are NOT implemented.
- **Cisco Packet Tracer:** External hands-on lab instructions exist for `switch-watch`. Academy cannot currently create/open Packet Tracer projects or inspect/grade its running configuration. No simulated CLI output should be presented as a real switch response.
- **Wireshark:** Synthetic PCAP export exists for the packet-focused simulator missions. Users open captures in installed Wireshark; this is actual packet-analysis work on fabricated safe data, not real packet capture from a network.
- **Phone:** Browser simulations, instructions, field manual and synced progress where configured. A phone cannot directly run or control Windows-only desktop apps via GitHub Pages.

## Required next phases (in implementation order)

### Phase A — Training clarity (partial)
- Clearly label each mission: simulator, real VM with verified receipt, or external software with manual evidence.
- Supply a precise setup walkthrough for each external tool and scenario.
- Make every mission link straight to contextual command help, with command, purpose, sample output fields, interpretation, safe next test.
- Do not award verified-real-lab XP based on a button with no machine evidence.
- **Acceptance:** A first-time learner can identify which real program to open and tell which commands execute there.

### Phase B — Reliable external lab launch
- Provide versioned per-mission lab manifests for OS/software requirements, safe topology, task data, expected results and cleanup.
- Generate/import isolated lab material where supported, without modifying existing RHEL/MANTA development VMs.
- Make companion capability detection truthful: show installed, configured and verifiable separately.
- Package companion launcher with documented Windows startup and safe error handling.
- **Acceptance:** User can launch the right exercise and return after closing the app without losing journal or progress.

### Phase C — Real switch tool chain
- Ship a **tested Packet Tracer topology/activity**, ideally `.pkt` or `.pka`, rather than just a written build recipe. Packet Tracer's closed project format means validate file creation/opening using the installed desktop application; do not invent a file.
- Study documented supported Packet Tracer extensions or supported activity assessment; prefer deterministic file/activity export and a validated evidence channel. Never claim local browser access to Packet Tracer.
- Where capabilities or app APIs block direct integration, define safe manual artifact/evidence submission, which must be labeled *manual*.
- **Acceptance:** Diagnose a VLAN, interface status or trunk fault using Packet Tracer's own CLI; verify at least two endpoint paths.

### Phase D — RHEL and packet truth
- Expand companion with per-mission isolated sandbox provisioning and receipts (unique ID, time, checks, protected interface baseline, cleanup), not unrestricted host shell execution.
- Add real RHEL training for `nmcli`, `ovs-vsctl`, routing, services, permissions, and packet capture inside dedicated training namespaces/VM clones.
- Continue PCAP analysis in Wireshark and import the student's own observations safely.
- **Acceptance:** Terminal commands produce actual RHEL results; verified completion requires machine checks and preserves management networking.

### Phase E — Curriculum and skill growth
- Progression: observe -> interpret -> hypothesize -> change one thing -> verify -> document.
- Progressively less guidance; hints reveal concepts before exact solutions.
- Unknown symptoms and multiple plausible causes; not one hard-coded command for every mission.
- Separate simulation achievements from real-verified skill qualifications; migrate progress without resets.
- Expand sanitized job-relevant equipment workflows: switch serial console, LOS/BLOS path isolation, virtual switching, camera/VLAN troubleshooting.

## Safety and confidentiality
Use only RFC 5737 documentation addresses or disposable lab addresses in shared materials. Never commit operational IPs, passwords, device configs, routing tables, keys, screenshots or classified details. Do not run training fault injection on production/military equipment. Treat uploaded work files and sanitized notes distinctly from reusable lab examples.

## Release checks
1. JS imports resolve and app boots.
2. Existing save keys, local backup and cloud merge still work.
3. Mission 03 briefing labels Packet Tracer as external manual practice.
4. Switch command guide is findable by `switch`, `VLAN`, `switchport`.
5. Clicking Mission command guide inside mission 03 opens switch-specific explanations.
6. Real VM verification remains restricted to mission 01.
7. Work mode still hides private/gallery images.
8. Browser mobile mode remains available.

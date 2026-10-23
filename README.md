# Nerd Nova Academy

Sci-fi networking learning game for mobile and desktop. Deployed directly from GitHub Pages (`main` / `root`).

## Current release: 0.2

- **Mission Control:** upgraded game-like responsive UI with Nova-themed mission briefing, XP, ranks, objectives, achievements, and mission parameters.
- **Three missions:** The Silent Camera (interactive lab), Ghost in the Wire (packet investigation), and Route to Nowhere (diagnostic challenge).
- **Network Map:** click devices to inspect synthetic IP, VLAN and stream configurations.
- **Packet Capture:** inspect a synthetic Ethernet/ARP/ICMP/UDP evidence table.
- **Simulated Terminal:** supported commands: `help`, `ping 10.0.0.42`, `ip addr`, `ip route`, `ss -uln`, `show camera`, `clear`. Not a shell; no real commands execute.
- **Repair Challenge:** configure the camera's UDP destination port to restore the simulated video feed.
- **Field Guide:** seven OSI layers with troubleshooting applications.
- **Progress:** local browser save. Manual export/import between devices in **Transfer Save**. No automatic cloud sync yet.
- **Nova rewards:** reward system and character integration placeholders. Real Nova image art has not been embedded into the site yet.

## Deploy

Settings → Pages → Deploy from branch → `main` → `/(root)`.

## Planned next

1. Integrate Nova's exported character image assets and unlockable morale gallery.
2. Genuine cross-device account/cloud synchronization, with an opt-in login mechanism.
3. Additional interactive missions with diagnostic trade-offs and multiple faults.
4. Sample downloadable PCAPs, import and offline packet analysis.
5. Optional local companion for TShark, Packet Tracer lab checks and RHEL workflows.

## Safety and scope

This is a **public** repository. Never add classified information, controlled work network diagrams, internal addresses, passwords, real configuration dumps, packet captures from work, encryption details, or credentials. Training labs must remain synthetic and unclassified.

No paid API service, external AI model, or backend required for the current build.

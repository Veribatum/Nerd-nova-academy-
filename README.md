# Nerd Nova Academy

A mobile-friendly, sci-fi styled networking refresher. Built as a **static web app**: no build step, no API keys, no accounts, no paid services.

## Play

Open `index.html` locally or enable **GitHub Pages → Deploy from a branch → main → /(root)**. Changes pushed to `main` will then publish to the same Pages URL.

## Version 0.1

- Mission hub and three playable networking troubleshooting missions: **The Silent Camera**, **VLAN Lockout**, and **Packet Hunter**.
- Interactive OSI Layer 1–7 field guide.
- No preselected multiple-choice answers; explanation after each answer is locked in.
- XP, levels, mission completion, and achievements.
- Progress stored locally in that browser using `localStorage` (not synchronized between desktop and phone; clearing site data resets it).
- Responsive interface for desktop and mobile.
- Fictional IP ranges and equipment scenarios; no operational or classified information.

## Roadmap

1. Scenario-driven learning paths: subnetting, TCP/UDP, routing, switching, Wireshark and RHEL.
2. More interactive network topology puzzles and meaningful scoring tied to successful troubleshooting.
3. Wireshark `.pcap` practice and downloadable sample packet captures, with safe offline analysis.
4. Optional, separately installed local Windows companion to access TShark and local virtualization labs. GitHub Pages cannot directly control installed software.
5. Optional Python course track, without replacing the current VS Code learning workflow.

## Safety

Never add real Navy network diagrams, secret/controlled IP maps, configuration dumps, credentials, keys, or operational packet captures to this public repository. All lab exercises should be synthetic and unclassified.

## Tech

Standalone HTML/CSS/JavaScript; web fonts are optional. The learning app works without an AI API or any recurring fees.

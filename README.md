# Nerd Nova Academy

**Your crew. Your ship.** Technical training aboard the independent spaceship **Rapscallion**, with **Nova, Sylvanas, Samus and Jenny** from Rum Island. A game hosted directly on GitHub Pages. No build or paid AI API is required.

Live: https://veribatum.github.io/Nerd-nova-academy-/

## Play

Report for duty, read Nova’s briefing, deploy a simulator, inspect the topology and diagnostics, make a controlled repair, and verify it. A successful verification produces an after-action report from the assigned crew member, XP, proficiency, decorations, and permanent personal-photo unlocks. Meet the four women in The crew, take their requests, and view earned pictures in Private transmissions. Wrong repairs change the scenario and fail verification. Replays do not duplicate completion XP.

Fourteen complete investigations ship with this release. The four crew Wi-Fi requests each unlock that woman’s personal photo only after successful verification:

| Operation | Investigation |
| --- | --- |
| Lost at Launch | RHEL interface state; simulator and an optional real VM mission |
| The Silent Camera | UDP sender/receiver mismatch; actual downloadable synthetic PCAP |
| Wrong Side of the Wire | Cisco-style interface diagnostics, access VLAN, configuration persistence |
| Route to Nowhere | Linux longest-prefix selection and a specific static route |
| The Virtual Island | Open vSwitch bridge/port membership |
| Permission to Fail | systemd logs, service account permissions, controlled restart |
| Ghost in the Wire | ARP evidence, stale permanent neighbor, fresh resolution |
| Nova’s Missing Names | Wi-Fi DNS failure; saved versus applied resolver |
| Sylvanas Goes Silent | Disabled local wireless radio and autoconnection |
| Samus on the Guest List | Wrong SSID/profile and the guest-network boundary |
| Jenny’s Crowded Airwaves | Band restriction, scan/link evidence and reassociation |
| Known by Name | Vim, /etc/hosts, backup/diff and system name lookup |
| Saved Is Not Active | RHEL 9 keyfile: disk → NetworkManager reload → interface activation |
| The Wrong Destination | Vim, application endpoint, service restart and health verification |

The three configuration missions include a **Vim basics trainer** with Normal/Insert modes, keyboard and touch controls, save/discard, undo of the last Insert session, root/readonly behavior and resumable unsaved buffers. It is a limited training editor, not a complete Vim implementation. Files, profiles and services are modeled independently; saving a file alone does not count as activating a network profile or restarting an application. The original backup and a reviewed diff are part of verification. These new missions are browser simulations, not additional VM deployments.

The browser terminal is explicitly a stateful simulation. It never forwards typed commands to the computer. The real VM mission uses your ordinary SSH terminal and independent VM-side verification.

## Enable the real mission on Windows

Your existing Vehicle Node, hostname, SSH connection, and Clean Baseline snapshot are assumed ready. No adapter or SSH reconfiguration is needed.

1. Download and extract the [full Academy ZIP](https://github.com/Veribatum/Nerd-nova-academy-/archive/refs/heads/main.zip). Open **companion/setup-lab.bat**. Type `INSTALL` and enter your normal VM password when SCP/SSH and sudo ask.
2. Open **companion/start-companion.bat**, type `ENABLE`, then enter the displayed pairing code in **Academy → Lab connection**. Read **Lost at Launch** and choose **Deploy real VM**.

Python is not required on Windows. The installer uses Windows 11’s OpenSSH and tar. The RHEL helper uses the VM’s Python 3, iproute2, ping and systemd. The installer checks prerequisites and refuses a hostname other than `nova-academy` or a non-RHEL guest. If a prerequisite is missing, it stops instead of downloading software.

The original `GET http://127.0.0.1:8765/vm/status` contract remains compatible. Enter at the companion’s ENABLE prompt for status-only operation. The older Python status server remains in history/source for compatibility; use the PowerShell launcher.

### Lab boundary and recovery

- Fixed target: **RHEL 9.8 Vehicle Node**, `jamean@127.0.0.1:2224`, enrolled hostname `nova-academy`, pinned machine-id.
- The root helper creates only `nn-academy` and `nn-peer`, connected with a virtual Ethernet pair. Their documentation-range addresses are `192.0.2.10/30` and `192.0.2.9/30`. There is no bridge or route to the external network.
- `enp0s3`, `enp0s8`, host routing, NetworkManager profiles, SSH settings, VirtualBox adapters and snapshots are not modified. Protected management addresses/routes are fingerprinted before deployment and rechecked during verification.
- MPPCS and GRAMPS are never selected. The website cannot supply a VM name, interface name, IP configuration, executable, command, file path or SSH arguments to the companion.
- Verification checks the administrative UP flag, approved address, connected route, three actual ping replies, unchanged management state, and matching deployed attempt ID. The VM reward is separate from the simulator reward.
- **Reset isolated lab** removes the owned training namespaces. A VM-side systemd timer checks the 45-minute deployment lease every minute, including when the browser or companion closes. Manual recovery in the VM: `sudo /usr/local/libexec/nerd-nova-lab reset`.
- The website never automatically restores a VirtualBox snapshot. The existing **Nerd Nova Academy - Clean Baseline** snapshot remains a manual fallback.

Read [the companion security contract](docs/COMPANION.md) for installed files and authorization details.

## Progress and cross-device saving

- Existing `nerdnova_v2` and `nerdnova_v1_progress` records migrate into version 3. Original keys are left intact. Legacy XP, all completion IDs, medals and history are retained.
- Before local save replacement, the last eight automatic copies are retained. Malformed records are preserved before fallback migration. Service record supports JSON backups and merge-based import of JSON or old base64 codes.
- Completions use stable reward IDs. Merging two devices unions achievements and adds each completion reward once. A lower-progress import cannot erase existing completions or higher legacy XP.
- In-progress state, terminal history, watch notes, attempts and verification evidence are saved. Changing subjects does not reset earned progress.

**Cloud sync requires a one-time user setup.** Open the save control, create a **private** GitHub save repository with a README, and make a fine-grained token limited to that repository with **Contents: read/write**. Connect both devices to that same repository with the same vault passphrase. Do not use the public game repository.

The browser encrypts progress using AES-256-GCM with PBKDF2-SHA-256 (310,000 iterations, random salt and IV), then uses GitHub’s Contents API. Writes use the current file SHA and merge/retry conflicts. Offline changes stay local and synchronize after reconnect/unlock. Git history retains earlier encrypted saves. An optional remembered token is encrypted with the vault passphrase; decrypted credentials live only in page memory. No token or passphrase is committed to this repository. Cloud saving requires HTTPS. Keep your passphrase and a local export: the application cannot recover a lost vault passphrase.

The implementation is included and fixture-tested. No GitHub account credential, private save repository, or cloud connection is silently provisioned by this release.

## Development and verification

```sh
npm test
npm run check
python3 -m py_compile lab/academy-lab.py
bash -n lab/install-lab.sh lab/academy-gateway
npm run dev
```

No npm dependencies are required. Release updates run `npm run stamp` after changing the package version; it stamps the entire ES-module graph and stylesheet so cached older modules cannot mix with a new release. The progress key never changes for an art/content update. GitHub Pages serves `main` / root, including ES modules and the optimized local WebP assets. Existing Pages settings need no change.

CI runs the gameplay, migration, encryption, conflict and reward-gate tests; Windows PowerShell 5.1 syntax, authorization and dispatch tests; and an actual Linux namespace lifecycle inside an isolated CI network/UTS/mount namespace. The Linux integration test does not run on the user’s VM. The user’s Windows → installed RHEL VM path and the user’s authenticated cloud account still need their first local enrollment/connection.

Architecture: `js/data/` mission definitions and manual; `js/sim/` stateful tools, verifiers and PCAP builder; `js/core/` saves/encryption/sync; `js/lab/` restricted companion client; `js/ui/` presentation; `lab/` VM helper; `companion/` Windows controller. Add missions with a unique permanent ID and verifier; never rename a released ID or wipe the save key to update content.

Artwork and generation prompts: [assets/ART.md](assets/ART.md).

## Sources and scope

Training references: [RHEL networking](https://docs.redhat.com/en/documentation/red_hat_enterprise_linux/9/html/configuring_and_managing_networking/index), [ip-netns](https://man7.org/linux/man-pages/man8/ip-netns.8.html), [network namespaces](https://man7.org/linux/man-pages/man7/network_namespaces.7.html), [Open vSwitch](https://www.openvswitch.org/support/dist-docs/ovs-vsctl.8.html), [Wireshark](https://www.wireshark.org/docs/wsug_html_chunked/ChapterWork.html), [VirtualBox](https://www.virtualbox.org/manual/ch06.html), [GitHub Contents API](https://docs.github.com/rest/repos/contents).

All scenarios and packet frames are fictional and unclassified. Never add work captures, operational configurations, controlled maps, encryption material, passwords, access tokens or classified information.

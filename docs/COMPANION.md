# Companion authorization contract

The PowerShell 5.1 controller preserves the previously working Vehicle Node status endpoint. It listens only on `127.0.0.1:8765`, checks the exact Host header to resist DNS rebinding, and permits browser requests only from `https://veribatum.github.io`. GitHub Pages projects on that hostname share an origin, so origin checks are supplemented by explicit local authorization, a console pairing secret and a per-session bearer token.

The local operator types ENABLE for that session. A random 48-bit pairing code is shown only in the console; five failures lock pairing until restart. A successful pair yields a random 256-bit token that expires after 12 hours or on companion restart. The browser retains it only in sessionStorage. Changing operations requires authenticated JSON POST with the exact fixed mission identifier. Requests with extra payload properties are rejected. Bodies are limited to 4 KiB. Preflight responses advertise private-network access; the user may also need to allow the browser’s local-network permission.

| Endpoint | Method | Authorization | Effect |
| --- | --- | --- | --- |
| `/health` | GET | Origin/Host policy | Companion capability/version |
| `/vm/status` | GET | Origin/Host policy | Read the fixed Vehicle Node state |
| `/pair` | POST | Console code + allowed Origin | Pair one browser session |
| `/lab/status` | GET | Bearer + allowed Origin | Read enrolled controller state |
| `/lab/deploy` | POST | Bearer + allowed Origin | Deploy or resume the single fixed mission |
| `/lab/verify` | POST | Bearer + allowed Origin | Retest the actual isolated network |
| `/lab/reset` | POST | Bearer + allowed Origin | Remove owned training namespaces |

There is no terminal/exec endpoint, dynamic SSH command, VirtualBox target argument, upload endpoint or arbitrary file access. The companion invokes OpenSSH with fixed arguments and a dedicated key. Native processes use argument quoting with no shell and an 18-second timeout.

The dedicated Ed25519 key is generated locally under `%LOCALAPPDATA%\NerdNovaAcademy`; its private-file ACL permits only the current Windows user and SYSTEM. The public key is enrolled with OpenSSH `restrict` and a forced command. The root-owned gateway accepts exactly `academy status`, `academy deploy`, `academy verify`, and `academy reset`. sudo permits only the corresponding exact root-helper command lines. This key cannot obtain a normal SSH shell, forwarding or arbitrary sudo.

VM installed files:

- `/usr/local/libexec/nerd-nova-lab` — root helper, fixed operations only.
- `/usr/local/libexec/nerd-nova-gateway` — forced-command gateway.
- `/etc/nerd-nova/target.json` — pinned local machine-id.
- `/etc/sudoers.d/nerd-nova` — exact helper operations for jamean.
- `/var/lib/nerd-nova/` — root-only attempt ownership, lock and evidence.
- `/etc/systemd/system/nerd-nova-recovery.{service,timer}` — lease cleanup.
- One restricted public-key entry appended to jamean’s existing `authorized_keys`. Existing keys remain.

The helper checks hostname, machine-id and root ownership/permissions on every operation. Deployment records ownership before creating namespaces and refuses collisions. It verifies a healthy baseline before injecting the DOWN fault. A deploy error invokes cleanup. The namespaces have no external uplink and no default route. Verification returns a matching attempt ID and five actual checks; the browser cannot send a “fixed” boolean to award VM XP.

The receipt hash is a consistency marker, not remote attestation against a malicious owner of the browser/PC. Academy is a personal training game, not a competitive anti-cheat system. A hostile local administrator or a compromised allowed-origin page is outside the trust boundary. Pair only the expected Academy page, review code before enrolling, and close the companion to revoke its session.

#!/bin/bash
# Run from the reviewed Academy lab directory, on the designated VM only.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo 'Run with sudo bash install-lab.sh'; exit 1; fi
if [[ $(hostname -s) != nova-academy ]]; then echo 'STOP: only nova-academy is authorized.'; exit 1; fi
source /etc/os-release
if [[ ${ID:-} != rhel || ${VERSION_ID%%.*} -lt 8 ]]; then echo 'RHEL 8 or 9 is required.'; exit 1; fi
base=$(cd -- "$(dirname -- "$0")" && pwd)
for command in ip ping python3 ssh-keygen visudo systemctl; do command -v "$command" >/dev/null || { echo "Missing prerequisite: $command"; exit 1; }; done
id jamean >/dev/null
if [[ ! -f $base/academy.pub ]]; then echo 'Missing companion public key academy.pub.'; exit 1; fi
if [[ $(wc -l < "$base/academy.pub") -gt 1 ]] || ! ssh-keygen -l -f "$base/academy.pub" >/dev/null; then echo 'Invalid public key.'; exit 1; fi
key=$(cat "$base/academy.pub")
if [[ $key != ssh-ed25519\ * ]]; then echo 'Only a dedicated Ed25519 Academy key is accepted.'; exit 1; fi
install -d -o root -g root -m 755 /etc/nerd-nova /usr/local/libexec
install -d -o root -g root -m 700 /var/lib/nerd-nova
if [[ -e /etc/nerd-nova/target.json ]]; then
  python3 -c 'import json; from pathlib import Path; assert json.loads(Path("/etc/nerd-nova/target.json").read_text())["machine_id"] == Path("/etc/machine-id").read_text().strip(), "Wrong VM enrollment"'
fi
python3 -c 'import json; from pathlib import Path; Path("/etc/nerd-nova/target.json").write_text(json.dumps({"machine_id":Path("/etc/machine-id").read_text().strip(),"hostname":"nova-academy"}))'
chmod 644 /etc/nerd-nova/target.json
install -o root -g root -m 755 "$base/academy-lab.py" /usr/local/libexec/nerd-nova-lab
install -o root -g root -m 755 "$base/academy-gateway" /usr/local/libexec/nerd-nova-gateway
cat > /etc/sudoers.d/nerd-nova <<'RULE'
jamean ALL=(root) NOPASSWD: /usr/local/libexec/nerd-nova-lab status, /usr/local/libexec/nerd-nova-lab deploy, /usr/local/libexec/nerd-nova-lab verify, /usr/local/libexec/nerd-nova-lab reset
RULE
chmod 440 /etc/sudoers.d/nerd-nova
visudo -cf /etc/sudoers.d/nerd-nova
home_dir=$(getent passwd jamean | cut -d: -f6)
install -d -o jamean -g "$(id -gn jamean)" -m 700 "$home_dir/.ssh"
auth="$home_dir/.ssh/authorized_keys"
if [[ -L $auth ]]; then echo 'Refusing a symlink for authorized_keys.'; exit 1; fi
touch "$auth"
# Retain existing login keys. Academy's dedicated key is restricted and forced.
if ! grep -Fq -- "$(awk '{print $2}' "$base/academy.pub")" "$auth"; then
  printf 'restrict,command="/usr/local/libexec/nerd-nova-gateway" %s\n' "$key" >> "$auth"
fi
chown jamean:"$(id -gn jamean)" "$auth"
chmod 600 "$auth"
command -v restorecon >/dev/null && restorecon -RF "$home_dir/.ssh" /usr/local/libexec /etc/nerd-nova /var/lib/nerd-nova || true
cat > /etc/systemd/system/nerd-nova-recovery.service <<'SERVICE'
[Unit]
Description=Nerd Nova isolated training lab recovery
[Service]
Type=oneshot
ExecStart=/usr/local/libexec/nerd-nova-lab recover
SERVICE
cat > /etc/systemd/system/nerd-nova-recovery.timer <<'TIMER'
[Unit]
Description=Check Nerd Nova lab lease every minute
[Timer]
OnBootSec=2min
OnUnitActiveSec=1min
Unit=nerd-nova-recovery.service
[Install]
WantedBy=timers.target
TIMER
systemctl daemon-reload
systemctl enable --now nerd-nova-recovery.timer
/usr/local/libexec/nerd-nova-lab status
echo 'Academy controller enrolled. Host NICs, routes, SSH, and other VMs were not changed.'

#!/bin/bash
# CI ONLY: invoked inside fresh mount, UTS and network namespaces, as root.
set -euo pipefail
if [[ $EUID -ne 0 ]]; then echo 'Requires isolated root test environment'; exit 1; fi
hostname nova-academy
mount --make-rprivate /
mkdir -p /etc/nerd-nova /var/lib/nerd-nova
mount -t tmpfs -o mode=755 tmpfs /etc/nerd-nova
mount -t tmpfs -o mode=700 tmpfs /var/lib/nerd-nova
# Two dummy management NICs prove that deployment, verification, and reset retain state.
ip link add enp0s3 type dummy
ip link add enp0s8 type dummy
ip link set enp0s3 addrgenmode none
ip link set enp0s8 addrgenmode none
ip address add 10.0.2.15/24 dev enp0s3
ip address add 172.20.19.2/16 dev enp0s8
ip link set enp0s3 up
ip link set enp0s8 up
python3 - <<'PY'
import json
from pathlib import Path
Path('/etc/nerd-nova/target.json').write_text(json.dumps({'machine_id':Path('/etc/machine-id').read_text().strip()}))
PY
export ACADEMY_TEST_HELPER="$PWD/lab/academy-lab.py"
python3 - <<'PY'
import json, os, subprocess
helper = os.environ['ACADEMY_TEST_HELPER']
def op(name, valid=True):
    r = subprocess.run(['python3', helper, name], capture_output=True, text=True)
    assert (r.returncode == 0) == valid, (name, r.stdout, r.stderr)
    return json.loads(r.stdout)
def ip(*args):
    subprocess.run(['/usr/sbin/ip', *args], check=True)
def host():
    return subprocess.check_output(['/usr/sbin/ip','-j','address','show'])
baseline = host()
assert op('status')['installed']
initial = op('deploy'); attempt = initial['attempt']; assert initial['active']
assert host() == baseline, 'Host interface state changed during deployment'
assert op('deploy')['attempt'] == attempt, 'Deploy must resume an existing attempt'
broken = op('verify'); assert not broken['verified']; assert not broken['checks']['linkUp']
ip('-n', 'nn-academy', 'link', 'set', 'lab0', 'up')
fixed = op('verify'); assert fixed['verified']; assert all(fixed['checks'].values()); assert len(fixed['receipt']) == 64
assert fixed['attempt'] == attempt
reset = op('reset'); assert reset['reset'] and reset['protectedUnchanged']
assert host() == baseline, 'Host interface state changed during reset'
assert not op('status')['active']; op('verify', False)
# Wrong target fails before mutations.
subprocess.run(['hostname','not-academy'], check=True)
assert 'Wrong VM' in op('deploy', False)['error']
subprocess.run(['hostname','nova-academy'], check=True)
# An unowned reserved namespace is never removed or reused.
ip('netns','add','nn-academy')
assert 'without ownership' in op('deploy', False)['error']
ip('netns','delete','nn-academy')
# Lease expiry cleans an abandoned deployment.
op('deploy')
from pathlib import Path
state = Path('/var/lib/nerd-nova/attempt.json'); data = json.loads(state.read_text()); data['expires'] = 1; state.write_text(json.dumps(data))
assert op('recover')['reset']; assert not op('status')['active']
assert host() == baseline
print('Actual Linux deploy -> fail -> repair -> verify -> reset, wrong-target, collision and lease-recovery tests passed.')
PY

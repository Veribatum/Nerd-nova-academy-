#!/usr/bin/python3
"""Fixed-operation root helper. No browser-supplied commands or configuration.

Only two owned namespaces are mutated. The VM's real NICs are read-only.
Installer binds execution to this VM's machine-id AND nova-academy hostname.
"""
import fcntl
import hashlib
import json
import os
from pathlib import Path
import socket
import stat
import subprocess
import sys
import time
import uuid

ROOT = Path('/var/lib/nerd-nova')
MARKER = Path('/etc/nerd-nova/target.json')
NAMES = ('nn-academy', 'nn-peer')
IP = '/usr/sbin/ip'
if not Path(IP).exists():
    IP = '/sbin/ip'
STATE = ROOT / 'attempt.json'
TTL = 45 * 60


def run(*args, ok=False, timeout=10):
    result = subprocess.run(list(args), capture_output=True, text=True,
                            timeout=timeout, env={'PATH': '/usr/sbin:/usr/bin:/sbin:/bin', 'LC_ALL': 'C'})
    if result.returncode and not ok:
        raise RuntimeError('A lab operation failed; use Reset lab. No host NIC was changed.')
    return result


def ip(*args, **kwargs):
    return run(IP, *args, **kwargs)


def read_state():
    if not STATE.exists():
        return None
    if STATE.is_symlink():
        raise RuntimeError('Unsafe state file; reinstall the lab controller.')
    return json.loads(STATE.read_text())


def save_state(data):
    temp = ROOT / 'attempt.new'
    fd = os.open(str(temp), os.O_WRONLY | os.O_CREAT | os.O_TRUNC | os.O_NOFOLLOW, 0o600)
    with os.fdopen(fd, 'w') as file:
        json.dump(data, file, sort_keys=True)
        file.flush()
        os.fsync(file.fileno())
    os.replace(str(temp), str(STATE))


def namespace_names():
    return [line.split()[0] for line in ip('netns', 'list').stdout.splitlines() if line.strip()]


def protected_state():
    """Exclude lease countdowns; compare the protected addresses and routes."""
    interfaces = []
    for name in ('enp0s3', 'enp0s8'):
        result = ip('-j', 'address', 'show', 'dev', name, ok=True)
        if result.returncode:
            interfaces.append({'name': name, 'absent': True})
            continue
        for item in json.loads(result.stdout):
            interfaces.append({'name': name, 'mac': item.get('address'),
                               'up': 'UP' in item.get('flags', []),
                               'addresses': sorted((v.get('family'), v.get('local'), v.get('prefixlen'))
                                                   for v in item.get('addr_info', []))})
    routes = []
    for route in json.loads(ip('-j', 'route', 'show', 'table', 'all').stdout):
        if route.get('dev') in ('enp0s3', 'enp0s8'):
            routes.append({key: route.get(key) for key in ('dst', 'gateway', 'dev', 'table', 'metric', 'scope', 'type')})
    return {'interfaces': interfaces, 'routes': sorted(routes, key=lambda v: json.dumps(v, sort_keys=True))}


def digest(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True).encode()).hexdigest()


def guard():
    if os.geteuid() != 0:
        raise RuntimeError('The root-owned controller must be invoked through its installed sudo rule.')
    for path in (MARKER.parent, MARKER, ROOT):
        info = path.lstat()
        if stat.S_ISLNK(info.st_mode) or info.st_uid != 0 or info.st_mode & 0o022:
            raise RuntimeError('Unsafe controller ownership or permissions.')
    marker = json.loads(MARKER.read_text())
    machine = Path('/etc/machine-id').read_text().strip()
    if socket.gethostname().split('.')[0] != 'nova-academy' or marker.get('machine_id') != machine:
        raise RuntimeError('Wrong VM. Only the enrolled nova-academy Vehicle Node is authorized.')


def status():
    data = read_state()
    active = bool(data and data.get('active'))
    return {'installed': True, 'version': 1, 'target': 'nova-academy',
            'mission': 'rhel-link', 'active': active,
            'attempt': data.get('id') if active else None,
            'expiresAt': data.get('expires') if active else None,
            'verified': bool(active and data.get('verified'))}


def reset(reason='operator-reset'):
    data = read_state()
    if not data or not data.get('active'):
        return {'reset': True, 'active': False, 'reason': 'already-clean'}
    # Ownership was recorded before creation. Never delete an unowned namespace.
    if data.get('owned') != list(NAMES):
        raise RuntimeError('Namespace ownership record is missing; refusing cleanup.')
    existing = namespace_names()
    for name in NAMES:
        if name in existing:
            # Do not kill terminals or other user processes. Deleting the name
            # disconnects it from future missions; the kernel reaps it on exit.
            ip('netns', 'delete', name)
    data.update(active=False, reset_at=time.time(), reset_reason=reason)
    save_state(data)
    return {'reset': True, 'active': False, 'reason': reason,
            'protectedUnchanged': digest(protected_state()) == data['protected_hash']}


def deploy():
    data = read_state()
    if data and data.get('active'):
        if data.get('expires', 0) <= time.time():
            reset('expired')
        else:
            return dict(status(), deployed=True, resumed=True)
    existing = namespace_names()
    if any(name in existing for name in NAMES):
        raise RuntimeError('A reserved namespace already exists without ownership. No changes made.')
    for name in ('nn-a', 'nn-b'):
        if ip('link', 'show', name, ok=True).returncode == 0:
            raise RuntimeError('A reserved temporary interface already exists. No changes made.')
    data = {'id': str(uuid.uuid4()), 'mission': 'rhel-link', 'active': True,
            'owned': list(NAMES), 'created': time.time(), 'expires': time.time() + TTL,
            'protected_hash': digest(protected_state()), 'verified': False}
    save_state(data)
    try:
        for name in NAMES:
            ip('netns', 'add', name)
        ip('link', 'add', 'nn-a', 'type', 'veth', 'peer', 'name', 'nn-b')
        ip('link', 'set', 'nn-a', 'netns', NAMES[0])
        ip('link', 'set', 'nn-b', 'netns', NAMES[1])
        for ns, old in zip(NAMES, ('nn-a', 'nn-b')):
            ip('-n', ns, 'link', 'set', old, 'name', 'lab0')
            ip('-n', ns, 'link', 'set', 'lo', 'up')
        ip('-n', NAMES[0], 'address', 'add', '192.0.2.10/30', 'dev', 'lab0')
        ip('-n', NAMES[1], 'address', 'add', '192.0.2.9/30', 'dev', 'lab0')
        ip('-n', NAMES[1], 'link', 'set', 'lab0', 'up')
        ip('-n', NAMES[0], 'link', 'set', 'lab0', 'up')
        if ip('netns', 'exec', NAMES[0], '/usr/bin/ping', '-c', '1', '-W', '2', '192.0.2.9', ok=True).returncode:
            raise RuntimeError('The healthy baseline failed its connectivity test. Deployment cancelled.')
        ip('-n', NAMES[0], 'link', 'set', 'lab0', 'down')
        if digest(protected_state()) != data['protected_hash']:
            raise RuntimeError('Protected networking changed during deployment. Deployment cancelled.')
        return dict(status(), deployed=True, resumed=False)
    except Exception:
        reset('deployment-failed')
        # A failed move can leave only these freshly-created temporary veths.
        for name in ('nn-a', 'nn-b'):
            if ip('link', 'show', name, ok=True).returncode == 0:
                ip('link', 'delete', name, ok=True)
        raise


def verify():
    data = read_state()
    if not data or not data.get('active'):
        raise RuntimeError('No deployed mission. Deploy before verifying.')
    if data['expires'] <= time.time():
        reset('expired')
        raise RuntimeError('The 45-minute lab lease expired and was cleaned up. Deploy a fresh attempt.')
    link = ip('-n', NAMES[0], '-j', 'address', 'show', 'dev', 'lab0', ok=True)
    address = json.loads(link.stdout) if link.returncode == 0 else []
    up = bool(address and 'UP' in address[0].get('flags', []))
    expected = bool(address and any(v.get('local') == '192.0.2.10' and v.get('prefixlen') == 30
                                   for v in address[0].get('addr_info', [])))
    reachable = bool(up and ip('netns', 'exec', NAMES[0], '/usr/bin/ping', '-c', '3', '-W', '1',
                              '192.0.2.9', ok=True).returncode == 0)
    routes = ip('-n', NAMES[0], '-j', 'route', 'show', ok=True)
    route_ok = bool(routes.returncode == 0 and any(v.get('dst') == '192.0.2.8/30' and v.get('dev') == 'lab0'
                                                   for v in json.loads(routes.stdout)))
    unchanged = digest(protected_state()) == data['protected_hash']
    checks = {'linkUp': up, 'addressCorrect': expected, 'routePresent': route_ok,
              'peerReachable': reachable, 'protectedUnchanged': unchanged}
    passed = all(checks.values())
    evidence = {'attempt': data['id'], 'checks': checks, 'at': time.time(), 'target': 'nova-academy'}
    data.update(verified=passed, evidence=evidence)
    save_state(data)
    return {'verified': passed, 'active': True, 'mission': 'rhel-link', 'attempt': data['id'],
            'target': 'nova-academy', 'checks': checks, 'evidence': evidence,
            'receipt': digest(evidence)}


def main():
    if len(sys.argv) != 2 or sys.argv[1] not in ('status', 'deploy', 'verify', 'reset', 'recover'):
        raise RuntimeError('Unknown operation.')
    guard()
    with (ROOT / 'controller.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        action = sys.argv[1]
        if action == 'recover':
            data = read_state()
            result = reset('lease-expired') if data and data.get('active') and data.get('expires', 0) <= time.time() else {'recovered': False}
        else:
            result = {'status': status, 'deploy': deploy, 'verify': verify, 'reset': reset}[action]()
        print(json.dumps(result, separators=(',', ':')))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'error': str(error), 'verified': False}, separators=(',', ':')))
        sys.exit(1)

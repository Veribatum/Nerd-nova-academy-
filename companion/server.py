"""Nerd Nova Academy read-only Windows VirtualBox companion (stdlib only)."""
import json
import os
import shutil
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

HOST, PORT = "127.0.0.1", 8765
ALLOWED_ORIGIN = "https://veribatum.github.io"
VM_NAME = "RHEL 9.8 Vehicle Node"

def locate_vbox():
    options = [
        shutil.which("VBoxManage"),
        str(Path(os.environ.get("ProgramFiles", r"C:\Program Files")) / "Oracle" / "VirtualBox" / "VBoxManage.exe"),
    ]
    return next((x for x in options if x and Path(x).is_file()), None)

def vm_status():
    binary = locate_vbox()
    if not binary:
        return {"connected": False, "error": "VBoxManage not found", "vm": VM_NAME}
    try:
        result = subprocess.run(
            [binary, "showvminfo", VM_NAME, "--machinereadable"],
            capture_output=True, text=True, timeout=8, check=False,
            creationflags=getattr(subprocess, "CREATE_NO_WINDOW", 0),
        )
        if result.returncode:
            return {"connected": False, "vm": VM_NAME, "error": "Target VM not registered"}
        fields = dict(line.split("=", 1) for line in result.stdout.splitlines() if "=" in line)
        state = fields.get("VMState", "").strip('"')
        return {"connected": True, "vm": VM_NAME, "state": state,
                "running": state == "running", "mode": "read-only"}
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"connected": False, "vm": VM_NAME, "error": type(exc).__name__}

class Handler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        if self.headers.get("Origin") != ALLOWED_ORIGIN:
            self.send_error(403)
            return
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
        self.send_header("Access-Control-Allow-Methods", "GET, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "600")
        self.end_headers()

    def do_GET(self):
        origin = self.headers.get("Origin")
        # Same-host browsing without an Origin header is permitted for diagnostics.
        if origin not in (None, ALLOWED_ORIGIN):
            self.send_error(403)
            return
        if self.path not in ("/health", "/vm/status"):
            self.send_error(404)
            return
        result = {"app": "Nerd Nova Academy", "version": 1, "connected": True} if self.path == "/health" else vm_status()
        body = json.dumps(result).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        if origin == ALLOWED_ORIGIN:
            self.send_header("Access-Control-Allow-Origin", ALLOWED_ORIGIN)
            self.send_header("Vary", "Origin")
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        self.send_error(405, "Read-only companion")

    def log_message(self, fmt, *args):
        print("%s - %s" % (self.address_string(), fmt % args))

if __name__ == "__main__":
    print("Nerd Nova Companion — read-only VirtualBox status")
    print("Listening only on http://127.0.0.1:%d" % PORT)
    print("Target VM:", VM_NAME)
    print("Close this window to stop. Ctrl+C also stops.")
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()

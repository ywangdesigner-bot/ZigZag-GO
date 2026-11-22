#!/usr/bin/env python3
"""Serve the local prototypes with caching disabled."""
import argparse
import functools
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import URLError
from urllib.request import ProxyHandler, build_opener

ROOT = Path(__file__).resolve().parent
PORT = 8741
HEALTH_PATH = "/__prototype_health"
OPENER = build_opener(ProxyHandler({}))


class PrototypeHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        super().end_headers()

    def send_head(self):
        # Always send current bytes, even when a browser revalidates an old copy.
        for name in ("If-Modified-Since", "If-None-Match"):
            if name in self.headers:
                del self.headers[name]
        return super().send_head()

    def do_GET(self):
        if self.path == HEALTH_PATH:
            body = json.dumps({"root": str(ROOT), "cache": "no-store", "version": 1}).encode()
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
            return
        super().do_GET()


def ready():
    try:
        with OPENER.open(f"http://127.0.0.1:{PORT}{HEALTH_PATH}", timeout=1) as response:
            data = json.load(response)
            return data == {"root": str(ROOT), "cache": "no-store", "version": 1}
    except (URLError, OSError, ValueError):
        return False


def replace_legacy_server():
    result = subprocess.run(
        ["/usr/sbin/lsof", "-nP", f"-iTCP:{PORT}", "-sTCP:LISTEN", "-t"],
        capture_output=True, text=True,
    )
    for value in set(result.stdout.split()):
        pid = int(value)
        command = subprocess.check_output(
            ["/bin/ps", "-p", str(pid), "-o", "command="], text=True,
        )
        cwd = subprocess.check_output(
            ["/usr/sbin/lsof", "-a", "-p", str(pid), "-d", "cwd", "-Fn"], text=True,
        )
        roots = [line[1:] for line in cwd.splitlines() if line.startswith("n")]
        if "python" not in command.lower() or "-m http.server 8741" not in command:
            raise RuntimeError("8741 端口被其他程序占用，未能启动原型服务。")
        if not roots or Path(roots[0]).resolve() != ROOT:
            raise RuntimeError("8741 端口上的服务目录不同，未能启动原型服务。")
        os.kill(pid, signal.SIGTERM)
    for _ in range(30):
        result = subprocess.run(
            ["/usr/sbin/lsof", "-nP", f"-iTCP:{PORT}", "-sTCP:LISTEN", "-t"],
            capture_output=True,
        )
        if not result.stdout:
            return
        time.sleep(0.1)
    raise RuntimeError("旧的原型服务仍未退出。")


def ensure_server():
    if ready():
        return
    replace_legacy_server()
    with open("/tmp/zigzag-home-server.log", "ab") as log:
        process = subprocess.Popen(
            [sys.executable, str(Path(__file__).resolve())],
            cwd=ROOT, stdout=log, stderr=log, stdin=subprocess.DEVNULL,
            start_new_session=True,
        )
    for _ in range(50):
        if ready():
            return
        if process.poll() is not None:
            break
        time.sleep(0.1)
    raise RuntimeError("原型服务启动失败，请查看 /tmp/zigzag-home-server.log。")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--ensure", action="store_true")
    args = parser.parse_args()
    if args.ensure:
        ensure_server()
    else:
        handler = functools.partial(PrototypeHandler, directory=str(ROOT))
        ThreadingHTTPServer(("127.0.0.1", PORT), handler).serve_forever()

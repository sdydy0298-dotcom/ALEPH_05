from __future__ import annotations
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1] / "assets" / "studio-task-assets" / "t04-real-information-board"
manifest = json.loads((ROOT / "asset-manifest.json").read_text(encoding="utf-8"))
failed = []
for item in manifest["files"]:
    path = ROOT / item["path"]
    actual = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else "MISSING"
    status = "OK" if actual == item["sha256"] else "FAIL"
    print(f"{status:4} {item['path']}")
    if status != "OK":
        failed.append((item["path"], item["sha256"], actual))
if failed:
    raise SystemExit(f"SHA-256 verification failed for {len(failed)} file(s)")
print(f"PASS: {len(manifest['files'])} files match official asset-manifest.json")

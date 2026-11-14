#!/usr/bin/env python3
"""Register a capture already saved as PNGs under <device>/<NNN>_<slug>.png into index.json."""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEVICES = ("desktop", "laptop", "tablet", "mobile")


def slugify(route: str) -> str:
    return re.sub(r"[^a-zA-Z0-9]+", "-", route).strip("-")[:80] or "root"


def main() -> None:
    if len(sys.argv) < 4:
        print(
            "usage: capture_round4_helper.py <admin|client> <n> <route> [devices...]",
            file=sys.stderr,
        )
        sys.exit(2)
    portal, n_s, route = sys.argv[1], sys.argv[2], sys.argv[3]
    devices = tuple(sys.argv[4:]) if len(sys.argv) > 4 else DEVICES
    n = int(n_s)
    root = HERE / f"staging-{portal}-frontend-screenshots"
    state_p = root / "index.json"
    state = json.loads(state_p.read_text()) if state_p.exists() else {"entries": [], "used": []}
    name = f"{n:03d}_{slugify(route)}.png"
    missing = []
    for d in devices:
        p = root / d / name
        if not p.exists():
            missing.append(str(p))
    if missing:
        print("MISSING:\n" + "\n".join(missing), file=sys.stderr)
        sys.exit(1)
    # replace existing entry with same n
    state["entries"] = [e for e in state["entries"] if int(e.get("n", -1)) != n]
    state["entries"].append({"n": n, "route": route, "file": name, "seq": n})
    state["entries"].sort(key=lambda e: int(e["n"]))
    state_p.write_text(json.dumps(state, indent=1) + "\n")
    print(name, route, "devices=", ",".join(devices))


if __name__ == "__main__":
    main()

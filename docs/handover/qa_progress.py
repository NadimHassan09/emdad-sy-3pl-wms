#!/usr/bin/env python3
"""Recompute QA coverage from QA_TRACKER.md (routes) and QA_FLOWS.md (flows, cross-cutting).

Usage: python3 docs/handover/qa_progress.py   (rewrites QA_COVERAGE.md and prints the summary)

Scoring per check: ✅ or ❌ = 1, 🔄 or 🔍 = 0.5, ⬜ or ⛔ = 0, ➖ is excluded from the total.
Overall = 40% routes + 40% business flows + 20% cross-cutting.
"""
import collections
import datetime
import pathlib
import re

HERE = pathlib.Path(__file__).parent
POINTS = {'✅': 1.0, '❌': 1.0, '🔄': 0.5, '🔍': 0.5, '⬜': 0.0, '⛔': 0.0}
WEIGHTS = {'routes': 0.4, 'flows': 0.4, 'cross': 0.2}


def score(symbols):
    """Returns (points, possible) ignoring ➖."""
    pts = poss = 0.0
    for s in symbols:
        if s == '➖' or s not in POINTS:
            continue
        pts += POINTS[s]
        poss += 1
    return pts, poss


def parse_routes():
    text = (HERE / 'QA_TRACKER.md').read_text(encoding='utf-8')
    portals = {}
    for block in re.split(r'\n## ', text):
        title = block.splitlines()[0]
        if not (title.startswith('Admin') or title.startswith('Client')):
            continue
        name = 'Admin' if title.startswith('Admin') else 'Client'
        modules = collections.OrderedDict()
        for line in block.splitlines():
            if not line.startswith('| `'):
                continue
            cells = [c.strip() for c in line.strip().strip('|').split('|')]
            route = cells[0].strip('`')
            seg = route.strip('/').split('/')[0] or 'root'
            modules.setdefault(seg, []).extend(cells[1:6])
        portals[name] = modules
    return portals


def parse_flows():
    text = (HERE / 'QA_FLOWS.md').read_text(encoding='utf-8')
    flows, cross = [], []
    for line in text.splitlines():
        m = re.match(r'^\| ([FX]\d+) \| ([^|]*) \| ([^|]*) \| (\S+) \|', line)
        if not m:
            continue
        (flows if m.group(1).startswith('F') else cross).append(
            (m.group(1), m.group(2).strip(), m.group(3).strip(), m.group(4))
        )
    return flows, cross


def pct(pts, poss):
    return 100.0 * pts / poss if poss else 0.0


def main():
    portals = parse_routes()
    flows, cross = parse_flows()

    route_syms = [s for modules in portals.values() for syms in modules.values() for s in syms]
    r_pts, r_poss = score(route_syms)
    f_pts, f_poss = score([f[3] for f in flows])
    x_pts, x_poss = score([x[3] for x in cross])
    layers = {
        'routes': pct(r_pts, r_poss),
        'flows': pct(f_pts, f_poss),
        'cross': pct(x_pts, x_poss),
    }
    overall = sum(layers[k] * WEIGHTS[k] for k in layers)

    out = []
    out.append('# EMDAD QA Coverage (generated)\n')
    out.append(f'Generated {datetime.date.today().isoformat()} by `qa_progress.py` from `QA_TRACKER.md` and `QA_FLOWS.md`. Do not edit by hand.\n')
    out.append(f'## Overall: {overall:.1f}% tested, {100 - overall:.1f}% remaining\n')
    out.append('| Layer | Weight | Done | Items |\n|---|---|---|---|')
    n_routes = sum(len(v) // 5 for m in portals.values() for v in m.values())
    out.append(f"| Route checks (functional, validation, roles, consistency, mobile) | 40% | {layers['routes']:.1f}% | {int(r_poss)} checks on {n_routes} routes |")
    out.append(f"| Business flows | 40% | {layers['flows']:.1f}% | {len(flows)} flows |")
    out.append(f"| Cross-cutting (security, errors, responsive, data, tests, release) | 20% | {layers['cross']:.1f}% | {len(cross)} checks |\n")

    out.append('## Routes by module\n')
    for portal, modules in portals.items():
        out.append(f'### {portal} portal\n')
        out.append('| Module | Routes | Done | Remaining |\n|---|---|---|---|')
        rows = []
        for mod, syms in modules.items():
            pts, poss = score(syms)
            rows.append((pct(pts, poss), mod, len(syms) // 5))
        for p, mod, n in sorted(rows, key=lambda r: (-r[0], r[1])):
            out.append(f'| {mod} | {n} | {p:.0f}% | {100 - p:.0f}% |')
        pts, poss = score([s for v in modules.values() for s in v])
        out.append(f'| **Total** | {sum(len(v) // 5 for v in modules.values())} | **{pct(pts, poss):.1f}%** | **{100 - pct(pts, poss):.1f}%** |\n')

    out.append('## Flows and cross-cutting checks\n')
    out.append('| ID | Area | Item | Status |\n|---|---|---|---|')
    for fid, area, item, status in flows + cross:
        out.append(f'| {fid} | {area} | {item} | {status} |')
    out.append('')

    counts = collections.Counter(f[3] for f in flows + cross)
    out.append('## Status counts (flows + cross-cutting)\n')
    out.append(' · '.join(f'{k} {v}' for k, v in sorted(counts.items())) + '\n')

    out.append('## Definition of done (hand over to the client)\n')
    out.append('1. Every route, flow and cross-cutting check above is ✅ or ❌ with a triaged defect; no ⬜, 🔄 or ⛔ left.')
    out.append('2. No open S1 or S2 defect; every open S3 or S4 is listed as an accepted known limitation.')
    out.append('3. Regression pass after the last fix: backend unit suite (all, in batches), frontend unit suite, Playwright critical paths, and one live carrier smoke per integrated carrier.')
    out.append('4. Owner decisions closed: pricing groups per governorate, FX source, carrier pound units, COD eligibility, edit/cancel rules, deletion policy, return rollback, secrets rotation.')
    out.append('5. Handover pack written: client documentation, decision log, known limitations, runbook.')
    out.append('Only when all five hold is the system reported as fully tested.\n')

    (HERE / 'QA_COVERAGE.md').write_text('\n'.join(out), encoding='utf-8')
    print(f'Overall {overall:.1f}% | routes {layers["routes"]:.1f}% | flows {layers["flows"]:.1f}% | cross-cutting {layers["cross"]:.1f}%')
    for portal, modules in portals.items():
        pts, poss = score([s for v in modules.values() for s in v])
        print(f'{portal}: {pct(pts, poss):.1f}% of {int(poss)} checks')


if __name__ == '__main__':
    main()

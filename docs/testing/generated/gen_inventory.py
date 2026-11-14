#!/usr/bin/env python3
"""Regenerates the endpoint catalogue and the unit-test gap list from source. Run from repo root."""
import re, os, glob, json
root = 'backend/src'
verbs = {'Get': 'GET', 'Post': 'POST', 'Put': 'PUT', 'Patch': 'PATCH', 'Delete': 'DELETE'}
rows = []
for f in sorted(glob.glob(root + '/**/*.controller.ts', recursive=True)):
    src = open(f).read()
    m = re.search(r"@Controller\(\s*(?:'([^']*)'|\"([^\"]*)\")?\s*\)", src)
    base = (m.group(1) or m.group(2) or '') if m else ''
    cls_guards = re.findall(r'@UseGuards\(([^)]*)\)', src[:m.start() + 300] if m else '')
    cls_public = False
    sp = f.split('/'); mod = sp[3] if sp[2] == 'modules' and len(sp) > 4 else sp[2]
    parts = re.split(r'\n(?=\s*@(?:Get|Post|Put|Patch|Delete)\()', src)
    for pi, p in enumerate(parts[1:], 1):
        prev = re.split(r'\n\s*\n|\n  \}\n', parts[pi-1])[-1][-250:]
        mm = re.match(r"\s*@(Get|Post|Put|Patch|Delete)\(\s*(?:'([^']*)'|\"([^\"]*)\")?", p)
        if not mm: continue
        path = '/' + '/'.join(x for x in [base, mm.group(2) or mm.group(3) or ''] if x)
        head = prev + p[:600]
        head = head.split('async ')[0] if 'async ' in head else head
        roles = re.search(r'@Roles\(([^)]*)\)', head)
        guards = re.search(r'@UseGuards\(([^)]*)\)', head)
        pub = bool(re.search(r'@Public\(\)', prev + p[:120])) or cls_public
        rows.append((mod, verbs[mm.group(1)], re.sub(r'/+', '/', path), 'public' if pub else (roles.group(1).replace("'", '').replace('UserRole.', '').strip() if roles else ''), (guards.group(1).strip() if guards else ', '.join(g.strip() for g in cls_guards)), os.path.basename(f)))
out = ['# Generated endpoint catalogue', '', f'Total routes: **{len(rows)}**. Source: `backend/src/**/*.controller.ts`. Regenerate with `python3 docs/testing/generated/gen_inventory.py`.', '', '| # | Module | Method | Path | Method-level auth annotation (heuristic: verify in code) | Guards | Controller |', '|---|---|---|---|---|---|---|']
for i, r in enumerate(rows, 1): out.append(f'| E{i:03d} | ' + ' | '.join(r) + ' |')
open('docs/testing/generated/ENDPOINT_CATALOGUE.md', 'w').write('\n'.join(out) + '\n')
# unit gap: service/util files without sibling spec
gaps = []; have = 0
for f in sorted(glob.glob(root + '/**/*.ts', recursive=True)):
    b = os.path.basename(f)
    if b.endswith(('.spec.ts', '.module.ts', '.dto.ts', '.d.ts', '.types.ts', '.constants.ts')) or b in ('main.ts',): continue
    if not re.search(r'\.(service|util|utils|validation|mapper|adapter|guard|pipe|filter|interceptor|middleware|calculator|policy|parser|builder|engine)\.ts$', b): continue
    base = re.sub(r'\.ts$', '', f)
    has = os.path.exists(base + '.spec.ts') or os.path.exists(base + '.unit.spec.ts')
    loc = sum(1 for _ in open(f))
    (have := have + 1) if has else gaps.append((f.replace(root + '/', ''), loc))
gaps.sort(key=lambda x: -x[1])
out = ['# Generated unit-test gap list (backend)', '', f'Files with a sibling spec: {have}. Files **without** a sibling spec: {len(gaps)} (sorted by size). A file without a sibling spec may still be covered indirectly by another spec — verify before writing a duplicate.', '', '| # | File | Lines |', '|---|---|---|']
for i, (f, l) in enumerate(gaps, 1): out.append(f'| G{i:03d} | `{f}` | {l} |')
open('docs/testing/generated/UNIT_GAP_BACKEND.md', 'w').write('\n'.join(out) + '\n')
# frontend gap
fe = []
for app in ('frontend', 'client-frontend'):
    for f in sorted(glob.glob(app + '/src/**/*.ts*', recursive=True)):
        b = os.path.basename(f)
        if '.spec.' in b or '.test.' in b or b.endswith('.d.ts'): continue
        if '/lib/' in f or '/hooks/' in f or '/utils/' in f or '/data/' in f:
            base = re.sub(r'\.tsx?$', '', f)
            has = any(os.path.exists(base + s) for s in ('.unit.spec.ts', '.spec.ts', '.test.ts', '.unit.spec.tsx'))
            fe.append((app, f, has, sum(1 for _ in open(f))))
out = ['# Generated unit-test gap list (frontends: lib/hooks/utils/data)', '', '| # | App | File | Lines | Sibling spec |', '|---|---|---|---|---|']
for i, (a, f, h, l) in enumerate(sorted(fe, key=lambda x: (x[2], -x[3])), 1): out.append(f'| H{i:03d} | {a} | `{f}` | {l} | {"yes" if h else "**NO**"} |')
open('docs/testing/generated/UNIT_GAP_FRONTEND.md', 'w').write('\n'.join(out) + '\n')
print(len(rows), 'routes;', len(gaps), 'backend gaps;', sum(1 for x in fe if not x[2]), 'frontend gaps of', len(fe))

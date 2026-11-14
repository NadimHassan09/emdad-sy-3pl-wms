#!/usr/bin/env python3
"""Sort captured blobs into numbered per-device folders.
Each capture carries a colour bit-strip (page sequence number) along its bottom edge; it is decoded, then cropped off.
usage: assign.py <admin|client> <first_seq> <route> [<route> ...]   (routes in capture order, seq = first_seq, first_seq+1, ...)"""
import sys, os, re, json, struct, glob
from PIL import Image
SRC = '/root/.claude/projects/-var-www-emdad-sy-3pl-wms-staging/4a22e24d-5218-4cb5-b9e0-f47f56aa67ca/tool-results'
HERE = os.path.dirname(os.path.abspath(__file__))
# dims -> (device, css->img scale, sample row, crop height)
BOXW = {'desktop': 1866, 'laptop': 1639, 'tablet': 722, 'mobile': 429}
def devinfo(size):
    w, h = size
    r = w / h
    if 2.15 < r < 2.45: d = 'laptop'
    elif 1.95 <= r <= 2.15: d = 'desktop'
    elif 0.7 < r < 0.95: d = 'tablet'
    elif 0.4 < r < 0.6: d = 'mobile'
    else: return None
    return (d, w / BOXW[d])
BITS = 12
NOMARK = '--nomarker' in sys.argv
args = [a for a in sys.argv[1:] if a != '--nomarker']
portal, first, routes = args[0], int(args[1]), args[2:]
root = os.path.join(HERE, f'staging-{portal}-frontend-screenshots')
state_p = os.path.join(root, 'index.json')
os.makedirs(root, exist_ok=True)
state = json.load(open(state_p)) if os.path.exists(state_p) else {'entries': [], 'used': []}
def decode(p):
    im = Image.open(p).convert('RGB'); dev, sc = devinfo(im.size)
    row = None
    for y in range(im.size[1] - 1, im.size[1] - 40, -1):
        r, g_, b = im.getpixel((int(5 * sc), y))
        if g_ > 150 and r < 110 and b < 110: row = y; break
    if row is None: return None
    top = row
    while top > 0 and (lambda c: c[1] > 150 and c[0] < 110 and c[2] < 110)(im.getpixel((int(5 * sc), top - 1))): top -= 1
    row = (top + row) // 2; crop = top - 1
    px = lambda i: im.getpixel((int((5 + 10 * i) * sc), row))
    v = 0
    for i in range(1, BITS + 1):
        r, _, b = px(i); v = (v << 1) | (1 if r > b else 0)
    return dev, v, im.crop((0, 0, im.size[0], crop))
found = {}
for p in glob.glob(SRC + '/mcp-claude-in-chrome-blob-*.png'):
    b = os.path.basename(p)
    if b in state['used']: continue
    d = open(p, 'rb').read(32)
    if devinfo(struct.unpack('>II', d[16:24])) is None: state['used'].append(b); continue
    if NOMARK:
        im = Image.open(p).convert('RGB'); dv = devinfo(im.size)
        found.setdefault(('nm', dv[0]), []).append((b, im, os.stat(p).st_mtime_ns)); continue
    r = decode(p)
    if r is None: state['used'].append(b); continue
    found[(r[1], r[0])] = (b, r[2])
if NOMARK:
    # newest blob per device, repeated per route (routes consumed newest-first reversed to keep order)
    per = {d: sorted(found.get(('nm', d), []), key=lambda x: x[2]) for d in ('desktop', 'laptop', 'tablet', 'mobile')}
    for d in per:
        assert len(per[d]) >= len(routes), f'{d}: {len(per[d])} unused blobs < {len(routes)} routes'
        per[d] = per[d][-len(routes):]
    found = {}
    for i, route in enumerate(routes):
        for d in per: found[(first + i, d)] = (per[d][i][0], per[d][i][1])
for i, route in enumerate(routes):
    seq = first + i
    miss = [d for d in ('desktop', 'laptop', 'tablet', 'mobile') if (seq, d) not in found]
    assert not miss, f'seq {seq} {route}: missing {miss}; have {sorted(k for k in found)}'
    n = len(state['entries']) + 1
    slug = re.sub(r'[^a-zA-Z0-9]+', '-', route).strip('-')[:60] or 'root'
    name = f'{n:03d}_{slug}.png'
    for dev in ('desktop', 'laptop', 'tablet', 'mobile'):
        b, im = found[(seq, dev)]
        os.makedirs(os.path.join(root, dev), exist_ok=True)
        im.save(os.path.join(root, dev, name), optimize=True)
        state['used'].append(b)
    state['entries'].append({'n': n, 'route': route, 'file': name, 'seq': seq})
    print(name, route)
json.dump(state, open(state_p, 'w'), indent=1)

# Screenshot baselines

`staging-admin-frontend-screenshots/<device>/NNN_<route>.png` and `staging-client-frontend-screenshots/...`; `index.json` in each maps NNN → route.
Devices: desktop (viewport 1920), laptop (1366), tablet (820), mobile (390). Captured as super_admin (admin) in English/light theme on 14 Nov 2026 with the app rendered in an iframe of the device width so the responsive CSS applies.
Images are cropped to the device frame; a 12-bit colour strip used for bookkeeping was cropped off.
`assign.py` files freshly captured images into these folders (`python3 assign.py <admin|client> <first_seq> <route> ...`, add `--nomarker` for pages captured without the strip).
Not tracked by git (`*.png` in `.gitignore`): keep this folder on the VPS or `git add -f` deliberately.

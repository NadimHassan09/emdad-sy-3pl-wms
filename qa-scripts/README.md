# QA scripts (real-browser checks)

They open your own Chrome (or Edge) like a user, so you log in once and the scripts never see a password.
The profile is kept in `~/.emdad-qa-profile/<site>`.

## One-time setup on your computer
```bash
git pull
npm install            # at the repo root (installs Playwright)
```

## Run
```bash
node qa-scripts/smoke.mjs admin --login        # first time: log in in the window, press Enter
node qa-scripts/smoke.mjs client
node qa-scripts/smoke.mjs admin --mobile       # phone-size pass
node qa-scripts/smoke.mjs admin --only=/billing,/finance/accounts
```
Use Edge with `QA_BROWSER_CHANNEL=msedge`. Reports are written to `qa-scripts/out/`; send the file or the console output back.

## Safety
- The default is read only. Anything that changes data needs `QA_ALLOW_WRITES=1` and passes `lib/guard.mjs` first:
  client "Test company", recipient "Nadim Hassan", note "TEST ORDER".
- Carrier portals: the order code is typed in the search box first, and the script stops unless exactly one row is left.
- Production is never used: the base URLs are the staging sites only.

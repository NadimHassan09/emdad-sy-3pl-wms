# Status tones

Single source: `packages/ui/src/status/tones.ts` (+ `--tone-*` tokens in `styles/tokens.css`).

| Tone | Meaning | Used for (OMS) |
|---|---|---|
| neutral | inactive / closed | cancelled, legacy, "Total" |
| pending | waiting on a human | waiting_for_confirmation |
| warning | needs approval/attention | confirmed_waiting_for_admin_approval, low stock |
| progress | in fulfilment | processing, in_progress |
| ready | ready to hand over | ready_to_ship, approved return |
| transit | on the road | shipped / out_for_delivery |
| success | done | delivered, completed, in stock |
| danger | failed / blocked | failed_delivery, rejected, out of stock |
| returned | came back | returned |

Rules: never invent a colour for a status; add/adjust the mapping in `features/*/…-ui.tsx` (admin: `oms-ui.tsx`; client: `lib/oms-tone.ts`) and keep contrast passing (`npm run check:contrast`).

---
type: community
cohesion: 0.10
members: 35
---

# sila-webhook.util.ts

**Cohesion:** 0.10 - loosely connected
**Members:** 35 nodes

## Members
- [[dot-constructor()_23]] - code - backend/src/modules/shipping/shipping-webhook.controller.ts
- [[dot-handleWebhook()]] - code - backend/src/modules/shipping/shipping-webhook.controller.ts
- [[dot-logWebhookTiming()]] - code - backend/src/modules/shipping/shipping-webhook.controller.ts
- [[dot-verifyWebhook()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-sy.adapter.ts
- [[Body]] - code
- [[Controller]] - code
- [[Headers]] - code
- [[HttpCode]] - code
- [[Param]] - code
- [[Post]] - code
- [[Req]] - code
- [[SOURCE_NOTES]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[ShippingWebhookController]] - code - backend/src/modules/shipping/shipping-webhook.controller.ts
- [[ShippingWebhookTimingInput]] - code - backend/src/modules/shipping/shipping-webhook-timing.ts
- [[asRecord()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[buildShippingWebhookTimingLog()]] - code - backend/src/modules/shipping/shipping-webhook-timing.ts
- [[buildSilaNormalizedEvent()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[deliveryLagMs()]] - code - backend/src/modules/shipping/shipping-webhook-timing.ts
- [[headerValue()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[isSilaWebhookTest()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[parseSilaWebhookBody()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[providerEventTimeIso()]] - code - backend/src/modules/shipping/shipping-webhook-timing.ts
- [[realNote()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[redactSecretFields()]] - code - backend/src/modules/shipping/shipping-webhook-timing.ts
- [[ref_crypto]] - concept
- [[shipping-webhook-timing.ts]] - code - backend/src/modules/shipping/shipping-webhook-timing.ts
- [[shipping-webhook-timing.unit.spec.ts]] - code - backend/src/modules/shipping/shipping-webhook-timing.unit.spec.ts
- [[sila-webhook.util.ts]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[sila-webhook.util.unit.spec.ts]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.unit.spec.ts
- [[silaStatusEventId()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[silaWebhookEventName()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[statusFromEventName()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[text()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts
- [[timingLogContainsSecrets()]] - code - backend/src/modules/shipping/shipping-webhook-timing.ts
- [[verifySilaSignature()]] - code - backend/src/modules/shipping/providers/sila-sy/sila-webhook.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/sila-webhookutilts
SORT file.name ASC
```

## Connections to other communities
- 13 edges to [[_COMMUNITY_shipping.module.ts]]
- 9 edges to [[_COMMUNITY_sila-sy.adapter.ts]]
- 5 edges to [[_COMMUNITY_shipping-tracking.service.ts]]
- 3 edges to [[_COMMUNITY_babel-express.adapter.ts]]
- 3 edges to [[_COMMUNITY_oms-client-import.service.ts]]
- 2 edges to [[_COMMUNITY_client-financial.controller.ts]]
- 1 edge to [[_COMMUNITY_EncryptionService]]
- 1 edge to [[_COMMUNITY_@prismaclient]]
- 1 edge to [[_COMMUNITY_@nestjscommon]]
- 1 edge to [[_COMMUNITY_shipping.service.ts]]
- 1 edge to [[_COMMUNITY_shipping-preflight.ts]]
- 1 edge to [[_COMMUNITY_app.module.ts]]

## Top bridge nodes
- [[ref_crypto]] - degree 13, connects to 7 communities
- [[sila-webhook.util.ts]] - degree 21, connects to 4 communities
- [[dot-handleWebhook()]] - degree 14, connects to 4 communities
- [[dot-constructor()_23]] - degree 4, connects to 3 communities
- [[buildSilaNormalizedEvent()]] - degree 11, connects to 2 communities
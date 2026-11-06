---
type: community
cohesion: 0.19
members: 19
---

# oms-sales-channel.service.ts

**Cohesion:** 0.19 - loosely connected
**Members:** 19 nodes

## Members
- [[dot-constructor()_73]] - code - backend/src/modules/oms/sales-channels/oms-sales-channel.service.ts
- [[dot-create()_8]] - code - backend/src/modules/oms/sales-channels/oms-sales-channel.service.ts
- [[dot-list()_10]] - code - backend/src/modules/oms/sales-channels/oms-sales-channel.service.ts
- [[dot-processInboundWebhook()]] - code - backend/src/modules/oms/sales-channels/oms-sales-channel.service.ts
- [[Injectable_47]] - code
- [[OMS_CHANNEL_HANDLERS]] - code - backend/src/modules/oms/sales-channels/oms-channel-handlers.registry.ts
- [[OmsChannelHandler]] - code - backend/src/modules/oms/sales-channels/oms-channel.util.ts
- [[OmsChannelHandlerResult]] - code - backend/src/modules/oms/sales-channels/oms-channel.util.ts
- [[OmsChannelInboundContext]] - code - backend/src/modules/oms/sales-channels/oms-channel.util.ts
- [[OmsSalesChannelService]] - code - backend/src/modules/oms/sales-channels/oms-sales-channel.service.ts
- [[generateWebhookSecret()]] - code - backend/src/modules/oms/sales-channels/oms-channel.util.ts
- [[hashWebhookSecret()]] - code - backend/src/modules/oms/sales-channels/oms-channel.util.ts
- [[oms-channel-handlers.registry.ts]] - code - backend/src/modules/oms/sales-channels/oms-channel-handlers.registry.ts
- [[oms-channel.util.ts]] - code - backend/src/modules/oms/sales-channels/oms-channel.util.ts
- [[oms-channel.util.unit.spec.ts]] - code - backend/src/modules/oms/sales-channels/oms-channel.util.unit.spec.ts
- [[oms-sales-channel.service.ts]] - code - backend/src/modules/oms/sales-channels/oms-sales-channel.service.ts
- [[resolveChannelHandler()]] - code - backend/src/modules/oms/sales-channels/oms-channel-handlers.registry.ts
- [[stubHandler()]] - code - backend/src/modules/oms/sales-channels/oms-channel-handlers.registry.ts
- [[verifyWebhookSecret()]] - code - backend/src/modules/oms/sales-channels/oms-channel.util.ts

## Live Query (requires Dataview plugin)

```dataview
TABLE source_file, type FROM #community/oms-sales-channelservicets
SORT file.name ASC
```

## Connections to other communities
- 12 edges to [[_COMMUNITY_@prismaclient]]
- 6 edges to [[_COMMUNITY_CreateOmsSalesChannelDto]]
- 3 edges to [[_COMMUNITY_@nestjscommon]]
- 3 edges to [[_COMMUNITY_AuthPrincipal]]
- 3 edges to [[_COMMUNITY_inventory.service.ts]]
- 3 edges to [[_COMMUNITY_withTenantRls]]
- 2 edges to [[_COMMUNITY_app.module.ts]]
- 1 edge to [[_COMMUNITY_CurrentUser]]
- 1 edge to [[_COMMUNITY_reliability-test-helpers.ts]]

## Top bridge nodes
- [[oms-sales-channel.service.ts]] - degree 23, connects to 7 communities
- [[dot-create()_8]] - degree 8, connects to 4 communities
- [[dot-list()_10]] - degree 5, connects to 4 communities
- [[OmsSalesChannelService]] - degree 9, connects to 3 communities
- [[oms-channel.util.ts]] - degree 11, connects to 2 communities
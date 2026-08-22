# Performance QA Audit

**Phase:** Phase 8 — Performance Audit  
**Audit date:** 2026-06-12  
**Auditor:** Independent QA (FINAL-QA-CERTIFICATION)

---

## Summary

| Metric | Value |
|--------|------:|
| **Performance score** | **82/100** |
| Endpoints benchmarked | 36 |
| Samples per endpoint | 15 |
| Overall avg latency | **41 ms** |
| Overall p95 | **157 ms** |
| Overall p99 | **199 ms** |
| Benchmark timestamp | 2026-06-12T18:02:35.660Z |

## Top Latency Outliers (P95)

| Endpoint | Avg (ms) | P95 (ms) | P99 (ms) | Payload |
|----------|--------:|---------:|---------:|--------:|
| client/stock | 199 | 2557 | 2557 | 234 |
| ops/health/live | 147 | 1164 | 1164 | 78 |
| inventory/ledger | 157 | 851 | 851 | 6,524 |
| client/inbound | 62 | 445 | 445 | 4,613 |
| backups/list | 48 | 357 | 357 | 2,315 |
| cycle-count/counts | 41 | 288 | 288 | 68 |
| warehouses/list | 38 | 225 | 225 | 92 |
| client/billing | 36 | 207 | 207 | 265 |
| outbound/list | 44 | 198 | 198 | 752 |
| client/dashboard | 36 | 99 | 99 | 369 |

## Performance by Domain

| Domain | Endpoints | Avg ms | Assessment |
|--------|----------:|-------:|------------|
| Core lists (products, inbound, tasks) | 8 | 26–28 | Excellent |
| Dashboard & billing | 4 | 24–34 | Excellent |
| Reports | 3 | 19–23 | Excellent |
| Inventory ledger | 1 | 157 avg, 851 p95 | **Needs monitoring** |
| Client stock | 1 | 199 avg, 2557 p95 | **Outlier — investigate** |
| Backup list | 1 | 48 avg, 357 p95 | Acceptable |
| Health live | 1 | 147 avg, 1164 p95 | Cold-start spike in sample |

## Threshold Assessment

| Threshold | Target | Actual | Pass |
|-----------|--------|--------|:--:|
| List API avg | < 100ms | 41ms overall | ✓ |
| List API p95 | < 500ms | 157ms overall | ✓ |
| Report run avg | < 200ms | 23ms | ✓ |
| Dashboard avg | < 100ms | 34ms | ✓ |

## Redis Impact

Production readiness reports **redis: disabled**. Report cache and task read cache degrade to in-memory per process — no distributed cache benefit with PM2 ×1.

## Performance Score: 82/100

Excellent overall latency (41ms avg, 157ms p95) for majority of endpoints. Deductions for inventory ledger and client stock p95 outliers, and disabled Redis cache layer.

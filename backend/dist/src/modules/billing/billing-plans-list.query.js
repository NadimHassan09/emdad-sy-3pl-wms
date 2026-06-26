"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billingPlansOverviewCountSql = billingPlansOverviewCountSql;
exports.billingPlansOverviewListSql = billingPlansOverviewListSql;
const client_1 = require("@prisma/client");
const SORT_COLUMNS = {
    companyName: 'o.company_name',
    cycleStart: 'o.cycle_starts_at',
    cycleEnd: 'o.cycle_ends_at',
    daysRemaining: 'o.days_remaining',
    cycleLengthDays: 'o.cycle_length_days',
    fixedSubscriptionFee: 'o.fixed_subscription_fee',
    createdAt: 'o.plan_created_at',
};
function billingPlansOverviewCountSql(query, tenantCompanyIds) {
    const { where } = buildPlansOverviewWhere(query, tenantCompanyIds);
    return client_1.Prisma.sql `
    WITH current_cycles AS (
      SELECT DISTINCT ON (bc.company_id)
        bc.id,
        bc.company_id,
        bc.billing_plan_id,
        bc.starts_at,
        bc.ends_at,
        bc.status,
        bc.created_at,
        bc.updated_at
      FROM billing_cycles bc
      WHERE bc.status IN ('active', 'renewed')
        AND bc.starts_at <= NOW()
        AND bc.ends_at > NOW()
      ORDER BY bc.company_id, bc.starts_at DESC
    ),
    overview AS (
      SELECT
        p.id AS plan_id,
        p.company_id,
        p.active,
        p.cycle_length_days,
        p.fixed_subscription_fee,
        p.inbound_order_fee,
        p.outbound_order_fee,
        p.packaging_fee,
        p.quality_check_fee,
        p.excess_volume_fee_per_day,
        p.excess_weight_fee_per_day,
        p.reserved_volume,
        p.reserved_weight,
        p.created_at AS plan_created_at,
        p.updated_at AS plan_updated_at,
        c.name AS company_name,
        c.status AS company_status,
        cc.id AS cycle_id,
        cc.starts_at AS cycle_starts_at,
        cc.ends_at AS cycle_ends_at,
        cc.status AS cycle_status,
        cc.created_at AS cycle_created_at,
        cc.updated_at AS cycle_updated_at,
        CASE
          WHEN cc.ends_at IS NOT NULL
            THEN CEIL(EXTRACT(EPOCH FROM (cc.ends_at - NOW())) / 86400)::int
          ELSE NULL
        END AS days_remaining,
        CASE
          WHEN cc.id IS NULL THEN 'none'
          WHEN cc.ends_at <= NOW() THEN 'expired'
          WHEN cc.status = 'renewed' THEN 'renewed'
          ELSE 'active'
        END AS cycle_display_status,
        CASE
          WHEN c.status = 'restricted' THEN 'restricted'
          WHEN NOT p.active OR cc.id IS NULL THEN 'inactive'
          ELSE 'operational'
        END AS billing_status
      FROM billing_plans p
      JOIN companies c ON c.id = p.company_id
      LEFT JOIN current_cycles cc ON cc.billing_plan_id = p.id
    )
    SELECT COUNT(*)::int AS total FROM overview o
    ${where}
  `;
}
function billingPlansOverviewListSql(query, tenantCompanyIds) {
    const { where } = buildPlansOverviewWhere(query, tenantCompanyIds);
    const sortCol = SORT_COLUMNS[query.sort_by ?? 'createdAt'] ?? 'o.plan_created_at';
    const sortDir = query.sort_dir === 'asc' ? client_1.Prisma.sql `ASC` : client_1.Prisma.sql `DESC`;
    return client_1.Prisma.sql `
    WITH current_cycles AS (
      SELECT DISTINCT ON (bc.company_id)
        bc.id,
        bc.company_id,
        bc.billing_plan_id,
        bc.starts_at,
        bc.ends_at,
        bc.status,
        bc.created_at,
        bc.updated_at
      FROM billing_cycles bc
      WHERE bc.status IN ('active', 'renewed')
        AND bc.starts_at <= NOW()
        AND bc.ends_at > NOW()
      ORDER BY bc.company_id, bc.starts_at DESC
    ),
    overview AS (
      SELECT
        p.id AS plan_id,
        p.company_id,
        p.active,
        p.cycle_length_days,
        p.fixed_subscription_fee,
        p.inbound_order_fee,
        p.outbound_order_fee,
        p.packaging_fee,
        p.quality_check_fee,
        p.excess_volume_fee_per_day,
        p.excess_weight_fee_per_day,
        p.reserved_volume,
        p.reserved_weight,
        p.created_at AS plan_created_at,
        p.updated_at AS plan_updated_at,
        c.name AS company_name,
        c.status AS company_status,
        cc.id AS cycle_id,
        cc.starts_at AS cycle_starts_at,
        cc.ends_at AS cycle_ends_at,
        cc.status AS cycle_status,
        cc.created_at AS cycle_created_at,
        cc.updated_at AS cycle_updated_at,
        CASE
          WHEN cc.ends_at IS NOT NULL
            THEN CEIL(EXTRACT(EPOCH FROM (cc.ends_at - NOW())) / 86400)::int
          ELSE NULL
        END AS days_remaining,
        CASE
          WHEN cc.id IS NULL THEN 'none'
          WHEN cc.ends_at <= NOW() THEN 'expired'
          WHEN cc.status = 'renewed' THEN 'renewed'
          ELSE 'active'
        END AS cycle_display_status,
        CASE
          WHEN c.status = 'restricted' THEN 'restricted'
          WHEN NOT p.active OR cc.id IS NULL THEN 'inactive'
          ELSE 'operational'
        END AS billing_status
      FROM billing_plans p
      JOIN companies c ON c.id = p.company_id
      LEFT JOIN current_cycles cc ON cc.billing_plan_id = p.id
    )
    SELECT * FROM overview o
    ${where}
    ORDER BY ${client_1.Prisma.raw(sortCol)} ${sortDir} NULLS LAST, o.plan_id ASC
    LIMIT ${query.limit}
    OFFSET ${query.offset}
  `;
}
function buildPlansOverviewWhere(query, tenantCompanyIds) {
    const clauses = [client_1.Prisma.sql `WHERE 1=1`];
    if (tenantCompanyIds?.length) {
        clauses.push(client_1.Prisma.sql `AND o.company_id IN (${client_1.Prisma.join(tenantCompanyIds)})`);
    }
    if (query.companyId) {
        clauses.push(client_1.Prisma.sql `AND o.company_id = ${query.companyId}::uuid`);
    }
    if (query.search?.trim()) {
        const term = `%${query.search.trim()}%`;
        clauses.push(client_1.Prisma.sql `AND o.company_name ILIKE ${term}`);
    }
    if (query.cycleStatus) {
        clauses.push(client_1.Prisma.sql `AND o.cycle_display_status = ${query.cycleStatus}`);
    }
    if (query.billingStatus) {
        clauses.push(client_1.Prisma.sql `AND o.billing_status = ${query.billingStatus}`);
    }
    if (query.daysRemaining) {
        switch (query.daysRemaining) {
            case 'none':
                clauses.push(client_1.Prisma.sql `AND o.cycle_id IS NULL`);
                break;
            case 'expired':
                clauses.push(client_1.Prisma.sql `AND (o.days_remaining IS NULL OR o.days_remaining <= 0)`);
                break;
            case 'critical':
                clauses.push(client_1.Prisma.sql `AND o.days_remaining BETWEEN 0 AND 7`);
                break;
            case 'warning':
                clauses.push(client_1.Prisma.sql `AND o.days_remaining BETWEEN 8 AND 30`);
                break;
            case 'healthy':
                clauses.push(client_1.Prisma.sql `AND o.days_remaining > 30`);
                break;
        }
    }
    if (query.expiryFrom) {
        clauses.push(client_1.Prisma.sql `AND o.cycle_ends_at >= ${query.expiryFrom}::date`);
    }
    if (query.expiryTo) {
        const end = `${query.expiryTo}T23:59:59.999Z`;
        clauses.push(client_1.Prisma.sql `AND o.cycle_ends_at <= ${end}::timestamptz`);
    }
    return { where: client_1.Prisma.join(clauses, ' ') };
}
//# sourceMappingURL=billing-plans-list.query.js.map
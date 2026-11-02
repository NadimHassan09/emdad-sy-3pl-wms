import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface FinancialPoliciesMap {
  cutover_active: boolean;
  cod_eligibility: 'on_remittance' | 'on_collection' | 'on_delivered';
  cod_holding_days: number;
  shipping_fee_timing: 'at_dispatch' | 'on_delivered';
  minimum_payout_amount: number;
}

const DEFAULT_POLICIES: Record<string, { value: string; description: string }> = {
  cutover_active: {
    value: 'true',
    description: 'Whether Financial Management is the active financial system',
  },
  cod_eligibility: {
    value: 'on_remittance',
    description: 'When COD is credited to available balance: on_remittance, on_collection, on_delivered',
  },
  cod_holding_days: {
    value: '0',
    description: 'Holding days after delivery before COD is eligible',
  },
  shipping_fee_timing: {
    value: 'at_dispatch',
    description: 'When shipping fee is debited to client account: at_dispatch or on_delivered',
  },
  minimum_payout_amount: {
    value: '10.00',
    description: 'Minimum allowed client payout request in USD',
  },
};

@Injectable()
export class FinancialPoliciesService {
  private readonly logger = new Logger(FinancialPoliciesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async getPolicyValue(key: string): Promise<string> {
    const row = await this.prisma.financialPolicy.findUnique({
      where: { key },
      select: { value: true },
    });
    if (row) return row.value;
    return DEFAULT_POLICIES[key]?.value ?? '';
  }

  async getAllPolicies() {
    const rows = await this.prisma.financialPolicy.findMany({
      orderBy: { key: 'asc' },
    });
    const keyMap = new Map(rows.map((r) => [r.key, r]));

    // Ensure all default policies appear in list
    const results = [];
    for (const [key, def] of Object.entries(DEFAULT_POLICIES)) {
      if (keyMap.has(key)) {
        results.push(keyMap.get(key)!);
      } else {
        results.push({
          id: `default-${key}`,
          key,
          value: def.value,
          description: def.description,
          updatedBy: null,
          updatedAt: new Date(),
        });
      }
    }
    return results;
  }

  async updatePolicy(key: string, value: string, userId?: string, description?: string) {
    this.validatePolicy(key, value);

    const updated = await this.prisma.financialPolicy.upsert({
      where: { key },
      create: {
        key,
        value,
        description: description ?? DEFAULT_POLICIES[key]?.description ?? null,
        updatedBy: userId ?? null,
      },
      update: {
        value,
        ...(description ? { description } : {}),
        updatedBy: userId ?? null,
      },
    });

    this.logger.log(`Financial policy updated: ${key} = ${value} by user ${userId}`);
    return updated;
  }

  private validatePolicy(key: string, value: string) {
    if (key === 'cutover_active') {
      if (value !== 'true' && value !== 'false') {
        throw new BadRequestException('cutover_active must be true or false');
      }
    } else if (key === 'cod_eligibility') {
      const allowed = ['on_remittance', 'on_collection', 'on_delivered'];
      if (!allowed.includes(value)) {
        throw new BadRequestException(`cod_eligibility must be one of: ${allowed.join(', ')}`);
      }
    } else if (key === 'cod_holding_days') {
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 0) {
        throw new BadRequestException('cod_holding_days must be a non-negative integer');
      }
    } else if (key === 'shipping_fee_timing') {
      const allowed = ['at_dispatch', 'on_delivered'];
      if (!allowed.includes(value)) {
        throw new BadRequestException(`shipping_fee_timing must be one of: ${allowed.join(', ')}`);
      }
    } else if (key === 'minimum_payout_amount') {
      const num = parseFloat(value);
      if (isNaN(num) || num < 0) {
        throw new BadRequestException('minimum_payout_amount must be a non-negative number');
      }
    }
  }

  async isCutoverActive(): Promise<boolean> {
    const val = await this.getPolicyValue('cutover_active');
    return val === 'true';
  }

  async getCodEligibility(): Promise<'on_remittance' | 'on_collection' | 'on_delivered'> {
    const val = await this.getPolicyValue('cod_eligibility');
    if (val === 'on_collection' || val === 'on_delivered') return val;
    return 'on_remittance';
  }

  async getCodHoldingDays(): Promise<number> {
    const val = await this.getPolicyValue('cod_holding_days');
    const num = parseInt(val, 10);
    return isNaN(num) || num < 0 ? 0 : num;
  }

  async getShippingFeeTiming(): Promise<'at_dispatch' | 'on_delivered'> {
    const val = await this.getPolicyValue('shipping_fee_timing');
    return val === 'on_delivered' ? 'on_delivered' : 'at_dispatch';
  }

  async getMinimumPayoutAmount(): Promise<number> {
    const val = await this.getPolicyValue('minimum_payout_amount');
    const num = parseFloat(val);
    return isNaN(num) || num < 0 ? 10.0 : num;
  }
}

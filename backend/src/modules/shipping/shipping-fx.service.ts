import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FX_AUTO_SOURCE,
  FX_FRESH_MS,
  FX_STALE_MS,
  fetchUsdToSypRate,
  type FxFetchResult,
} from './fx-source';

export type FxSettingsView = {
  mode: 'manual' | 'automatic';
  direction: '1 USD = R SYP';
  manualRate: number | null;
  autoSource: string | null;
  activeRate: number | null;
  activeSource: string | null;
  lastSuccessfulAt: string | null;
  stale: boolean;
  usable: boolean;
  lastError: string | null;
  updatedAt: string | null;
};

@Injectable()
export class ShippingFxService {
  static readonly ROW_ID = 'default';

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
  ) {}

  /** Overridden in tests. Production uses the global fetch. */
  fetchImpl: typeof fetch = fetch;

  async getSettings(): Promise<FxSettingsView> {
    const row = await this.prisma.shippingFxSettings.findUnique({
      where: { id: ShippingFxService.ROW_ID },
    });
    if (row?.mode === 'automatic') {
      const age = row.lastAutoAt ? Date.now() - row.lastAutoAt.getTime() : Infinity;
      if (age > FX_FRESH_MS) {
        await this.refreshAutomatic(row.updatedByUserId);
        return this.toView(
          await this.prisma.shippingFxSettings.findUnique({
            where: { id: ShippingFxService.ROW_ID },
          }),
        );
      }
    }
    return this.toView(row);
  }

  async saveManual(rate: number, user: { id: string; email?: string | null; role?: string | null; fullName?: string | null }) {
    if (!Number.isFinite(rate) || rate <= 0) {
      throw new BadRequestException('Enter a positive USD to SYP rate.');
    }
    const previous = await this.prisma.shippingFxSettings.findUnique({
      where: { id: ShippingFxService.ROW_ID },
    });
    const row = await this.prisma.shippingFxSettings.upsert({
      where: { id: ShippingFxService.ROW_ID },
      create: {
        id: ShippingFxService.ROW_ID,
        mode: 'manual',
        manualRate: rate,
        updatedByUserId: user.id,
        lastError: null,
      },
      update: {
        mode: 'manual',
        manualRate: rate,
        updatedByUserId: user.id,
        lastError: null,
      },
    });
    await this.audit.logBestEffort({
      actorId: user.id,
      actorEmail: user.email || `user-${user.id}@unknown.local`,
      actorName: user.fullName || user.email || user.id,
      actorRole: user.role || 'admin',
      action: 'shipping_fx_manual',
      resourceType: 'shipping_fx_settings',
      resourceId: ShippingFxService.ROW_ID,
      previousState: previous ? { mode: previous.mode, manualRate: previous.manualRate?.toString() } : null,
      newState: { mode: 'manual', manualRate: rate, direction: '1 USD = R SYP' },
    });
    return this.toView(row);
  }

  async saveAutomatic(user: { id: string; email?: string | null; role?: string | null; fullName?: string | null }) {
    const fetched = await fetchUsdToSypRate(this.fetchImpl);
    if (!fetched.ok) {
      await this.prisma.shippingFxSettings.upsert({
        where: { id: ShippingFxService.ROW_ID },
        create: {
          id: ShippingFxService.ROW_ID,
          mode: 'manual',
          autoSource: FX_AUTO_SOURCE,
          lastError: fetched.error,
          updatedByUserId: user.id,
        },
        update: { lastError: fetched.error, updatedByUserId: user.id },
      });
      throw new BadRequestException(
        `Automatic USD/SYP source failed (${fetched.error}). The previous rate was kept and no fallback rate was invented.`,
      );
    }
    const row = await this.prisma.shippingFxSettings.upsert({
      where: { id: ShippingFxService.ROW_ID },
      create: {
        id: ShippingFxService.ROW_ID,
        mode: 'automatic',
        autoSource: fetched.source,
        lastAutoRate: fetched.rate,
        lastAutoAt: new Date(fetched.fetchedAt),
        lastError: null,
        updatedByUserId: user.id,
      },
      update: {
        mode: 'automatic',
        autoSource: fetched.source,
        lastAutoRate: fetched.rate,
        lastAutoAt: new Date(fetched.fetchedAt),
        lastError: null,
        updatedByUserId: user.id,
      },
    });
    await this.audit.logBestEffort({
      actorId: user.id,
      actorEmail: user.email || `user-${user.id}@unknown.local`,
      actorName: user.fullName || user.email || user.id,
      actorRole: user.role || 'admin',
      action: 'shipping_fx_automatic',
      resourceType: 'shipping_fx_settings',
      resourceId: ShippingFxService.ROW_ID,
      newState: { mode: 'automatic', rate: fetched.rate, source: fetched.source },
    });
    return this.toView(row);
  }

  async testSource(): Promise<FxFetchResult> {
    return fetchUsdToSypRate(this.fetchImpl);
  }

  /** Rate allowed for a COD conversion. Null when missing, failed, or stale. */
  async usableRate(): Promise<{ rate: number; source: string; at: string } | null> {
    const view = await this.getSettings();
    if (!view.usable || view.activeRate == null || !view.activeSource || !view.lastSuccessfulAt) {
      return null;
    }
    return { rate: view.activeRate, source: view.activeSource, at: view.lastSuccessfulAt };
  }

  private async refreshAutomatic(userId: string | null) {
    const fetched = await fetchUsdToSypRate(this.fetchImpl);
    if (!fetched.ok) {
      await this.prisma.shippingFxSettings.update({
        where: { id: ShippingFxService.ROW_ID },
        data: { lastError: fetched.error },
      });
      return;
    }
    await this.prisma.shippingFxSettings.update({
      where: { id: ShippingFxService.ROW_ID },
      data: {
        autoSource: fetched.source,
        lastAutoRate: fetched.rate,
        lastAutoAt: new Date(fetched.fetchedAt),
        lastError: null,
        ...(userId ? { updatedByUserId: userId } : {}),
      },
    });
  }

  private toView(row: {
    mode: string;
    manualRate: { toString(): string } | null;
    autoSource: string | null;
    lastAutoRate: { toString(): string } | null;
    lastAutoAt: Date | null;
    lastError: string | null;
    updatedAt: Date;
  } | null): FxSettingsView {
    const mode = row?.mode === 'automatic' ? 'automatic' : 'manual';
    const manual = row?.manualRate != null ? Number(row.manualRate) : null;
    const auto = row?.lastAutoRate != null ? Number(row.lastAutoRate) : null;
    const autoAt = row?.lastAutoAt ?? null;
    const stale = mode === 'automatic' && (!autoAt || Date.now() - autoAt.getTime() > FX_STALE_MS);
    const activeRate = mode === 'automatic' ? auto : manual;
    const finite = activeRate != null && Number.isFinite(activeRate) && activeRate > 0;
    const usable = finite && !stale;
    return {
      mode,
      direction: '1 USD = R SYP',
      manualRate: manual != null && Number.isFinite(manual) ? manual : null,
      autoSource: row?.autoSource ?? (mode === 'automatic' ? FX_AUTO_SOURCE : null),
      activeRate: finite ? activeRate : null,
      activeSource: mode === 'automatic' ? row?.autoSource ?? FX_AUTO_SOURCE : manual != null ? 'manual' : null,
      lastSuccessfulAt:
        mode === 'automatic' ? autoAt?.toISOString() ?? null : row?.updatedAt?.toISOString() ?? null,
      stale,
      usable,
      lastError: row?.lastError ?? null,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }
}

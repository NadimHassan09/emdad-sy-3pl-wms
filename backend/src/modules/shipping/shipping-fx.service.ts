import { BadRequestException, Injectable } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  FX_CUSTOM_SOURCE_LABEL,
  fetchUsdToSypFromCustomApi,
  readFxCustomConfig,
  toPublicFxCustomConfig,
  writeFxCustomConfig,
  type FxCustomConfig,
  type FxCustomConfigPublic,
} from './fx-custom-config';
import {
  FX_AUTO_SOURCE,
  FX_FRESH_MS,
  FX_MIN_CHANGE_PERCENT,
  FX_STALE_MS,
  fetchUsdToSypRate,
  hoursToMs,
  rateMovedEnough,
  type FxFetchResult,
} from './fx-source';

export type FxSettingsView = {
  mode: 'manual' | 'automatic';
  direction: '1 USD = R SYP';
  manualRate: number | null;
  autoSource: string | null;
  autoSourceKind: 'builtin' | 'custom';
  custom: FxCustomConfigPublic;
  activeRate: number | null;
  activeSource: string | null;
  lastSuccessfulAt: string | null;
  stale: boolean;
  usable: boolean;
  lastError: string | null;
  refreshHours: number;
  staleHours: number;
  minChangePercent: number;
  updatedAt: string | null;
};

export type FxCustomSaveInput = {
  autoSourceKind?: 'builtin' | 'custom';
  customUrl?: string;
  customJsonPath?: string;
  customRateUnit?: 'old_syp' | 'new_syp';
  customAuthHeaderName?: string;
  customAuthHeaderValue?: string;
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
      if (age > hoursToMs(row.refreshHours, FX_FRESH_MS)) {
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
    // Leaving automatic mode — keep custom URL on disk but mark it inactive.
    const custom = readFxCustomConfig();
    if (custom.enabled) {
      writeFxCustomConfig({ ...custom, enabled: false });
    }
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

  async saveAutomatic(
    user: { id: string; email?: string | null; role?: string | null; fullName?: string | null },
    customInput: FxCustomSaveInput = {},
  ) {
    const kind = customInput.autoSourceKind ?? (readFxCustomConfig().enabled ? 'custom' : 'builtin');
    if (kind === 'custom') {
      this.persistCustomConfig({ ...customInput, enabled: true });
    } else {
      const existing = readFxCustomConfig();
      writeFxCustomConfig({ ...existing, enabled: false });
    }

    const fetched = await this.fetchActiveSource();
    if (!fetched.ok) {
      await this.prisma.shippingFxSettings.upsert({
        where: { id: ShippingFxService.ROW_ID },
        create: {
          id: ShippingFxService.ROW_ID,
          mode: 'manual',
          autoSource: fetched.source,
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
      newState: {
        mode: 'automatic',
        rate: fetched.rate,
        source: fetched.source,
        autoSourceKind: kind,
        customUrl: kind === 'custom' ? readFxCustomConfig().url : null,
      },
    });
    return this.toView(row);
  }

  async saveThresholds(
    input: { refreshHours?: number; staleHours?: number; minChangePercent?: number },
    user: { id: string; email?: string | null; role?: string | null; fullName?: string | null },
  ) {
    const data: Record<string, number> = {};
    if (input.refreshHours != null) data.refreshHours = input.refreshHours;
    if (input.staleHours != null) data.staleHours = input.staleHours;
    if (input.minChangePercent != null) data.minChangePercent = input.minChangePercent;
    if (Object.keys(data).length === 0) {
      return this.toView(
        await this.prisma.shippingFxSettings.findUnique({ where: { id: ShippingFxService.ROW_ID } }),
      );
    }
    if (data.staleHours != null && data.refreshHours != null && data.staleHours < data.refreshHours) {
      throw new BadRequestException('The stale limit must not be shorter than the refresh interval.');
    }
    const row = await this.prisma.shippingFxSettings.upsert({
      where: { id: ShippingFxService.ROW_ID },
      create: { id: ShippingFxService.ROW_ID, updatedByUserId: user.id, ...data },
      update: { updatedByUserId: user.id, ...data },
    });
    await this.audit.logBestEffort({
      actorId: user.id,
      actorEmail: user.email || `user-${user.id}@unknown.local`,
      actorName: user.fullName || user.email || user.id,
      actorRole: user.role || 'admin',
      action: 'shipping_fx_thresholds',
      resourceType: 'shipping_fx_settings',
      resourceId: ShippingFxService.ROW_ID,
      newState: data,
    });
    return this.toView(row);
  }

  async testSource(input: FxCustomSaveInput = {}): Promise<FxFetchResult> {
    const kind =
      input.autoSourceKind ??
      (input.customUrl || readFxCustomConfig().enabled ? 'custom' : 'builtin');
    if (kind === 'custom') {
      const stored = readFxCustomConfig();
      const url = input.customUrl?.trim() || stored.url;
      const jsonPath = input.customJsonPath?.trim() || stored.jsonPath;
      const rateUnit = input.customRateUnit ?? stored.rateUnit;
      const authHeaderName =
        input.customAuthHeaderName !== undefined
          ? input.customAuthHeaderName.trim() || null
          : stored.authHeaderName;
      const authHeaderValue =
        input.customAuthHeaderValue !== undefined
          ? input.customAuthHeaderValue || null
          : stored.authHeaderValue;
      return fetchUsdToSypFromCustomApi(
        { url, jsonPath, rateUnit, authHeaderName, authHeaderValue },
        this.fetchImpl,
      );
    }
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

  private persistCustomConfig(input: FxCustomSaveInput & { enabled: boolean }) {
    const prev = readFxCustomConfig();
    const url = input.customUrl?.trim() ?? prev.url;
    if (!url) {
      throw new BadRequestException('Enter the HTTPS URL of your exchange-rate JSON API.');
    }
    if (!/^https:\/\//i.test(url)) {
      throw new BadRequestException('Custom FX URL must use HTTPS.');
    }
    const jsonPath = input.customJsonPath?.trim() || prev.jsonPath || 'usd.syp';
    const rateUnit = input.customRateUnit ?? prev.rateUnit;
    let authHeaderName = prev.authHeaderName;
    let authHeaderValue = prev.authHeaderValue;
    if (input.customAuthHeaderName !== undefined) {
      authHeaderName = input.customAuthHeaderName.trim() || null;
    }
    if (input.customAuthHeaderValue !== undefined) {
      // Empty string clears the stored secret.
      authHeaderValue = input.customAuthHeaderValue.trim() ? input.customAuthHeaderValue : null;
    }
    if (authHeaderName && !authHeaderValue) {
      throw new BadRequestException(
        'Auth header name is set but no value is stored. Enter the header value once (it is kept secret).',
      );
    }
    const next: FxCustomConfig = {
      enabled: input.enabled,
      url,
      jsonPath,
      rateUnit,
      authHeaderName,
      authHeaderValue,
    };
    writeFxCustomConfig(next);
  }

  private async fetchActiveSource(): Promise<FxFetchResult> {
    const custom = readFxCustomConfig();
    if (custom.enabled) {
      return fetchUsdToSypFromCustomApi(
        {
          url: custom.url,
          jsonPath: custom.jsonPath,
          rateUnit: custom.rateUnit,
          authHeaderName: custom.authHeaderName,
          authHeaderValue: custom.authHeaderValue,
        },
        this.fetchImpl,
      );
    }
    return fetchUsdToSypRate(this.fetchImpl);
  }

  private async refreshAutomatic(userId: string | null) {
    const fetched = await this.fetchActiveSource();
    if (!fetched.ok) {
      await this.prisma.shippingFxSettings.update({
        where: { id: ShippingFxService.ROW_ID },
        data: { lastError: fetched.error },
      });
      return;
    }
    const current = await this.prisma.shippingFxSettings.findUnique({
      where: { id: ShippingFxService.ROW_ID },
    });
    const keepRate = !rateMovedEnough(
      current?.lastAutoRate != null ? Number(current.lastAutoRate) : null,
      fetched.rate,
      current?.minChangePercent != null ? Number(current.minChangePercent) : FX_MIN_CHANGE_PERCENT,
    );
    await this.prisma.shippingFxSettings.update({
      where: { id: ShippingFxService.ROW_ID },
      data: {
        autoSource: fetched.source,
        ...(keepRate ? {} : { lastAutoRate: fetched.rate }),
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
    refreshHours?: number | null;
    staleHours?: number | null;
    minChangePercent?: { toString(): string } | null;
    updatedAt: Date;
  } | null): FxSettingsView {
    const custom = toPublicFxCustomConfig(readFxCustomConfig());
    const mode = row?.mode === 'automatic' ? 'automatic' : 'manual';
    const manual = row?.manualRate != null ? Number(row.manualRate) : null;
    const auto = row?.lastAutoRate != null ? Number(row.lastAutoRate) : null;
    const autoAt = row?.lastAutoAt ?? null;
    const stale =
      mode === 'automatic' &&
      (!autoAt || Date.now() - autoAt.getTime() > hoursToMs(row?.staleHours, FX_STALE_MS));
    const activeRate = mode === 'automatic' ? auto : manual;
    const finite = activeRate != null && Number.isFinite(activeRate) && activeRate > 0;
    const usable = finite && !stale;
    const autoSourceKind: 'builtin' | 'custom' = custom.enabled ? 'custom' : 'builtin';
    const defaultSource =
      mode === 'automatic'
        ? custom.enabled
          ? FX_CUSTOM_SOURCE_LABEL
          : FX_AUTO_SOURCE
        : null;
    return {
      mode,
      direction: '1 USD = R SYP',
      manualRate: manual != null && Number.isFinite(manual) ? manual : null,
      autoSource: row?.autoSource ?? defaultSource,
      autoSourceKind,
      custom,
      activeRate: finite ? activeRate : null,
      activeSource:
        mode === 'automatic'
          ? row?.autoSource ?? defaultSource
          : manual != null
            ? 'manual'
            : null,
      lastSuccessfulAt:
        mode === 'automatic' ? autoAt?.toISOString() ?? null : row?.updatedAt?.toISOString() ?? null,
      stale,
      usable,
      lastError: row?.lastError ?? null,
      refreshHours: row?.refreshHours ?? 6,
      staleHours: row?.staleHours ?? 24,
      minChangePercent:
        row?.minChangePercent != null ? Number(row.minChangePercent) : FX_MIN_CHANGE_PERCENT,
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }
}

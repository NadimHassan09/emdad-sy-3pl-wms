import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type AuditLogPolicySnapshot = {
  retentionDays: number;
  retentionCutoffIso: string;
  queryMaxLimit: number;
  queryMaxOffset: number;
  queryMaxDateRangeDays: number;
  queryDefaultWindowDays: number;
  queryCountCap: number;
  exportMaxRows: number;
  exportMaxDateRangeDays: number;
  exportEnabled: boolean;
};

@Injectable()
export class AuditLogPolicyConfig {
  readonly retentionDays: number;
  readonly queryMaxLimit: number;
  readonly queryMaxOffset: number;
  readonly queryMaxDateRangeDays: number;
  readonly queryDefaultWindowDays: number;
  readonly queryCountCap: number;
  readonly exportMaxRows: number;
  readonly exportMaxDateRangeDays: number;
  readonly exportEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.retentionDays = this.readInt('AUDIT_RETENTION_DAYS', 730, 0, 3650);
    this.queryMaxLimit = this.readInt('AUDIT_QUERY_MAX_LIMIT', 100, 1, 100);
    this.queryMaxOffset = this.readInt('AUDIT_QUERY_MAX_OFFSET', 5000, 0, 50_000);
    this.queryMaxDateRangeDays = this.readInt('AUDIT_QUERY_MAX_DATE_RANGE_DAYS', 366, 1, 366);
    this.queryDefaultWindowDays = this.readInt('AUDIT_QUERY_DEFAULT_WINDOW_DAYS', 30, 1, 366);
    this.queryCountCap = this.readInt('AUDIT_QUERY_COUNT_CAP', 10_000, 100, 1_000_000);
    this.exportMaxRows = this.readInt('AUDIT_EXPORT_MAX_ROWS', 500, 1, 5000);
    this.exportMaxDateRangeDays = this.readInt('AUDIT_EXPORT_MAX_DATE_RANGE_DAYS', 90, 1, 366);
    this.exportEnabled = this.readBool('AUDIT_EXPORT_ENABLED', true);
  }

  retentionCutoffDate(now = new Date()): Date | null {
    if (this.retentionDays <= 0) return null;
    return new Date(now.getTime() - this.retentionDays * 86400_000);
  }

  snapshot(now = new Date()): AuditLogPolicySnapshot {
    const cutoff = this.retentionCutoffDate(now);
    return {
      retentionDays: this.retentionDays,
      retentionCutoffIso: cutoff?.toISOString() ?? '',
      queryMaxLimit: this.queryMaxLimit,
      queryMaxOffset: this.queryMaxOffset,
      queryMaxDateRangeDays: this.queryMaxDateRangeDays,
      queryDefaultWindowDays: this.queryDefaultWindowDays,
      queryCountCap: this.queryCountCap,
      exportMaxRows: this.exportMaxRows,
      exportMaxDateRangeDays: this.exportMaxDateRangeDays,
      exportEnabled: this.exportEnabled,
    };
  }

  private readInt(key: string, fallback: number, min: number, max: number): number {
    const raw = this.config.get<string>(key);
    if (raw === undefined || raw === '') return fallback;
    const n = parseInt(String(raw).trim(), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, min), max);
  }

  private readBool(key: string, fallback: boolean): boolean {
    const raw = (this.config.get<string>(key) ?? '').trim().toLowerCase();
    if (!raw) return fallback;
    if (['1', 'true', 'yes', 'on'].includes(raw)) return true;
    if (['0', 'false', 'no', 'off'].includes(raw)) return false;
    return fallback;
  }
}

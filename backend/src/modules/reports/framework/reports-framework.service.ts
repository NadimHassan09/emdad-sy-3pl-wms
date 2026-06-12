import { BadRequestException, Injectable } from '@nestjs/common';

import { AuthPrincipal } from '../../../common/auth/current-user.types';
import type { RunReportQueryDto } from '../dto/run-report-query.dto';
import { ReportsCacheService } from '../reports-cache.service';
import { ReportsPolicyConfig } from '../reports-policy.config';
import { normalizeReportQuery, validateReportFilters } from './report-filters.util';
import type { CachedReportResult, ReportRunPayload } from './report-framework.types';
import { assertReportAccess } from './report-permissions.util';
import { getReportDefinition } from './report-registry.config';

@Injectable()
export class ReportsFrameworkService {
  constructor(
    private readonly cache: ReportsCacheService,
    private readonly policy: ReportsPolicyConfig,
  ) {}

  resolveDefinition(reportId: string) {
    const def = getReportDefinition(reportId);
    if (!def) {
      throw new BadRequestException(`Unknown report: ${reportId}`);
    }
    return def;
  }

  assertAccess(user: AuthPrincipal, reportId: string) {
    assertReportAccess(user, reportId);
  }

  prepareQuery(user: AuthPrincipal, reportId: string, query: RunReportQueryDto): RunReportQueryDto {
    this.assertAccess(user, reportId);
    const def = this.resolveDefinition(reportId);
    const normalized = normalizeReportQuery(query);
    validateReportFilters(def, normalized);
    this.validatePagination(normalized);
    return normalized;
  }

  async runCached<T extends ReportRunPayload>(
    user: AuthPrincipal,
    reportId: string,
    query: RunReportQueryDto,
    namespace: 'run' | 'aggregate' | 'kpis',
    loader: () => Promise<T>,
    extraCacheKey: Record<string, unknown> = {},
  ): Promise<CachedReportResult<T>> {
    const prepared = this.prepareQuery(user, reportId, query);
    const cachePayload = { reportId, query: prepared, userId: user.id, ...extraCacheKey };
    const cached = await this.cache.get<T>(namespace, cachePayload);
    if (cached) return { ...cached, cached: true };
    const result = await loader();
    await this.cache.set(namespace, cachePayload, result);
    return { ...result, cached: false };
  }

  exportColumnsFor(reportId: string) {
    return this.resolveDefinition(reportId).exportColumns;
  }

  async getOrSetCache<T>(
    namespace: string,
    payload: Record<string, unknown>,
    loader: () => Promise<T>,
  ): Promise<{ value: T; cached: boolean }> {
    const cached = await this.cache.get<T>(namespace, payload);
    if (cached) return { value: cached, cached: true };
    const value = await loader();
    await this.cache.set(namespace, payload, value);
    return { value, cached: false };
  }

  private validatePagination(query: RunReportQueryDto) {
    if (query.limit > this.policy.previewMaxLimit) {
      throw new BadRequestException(`limit may not exceed ${this.policy.previewMaxLimit}.`);
    }
    if (query.offset > this.policy.previewMaxOffset) {
      throw new BadRequestException(`offset may not exceed ${this.policy.previewMaxOffset}.`);
    }
  }
}

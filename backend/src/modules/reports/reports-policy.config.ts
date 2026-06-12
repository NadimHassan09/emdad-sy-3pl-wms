import { Injectable } from '@nestjs/common';

import { listReportIds } from './framework/report-registry.config';

@Injectable()
export class ReportsPolicyConfig {
  /** Max rows per preview page request. */
  readonly previewMaxLimit = 200;

  /** Max offset for preview pagination. */
  readonly previewMaxOffset = 10_000;

  /** Max rows per export (all formats). */
  readonly exportMaxRows = 10_000;

  /** Redis / in-memory cache TTL for identical report runs (seconds). */
  readonly cacheTtlSec = 60;

  /** Max aggregate rows returned for chart/pivot views. */
  readonly aggregateMaxRows = 500;

  snapshot() {
    return {
      previewMaxLimit: this.previewMaxLimit,
      previewMaxOffset: this.previewMaxOffset,
      exportMaxRows: this.exportMaxRows,
      cacheTtlSec: this.cacheTtlSec,
      aggregateMaxRows: this.aggregateMaxRows,
      supportedFormats: ['csv', 'xls'] as const,
      reportIds: listReportIds(),
    };
  }
}

import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export interface ParsedOmsOrderNumber {
  raw: string;
  normalized: string;
  prefix: string;
  year: number;
  sequence: number;
}

/**
 * Parse and normalize an OMS order number.
 * Handles formats like:
 * - "OMS-2026-03700" -> normalized "OMS-2026-03700"
 * - "oms-2026-03700" -> normalized "OMS-2026-03700"
 * - "OMS-2026-3700"  -> normalized "OMS-2026-03700" (padded to 5 digits)
 * - "2026-03700"     -> normalized "OMS-2026-03700"
 * - "03700" or "3700"-> normalized "OMS-2026-03700" (current year)
 */
export function parseAndNormalizeOmsOrderNumber(
  input?: string | null,
): ParsedOmsOrderNumber | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Pattern 1: [Prefix]-[Year]-[Sequence] e.g. OMS-2026-03700
  const fullMatch = trimmed.match(/^([A-Za-z]+)-(\d{4})-(\d+)$/);
  if (fullMatch) {
    const prefix = fullMatch[1].toUpperCase();
    const year = parseInt(fullMatch[2], 10);
    const seq = parseInt(fullMatch[3], 10);
    const seqPadded = String(seq).padStart(5, '0');
    return {
      raw: trimmed,
      normalized: `${prefix}-${year}-${seqPadded}`,
      prefix,
      year,
      sequence: seq,
    };
  }

  // Pattern 2: [Year]-[Sequence] e.g. 2026-03700
  const yearSeqMatch = trimmed.match(/^(\d{4})-(\d+)$/);
  if (yearSeqMatch) {
    const prefix = 'OMS';
    const year = parseInt(yearSeqMatch[1], 10);
    const seq = parseInt(yearSeqMatch[2], 10);
    const seqPadded = String(seq).padStart(5, '0');
    return {
      raw: trimmed,
      normalized: `${prefix}-${year}-${seqPadded}`,
      prefix,
      year,
      sequence: seq,
    };
  }

  // Pattern 3: [Sequence only] e.g. 03700 or 3700
  const seqOnlyMatch = trimmed.match(/^(\d{1,8})$/);
  if (seqOnlyMatch) {
    const prefix = 'OMS';
    const year = new Date().getFullYear();
    const seq = parseInt(seqOnlyMatch[1], 10);
    const seqPadded = String(seq).padStart(5, '0');
    return {
      raw: trimmed,
      normalized: `${prefix}-${year}-${seqPadded}`,
      prefix,
      year,
      sequence: seq,
    };
  }

  return null;
}

export function validateOmsOrderNumberRange(
  startRaw?: string | null,
  endRaw?: string | null,
): {
  start?: ParsedOmsOrderNumber;
  end?: ParsedOmsOrderNumber;
  error?: string;
} {
  const hasStart = Boolean(startRaw?.trim());
  const hasEnd = Boolean(endRaw?.trim());

  if (!hasStart && !hasEnd) {
    return {};
  }

  let start: ParsedOmsOrderNumber | undefined;
  if (hasStart) {
    const parsed = parseAndNormalizeOmsOrderNumber(startRaw);
    if (!parsed) {
      return {
        error: `Invalid Start Order No. format "${startRaw?.trim()}". Expected format: OMS-YYYY-XXXXX (e.g. OMS-2026-03700).`,
      };
    }
    start = parsed;
  }

  let end: ParsedOmsOrderNumber | undefined;
  if (hasEnd) {
    const parsed = parseAndNormalizeOmsOrderNumber(endRaw);
    if (!parsed) {
      return {
        error: `Invalid End Order No. format "${endRaw?.trim()}". Expected format: OMS-YYYY-XXXXX (e.g. OMS-2026-03800).`,
      };
    }
    end = parsed;
  }

  if (start && end) {
    // Validate that start <= end
    const isGreater =
      start.year > end.year ||
      (start.year === end.year && start.sequence > end.sequence) ||
      (start.year === end.year &&
        start.sequence === end.sequence &&
        start.normalized > end.normalized);

    if (isGreater) {
      return {
        error: `Start Order No. (${start.normalized}) must be less than or equal to End Order No. (${end.normalized}).`,
      };
    }
  }

  return { start, end };
}

/**
 * Build Prisma WHERE condition for order number range.
 * Throws BadRequestException if format or range order is invalid.
 */
export function buildOmsOrderNumberRangePrismaCondition(
  startRaw?: string | null,
  endRaw?: string | null,
): Prisma.OmsOrderWhereInput | null {
  const result = validateOmsOrderNumberRange(startRaw, endRaw);

  if (result.error) {
    throw new BadRequestException(result.error);
  }

  if (result.start && result.end) {
    return {
      orderNumber: {
        gte: result.start.normalized,
        lte: result.end.normalized,
      },
    };
  }

  if (result.start) {
    return {
      orderNumber: {
        gte: result.start.normalized,
      },
    };
  }

  if (result.end) {
    return {
      orderNumber: {
        lte: result.end.normalized,
      },
    };
  }

  return null;
}

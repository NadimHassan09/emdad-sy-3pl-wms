import { REPORT_CATALOG, type ReportCatalogId } from './report-catalog'

/** Manifest-native report center paths (excludes OMS redirects like cod/returns). */
export const REPORT_CENTER_PATHS = REPORT_CATALOG.filter((entry) =>
  entry.path.startsWith('/reports/'),
).map((entry) => entry.path)

export function getReportIdFromPath(pathname: string): ReportCatalogId | null {
  const entry = REPORT_CATALOG.find((e) => e.path === pathname)
  return entry?.id ?? null
}

/**
 * Frontend-only flag to show or hide OMS COD and OMS Returns UI surfaces.
 * Pages, routes, APIs, and permissions remain intact; when false, nav is hidden
 * and direct URLs redirect to the OMS Dashboard.
 *
 * Re-enable: set OMS_COD_RETURNS_UI_ENABLED=true at frontend build time.
 */
declare const __OMS_COD_RETURNS_UI_ENABLED__: string | undefined;

function parseFlag(value: string | undefined): boolean {
  if (value == null || value === '') return false;
  const normalized = value.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function readBuildFlag(): string | undefined {
  try {
    // Vitest does not inject Vite `define` globals; treat missing as disabled.
    return typeof __OMS_COD_RETURNS_UI_ENABLED__ === 'undefined'
      ? undefined
      : __OMS_COD_RETURNS_UI_ENABLED__;
  } catch {
    return undefined;
  }
}

/** Temporarily defaults to hidden until explicitly re-enabled. */
export function isOmsCodReturnsUiEnabled(): boolean {
  return parseFlag(readBuildFlag());
}

/** Paths owned by the temporarily hidden OMS COD / Returns modules. */
export function isOmsCodReturnsPath(pathname: string): boolean {
  const p = pathname.split('?')[0]?.split('#')[0] ?? pathname;
  return (
    p === '/oms/cod' ||
    p.startsWith('/oms/cod/') ||
    p === '/oms/returns' ||
    p.startsWith('/oms/returns/') ||
    p === '/reports/oms/cod' ||
    p.startsWith('/reports/oms/cod/') ||
    p === '/reports/oms/returns' ||
    p.startsWith('/reports/oms/returns/') ||
    p === '/reports/cod-report' ||
    p === '/reports/returns-report'
  );
}

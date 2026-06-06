import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import type { Page } from '@playwright/test';

const EVIDENCE_ROOT = join(process.cwd(), 'docs/evidence/release-r3-e2e');

export async function r3Screenshot(page: Page, suite: string, step: string): Promise<string> {
  const dir = join(EVIDENCE_ROOT, suite);
  mkdirSync(dir, { recursive: true });
  const safe = step.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  const path = join(dir, `${safe}.png`);
  await page.screenshot({ path, fullPage: true });
  return path.replace(process.cwd() + '/', '');
}

export function evidenceRelPath(suite: string, step: string): string {
  const safe = step.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
  return `docs/evidence/release-r3-e2e/${suite}/${safe}.png`;
}

export { EVIDENCE_ROOT };

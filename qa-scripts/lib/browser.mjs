// Opens your own Chrome with a saved profile, so you log in once (the scripts never see or type passwords).
import { chromium } from '@playwright/test';
import os from 'node:os';
import path from 'node:path';

export async function openSite(siteName, { mobile = false } = {}) {
  const profileDir = process.env.QA_PROFILE_DIR || path.join(os.homedir(), '.emdad-qa-profile', siteName);
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: process.env.QA_BROWSER_CHANNEL === 'chromium' ? undefined : process.env.QA_BROWSER_CHANNEL || 'chrome', // 'msedge' for Edge, 'chromium' for the bundled browser
    headless: process.env.QA_HEADLESS === '1',
    viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
    locale: 'en-US',
  });
  const page = context.pages()[0] || (await context.newPage());
  return { context, page };
}

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Handlebars from 'handlebars';
import type { Browser, PuppeteerNode } from 'puppeteer';

import { DocLang } from './i18n';

// puppeteer (v23+) ships as ESM only. Under a CommonJS build a plain
// `import puppeteer from 'puppeteer'` compiles to `require('puppeteer')`, which
// throws ERR_REQUIRE_ESM on Node runtimes that don't allow require(esm).
// This native dynamic import is built via `Function` so TypeScript will not
// down-level it to require(), keeping it ESM-safe on every Node version.
// eslint-disable-next-line @typescript-eslint/no-implied-eval, no-new-func
const importPuppeteer = new Function('return import("puppeteer")') as () => Promise<{
  default: PuppeteerNode;
}>;

export type RenderableTemplate = 'grn' | 'dn' | 'final_contract' | 'invoice' | 'api_docs';

export interface RenderFooter {
  lang: DocLang;
  dir: 'ltr' | 'rtl';
  companyLine: string;
  generatedBy: string;
  confidential: string;
  pageWord: string;
  ofWord: string;
}

/**
 * Reusable PDF rendering engine.
 *
 * - Compiles Handlebars HTML templates (layout + grn/dn) once at startup.
 * - Embeds the Cairo font (Arabic + Latin) and logo as data URIs so the
 *   rendered PDF is fully self-contained and reproducible (no network).
 * - Renders A4 portrait, print-ready PDFs through a single shared Chromium.
 */
@Injectable()
export class PdfService implements OnModuleDestroy {
  private readonly logger = new Logger(PdfService.name);
  private browser: Browser | null = null;
  private browserPromise: Promise<Browser> | null = null;
  private puppeteerMod: PuppeteerNode | null = null;

  private readonly assetsDir = join(__dirname, 'assets');
  private readonly templatesDir = join(__dirname, 'templates');
  private readonly stylesDir = join(__dirname, 'styles');

  private readonly css = readFileSync(join(this.stylesDir, 'pdf.css'), 'utf8');
  private readonly fontFace = this.buildFontFace();
  private readonly logoDataUri = this.buildLogoDataUri();

  private readonly layoutTpl = Handlebars.compile(
    readFileSync(join(this.templatesDir, 'layout.html'), 'utf8'),
  );
  private readonly contentTpl: Record<RenderableTemplate, HandlebarsTemplateDelegate> = {
    grn: Handlebars.compile(readFileSync(join(this.templatesDir, 'grn.html'), 'utf8')),
    dn: Handlebars.compile(readFileSync(join(this.templatesDir, 'dn.html'), 'utf8')),
    final_contract: Handlebars.compile(
      readFileSync(join(this.templatesDir, 'final-contract.html'), 'utf8'),
    ),
    invoice: Handlebars.compile(readFileSync(join(this.templatesDir, 'invoice.html'), 'utf8')),
    api_docs: Handlebars.compile(readFileSync(join(this.templatesDir, 'api-docs.html'), 'utf8')),
  };

  /** Cairo variable font covers both Arabic and Latin glyphs across all weights. */
  private buildFontFace(): string {
    try {
      const ttf = readFileSync(join(this.assetsDir, 'fonts', 'Cairo.ttf'));
      const b64 = ttf.toString('base64');
      return `@font-face{font-family:'Cairo';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
    } catch (err) {
      this.logger.warn(`Cairo font asset missing — falling back to system fonts: ${String(err)}`);
      return '';
    }
  }

  private buildLogoDataUri(): string {
    try {
      const png = readFileSync(join(this.assetsDir, 'logo.png'));
      return `data:image/png;base64,${png.toString('base64')}`;
    } catch (err) {
      this.logger.warn(`Logo asset missing: ${String(err)}`);
      return '';
    }
  }

  get logo(): string {
    return this.logoDataUri;
  }

  private async loadPuppeteer(): Promise<PuppeteerNode> {
    if (!this.puppeteerMod) {
      const mod = await importPuppeteer();
      this.puppeteerMod = mod.default ?? (mod as unknown as PuppeteerNode);
    }
    return this.puppeteerMod;
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser?.connected) return this.browser;
    if (!this.browserPromise) {
      this.browserPromise = (async () => {
        const pptr = await this.loadPuppeteer();
        const browser = await pptr.launch({
          headless: true,
          executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--font-render-hinting=none',
          ],
        });
        this.browser = browser;
        return browser;
      })().catch((err) => {
        this.browserPromise = null;
        throw err;
      });
    }
    return this.browserPromise;
  }

  /** Render a document template + context into an A4 PDF buffer. */
  async render(
    template: RenderableTemplate,
    context: Record<string, unknown>,
    footer: RenderFooter,
  ): Promise<Buffer> {
    const content = this.contentTpl[template](context);
    const html = this.layoutTpl({
      ...context,
      styles: this.css,
      fontFace: this.fontFace,
      content,
    });

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load' });
      // Ensure embedded webfonts are ready before painting to avoid tofu glyphs.
      await page.evaluateHandle('document.fonts.ready');
      const pdf = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: false,
        displayHeaderFooter: true,
        headerTemplate: '<span></span>',
        footerTemplate: this.footerTemplate(footer),
        margin: { top: '12mm', bottom: '18mm', left: '10mm', right: '10mm' },
      });
      return Buffer.from(pdf);
    } finally {
      await page.close().catch(() => undefined);
    }
  }

  /** Puppeteer header/footer templates are isolated documents — inline styles required here. */
  private footerTemplate(f: RenderFooter): string {
    return `
      <div style="width:100%;font-family:'Cairo',Arial,sans-serif;font-size:7px;color:#555555;
                  padding:0 10mm;direction:${f.dir};box-sizing:border-box;">
        <div style="border-top:1px solid #cccccc;padding-top:3px;display:flex;
                    justify-content:space-between;align-items:center;gap:8px;">
          <div style="text-align:start;line-height:1.4;">
            <div style="color:#08452c;font-weight:600;">${this.escape(f.companyLine)}</div>
            <div>${this.escape(f.generatedBy)}</div>
          </div>
          <div style="text-align:end;line-height:1.4;white-space:nowrap;">
            <div style="font-weight:600;">${this.escape(f.confidential)}</div>
            <div>${this.escape(f.pageWord)} <span class="pageNumber"></span> ${this.escape(
              f.ofWord,
            )} <span class="totalPages"></span></div>
          </div>
        </div>
      </div>`;
  }

  private escape(s: string): string {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.browser) {
      await this.browser.close().catch(() => undefined);
      this.browser = null;
      this.browserPromise = null;
    }
  }
}

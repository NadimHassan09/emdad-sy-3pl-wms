"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var PdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PdfService = void 0;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const common_1 = require("@nestjs/common");
const handlebars_1 = __importDefault(require("handlebars"));
const importPuppeteer = new Function('return import("puppeteer")');
let PdfService = PdfService_1 = class PdfService {
    logger = new common_1.Logger(PdfService_1.name);
    browser = null;
    browserPromise = null;
    puppeteerMod = null;
    assetsDir = (0, node_path_1.join)(__dirname, 'assets');
    templatesDir = (0, node_path_1.join)(__dirname, 'templates');
    stylesDir = (0, node_path_1.join)(__dirname, 'styles');
    css = (0, node_fs_1.readFileSync)((0, node_path_1.join)(this.stylesDir, 'pdf.css'), 'utf8');
    fontFace = this.buildFontFace();
    logoDataUri = this.buildLogoDataUri();
    layoutTpl = handlebars_1.default.compile((0, node_fs_1.readFileSync)((0, node_path_1.join)(this.templatesDir, 'layout.html'), 'utf8'));
    contentTpl = {
        grn: handlebars_1.default.compile((0, node_fs_1.readFileSync)((0, node_path_1.join)(this.templatesDir, 'grn.html'), 'utf8')),
        dn: handlebars_1.default.compile((0, node_fs_1.readFileSync)((0, node_path_1.join)(this.templatesDir, 'dn.html'), 'utf8')),
        final_contract: handlebars_1.default.compile((0, node_fs_1.readFileSync)((0, node_path_1.join)(this.templatesDir, 'final-contract.html'), 'utf8')),
        invoice: handlebars_1.default.compile((0, node_fs_1.readFileSync)((0, node_path_1.join)(this.templatesDir, 'invoice.html'), 'utf8')),
        api_docs: handlebars_1.default.compile((0, node_fs_1.readFileSync)((0, node_path_1.join)(this.templatesDir, 'api-docs.html'), 'utf8')),
    };
    buildFontFace() {
        try {
            const ttf = (0, node_fs_1.readFileSync)((0, node_path_1.join)(this.assetsDir, 'fonts', 'Cairo.ttf'));
            const b64 = ttf.toString('base64');
            return `@font-face{font-family:'Cairo';font-style:normal;font-weight:100 900;font-display:swap;src:url(data:font/ttf;base64,${b64}) format('truetype');}`;
        }
        catch (err) {
            this.logger.warn(`Cairo font asset missing — falling back to system fonts: ${String(err)}`);
            return '';
        }
    }
    buildLogoDataUri() {
        try {
            const png = (0, node_fs_1.readFileSync)((0, node_path_1.join)(this.assetsDir, 'logo.png'));
            return `data:image/png;base64,${png.toString('base64')}`;
        }
        catch (err) {
            this.logger.warn(`Logo asset missing: ${String(err)}`);
            return '';
        }
    }
    get logo() {
        return this.logoDataUri;
    }
    async loadPuppeteer() {
        if (!this.puppeteerMod) {
            const mod = await importPuppeteer();
            this.puppeteerMod = mod.default ?? mod;
        }
        return this.puppeteerMod;
    }
    async getBrowser() {
        if (this.browser?.connected)
            return this.browser;
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
    async render(template, context, footer) {
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
        }
        finally {
            await page.close().catch(() => undefined);
        }
    }
    footerTemplate(f) {
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
            <div>${this.escape(f.pageWord)} <span class="pageNumber"></span> ${this.escape(f.ofWord)} <span class="totalPages"></span></div>
          </div>
        </div>
      </div>`;
    }
    escape(s) {
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close().catch(() => undefined);
            this.browser = null;
            this.browserPromise = null;
        }
    }
};
exports.PdfService = PdfService;
exports.PdfService = PdfService = PdfService_1 = __decorate([
    (0, common_1.Injectable)()
], PdfService);
//# sourceMappingURL=pdf.service.js.map
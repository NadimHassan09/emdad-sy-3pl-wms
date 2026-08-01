"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var InvoicePdfService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InvoicePdfService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
const prisma_service_1 = require("../common/prisma/prisma.service");
const branding_1 = require("./branding");
const i18n_1 = require("./i18n");
const pdf_context_util_1 = require("./pdf-context.util");
const pdf_service_1 = require("./pdf.service");
const LINE_TYPE_LABELS = {
    subscription: 'Fixed subscription',
    inbound: 'Inbound orders',
    outbound: 'Outbound orders (tiered)',
    packaging: 'Packaging',
    quality_check: 'Quality check',
    excess_volume: 'Excess volume',
    excess_weight: 'Excess weight',
    manual: 'Manual charge',
    order_charge: 'Order charge (VAS)',
};
let InvoicePdfService = InvoicePdfService_1 = class InvoicePdfService {
    prisma;
    pdf;
    logger = new common_1.Logger(InvoicePdfService_1.name);
    branding;
    constructor(prisma, pdf, config) {
        this.prisma = prisma;
        this.pdf = pdf;
        this.branding = (0, branding_1.resolveBranding)(config);
    }
    async renderInvoicePdf(invoiceId) {
        const invoice = await this.prisma.invoice.findUnique({
            where: { id: invoiceId },
            include: {
                company: {
                    select: {
                        name: true,
                        tradeName: true,
                        contactEmail: true,
                        contactPhone: true,
                        address: true,
                        city: true,
                        country: true,
                    },
                },
                billingCycle: {
                    select: { startsAt: true, endsAt: true },
                },
                lines: {
                    orderBy: [{ lineSource: 'asc' }, { createdAt: 'asc' }],
                },
            },
        });
        if (!invoice) {
            throw new common_1.NotFoundException(`Invoice ${invoiceId} not found`);
        }
        const lang = 'en';
        const L = {
            ...(0, i18n_1.buildLabels)(lang),
            description: 'Description',
            quantity: 'Qty',
            unitPrice: 'Unit price',
            total: 'Total',
            billTo: 'Bill to',
            invoiceDetails: 'Invoice details',
            dueDate: 'Due date',
            billingCycle: 'Billing cycle',
            subtotal: 'Subtotal',
            discount: 'Discount',
            vat: 'VAT',
            grandTotal: 'Grand total',
        };
        const cycleLabel = invoice.billingCycle != null
            ? `${(0, i18n_1.formatDocDate)(invoice.billingCycle.startsAt, lang)} – ${(0, i18n_1.formatDocDate)(invoice.billingCycle.endsAt, lang)}`
            : null;
        const lines = invoice.lines.map((line) => ({
            description: line.description?.trim() ||
                LINE_TYPE_LABELS[line.type] ||
                line.type.replace(/_/g, ' '),
            quantity: Number(line.quantity).toFixed(2),
            unitPrice: Number(line.unitPrice).toFixed(2),
            total: Number(line.totalPrice).toFixed(2),
        }));
        const context = {
            lang,
            dir: 'ltr',
            L,
            brand: (0, pdf_context_util_1.brandContext)(this.branding, lang, this.pdf.logo),
            header: {
                titleMain: 'Tax Invoice',
                titleAbbr: 'Invoice',
                referenceNo: `Invoice No: ${invoice.invoiceNumber}`,
                issueDate: invoice.issuedAt
                    ? (0, i18n_1.formatDocDate)(invoice.issuedAt, lang)
                    : (0, i18n_1.formatDocDate)(invoice.createdAt, lang),
                barcode: '',
            },
            customer: {
                name: invoice.company.tradeName || invoice.company.name,
                email: invoice.company.contactEmail ?? '',
                phone: invoice.company.contactPhone ?? '',
                address: [invoice.company.address, invoice.company.city, invoice.company.country]
                    .filter(Boolean)
                    .join(', '),
            },
            dueDate: invoice.dueDate ? (0, i18n_1.formatDocDate)(invoice.dueDate, lang) : '—',
            cycleLabel,
            lines,
            totals: {
                subtotal: Number(invoice.subtotalAmount).toFixed(2),
                discount: Number(invoice.discountAmount) > 0
                    ? Number(invoice.discountAmount).toFixed(2)
                    : '',
                vatPercentage: Number(invoice.vatPercentage).toFixed(2),
                vat: Number(invoice.vatAmount).toFixed(2),
                grandTotal: Number(invoice.grandTotal).toFixed(2),
            },
        };
        const footer = (0, pdf_context_util_1.footerContext)(this.branding, lang, (0, i18n_1.buildLabels)(lang));
        return this.pdf.render('invoice', context, footer);
    }
};
exports.InvoicePdfService = InvoicePdfService;
exports.InvoicePdfService = InvoicePdfService = InvoicePdfService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        pdf_service_1.PdfService,
        config_1.ConfigService])
], InvoicePdfService);
//# sourceMappingURL=invoice-pdf.service.js.map
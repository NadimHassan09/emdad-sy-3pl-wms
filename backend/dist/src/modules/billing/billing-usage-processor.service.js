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
var BillingUsageProcessorService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.BillingUsageProcessorService = void 0;
const common_1 = require("@nestjs/common");
const schedule_1 = require("@nestjs/schedule");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const cron_leader_service_1 = require("../../common/cron/cron-leader.service");
const billing_invoice_calculation_service_1 = require("./billing-invoice-calculation.service");
let BillingUsageProcessorService = BillingUsageProcessorService_1 = class BillingUsageProcessorService {
    prisma;
    invoiceCalc;
    cronLeader;
    log = new common_1.Logger(BillingUsageProcessorService_1.name);
    constructor(prisma, invoiceCalc, cronLeader) {
        this.prisma = prisma;
        this.invoiceCalc = invoiceCalc;
        this.cronLeader = cronLeader;
    }
    async tick() {
        await this.cronLeader.runExclusive('billing-usage-processor', 7200, () => this.runTick());
    }
    async runTick() {
        try {
            const now = new Date();
            const cycles = await this.prisma.billingCycle.findMany({
                where: {
                    status: { in: ['active', 'renewed'] },
                    startsAt: { lte: now },
                    endsAt: { gt: now },
                },
                select: { companyId: true },
                distinct: ['companyId'],
            });
            let n = 0;
            for (const { companyId } of cycles) {
                const result = await this.invoiceCalc.recalculateForCompany(companyId, 'scheduled_usage');
                if (result)
                    n++;
            }
            if (n > 0) {
                this.log.log(`Recalculated usage billing for ${n} active cycle(s).`);
            }
        }
        catch (err) {
            this.log.error('Billing usage processor tick failed', err);
        }
    }
};
exports.BillingUsageProcessorService = BillingUsageProcessorService;
__decorate([
    (0, schedule_1.Cron)('0 4 * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], BillingUsageProcessorService.prototype, "tick", null);
exports.BillingUsageProcessorService = BillingUsageProcessorService = BillingUsageProcessorService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        billing_invoice_calculation_service_1.BillingInvoiceCalculationService,
        cron_leader_service_1.CronLeaderService])
], BillingUsageProcessorService);
//# sourceMappingURL=billing-usage-processor.service.js.map
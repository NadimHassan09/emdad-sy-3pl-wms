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
var FormsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.FormsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../common/prisma/prisma.service");
function endOfDay(iso) {
    const d = new Date(iso);
    if (iso.length <= 10) {
        d.setUTCHours(23, 59, 59, 999);
    }
    return d;
}
let FormsService = FormsService_1 = class FormsService {
    prisma;
    logger = new common_1.Logger(FormsService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async submit(dto, meta) {
        const submission = await this.prisma.leadFormSubmission.create({
            data: {
                fullName: dto.fullName,
                phone: dto.phone,
                email: dto.email,
                activityType: dto.activityType,
                message: dto.message?.trim() ? dto.message.trim() : null,
            },
            select: { id: true, createdAt: true },
        });
        this.logger.log(`lead submission received id=${submission.id} activity="${dto.activityType}" ` +
            `origin=${meta?.origin ?? 'n/a'} ip=${meta?.ip ?? 'n/a'}`);
        return { id: submission.id, createdAt: submission.createdAt, received: true };
    }
    async list(_user, query) {
        const and = [];
        if (query.search?.trim()) {
            const q = query.search.trim();
            and.push({
                OR: [
                    { fullName: { contains: q, mode: 'insensitive' } },
                    { phone: { contains: q, mode: 'insensitive' } },
                    { email: { contains: q, mode: 'insensitive' } },
                ],
            });
        }
        if (query.activityType?.trim()) {
            and.push({ activityType: { equals: query.activityType.trim(), mode: 'insensitive' } });
        }
        if (query.createdFrom || query.createdTo) {
            const createdAt = {};
            if (query.createdFrom)
                createdAt.gte = new Date(query.createdFrom);
            if (query.createdTo)
                createdAt.lte = endOfDay(query.createdTo);
            and.push({ createdAt });
        }
        const where = and.length ? { AND: and } : {};
        const sort = query.sort === 'asc' ? 'asc' : 'desc';
        const [items, total] = await Promise.all([
            this.prisma.leadFormSubmission.findMany({
                where,
                orderBy: { createdAt: sort },
                take: query.limit,
                skip: query.offset,
            }),
            this.prisma.leadFormSubmission.count({ where }),
        ]);
        return { items, total, limit: query.limit, offset: query.offset };
    }
    async findById(id) {
        const submission = await this.prisma.leadFormSubmission.findUnique({ where: { id } });
        if (!submission)
            throw new common_1.NotFoundException('Lead submission not found.');
        return submission;
    }
    async remove(id, user) {
        const existing = await this.prisma.leadFormSubmission.findUnique({
            where: { id },
            select: { id: true },
        });
        if (!existing)
            throw new common_1.NotFoundException('Lead submission not found.');
        await this.prisma.leadFormSubmission.delete({ where: { id } });
        this.logger.warn(`lead submission deleted id=${id} by=${user.id}`);
        return { id, deleted: true };
    }
    async activityTypes() {
        const rows = await this.prisma.leadFormSubmission.findMany({
            distinct: ['activityType'],
            select: { activityType: true },
            orderBy: { activityType: 'asc' },
        });
        return rows.map((r) => r.activityType).filter(Boolean);
    }
};
exports.FormsService = FormsService;
exports.FormsService = FormsService = FormsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], FormsService);
//# sourceMappingURL=forms.service.js.map
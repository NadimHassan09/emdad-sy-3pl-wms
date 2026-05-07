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
Object.defineProperty(exports, "__esModule", { value: true });
exports.CompaniesService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../common/prisma/prisma.service");
const COMPANY_LIST_SELECT = {
    id: true,
    name: true,
    tradeName: true,
    contactEmail: true,
    contactPhone: true,
    country: true,
    city: true,
    address: true,
    status: true,
    billingCycle: true,
    paymentTermsDays: true,
    notes: true,
    createdAt: true,
    updatedAt: true,
};
let CompaniesService = class CompaniesService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    list(query) {
        const where = {};
        if (!query.includeAll) {
            where.status = client_1.CompanyStatus.active;
        }
        if (query.search?.trim()) {
            const t = query.search.trim();
            where.OR = [
                { name: { contains: t, mode: 'insensitive' } },
                { tradeName: { contains: t, mode: 'insensitive' } },
                { contactEmail: { contains: t, mode: 'insensitive' } },
            ];
        }
        return this.prisma.company.findMany({
            where,
            orderBy: { name: 'asc' },
            select: COMPANY_LIST_SELECT,
        });
    }
    async findById(id) {
        const company = await this.prisma.company.findUnique({
            where: { id },
            select: COMPANY_LIST_SELECT,
        });
        if (!company)
            throw new common_1.NotFoundException('Company not found.');
        return company;
    }
    async create(dto) {
        return this.prisma.company.create({
            data: {
                name: dto.name.trim(),
                tradeName: dto.tradeName?.trim() || null,
                contactEmail: dto.contactEmail.trim().toLowerCase(),
                country: (dto.country ?? 'SA').trim(),
                city: dto.city?.trim() || null,
                contactPhone: dto.contactPhone?.trim() || null,
                address: dto.address?.trim() || null,
                notes: dto.notes?.trim() || null,
                status: client_1.CompanyStatus.active,
            },
            select: COMPANY_LIST_SELECT,
        });
    }
    async update(id, dto) {
        await this.ensureExists(id);
        const data = {};
        if (dto.name !== undefined)
            data.name = dto.name.trim();
        if (dto.tradeName !== undefined)
            data.tradeName = dto.tradeName?.trim() || null;
        if (dto.contactEmail !== undefined)
            data.contactEmail = dto.contactEmail.trim().toLowerCase();
        if (dto.country !== undefined)
            data.country = dto.country.trim();
        if (dto.city !== undefined)
            data.city = dto.city?.trim() || null;
        if (dto.contactPhone !== undefined)
            data.contactPhone = dto.contactPhone?.trim() || null;
        if (dto.address !== undefined)
            data.address = dto.address?.trim() || null;
        if (dto.notes !== undefined)
            data.notes = dto.notes?.trim() || null;
        if (dto.status !== undefined)
            data.status = dto.status;
        return this.prisma.company.update({
            where: { id },
            data,
            select: COMPANY_LIST_SELECT,
        });
    }
    async suspend(id) {
        return this.update(id, { status: client_1.CompanyStatus.paused });
    }
    async softDelete(id) {
        return this.update(id, { status: client_1.CompanyStatus.closed });
    }
    async ensureExists(id) {
        const n = await this.prisma.company.count({ where: { id } });
        if (!n)
            throw new common_1.NotFoundException('Company not found.');
    }
    async remove(id) {
        await this.ensureExists(id);
        try {
            await this.prisma.company.delete({ where: { id } });
            return { id, deleted: true };
        }
        catch (e) {
            if (e instanceof client_1.Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
                throw new common_1.ConflictException('This company has related data (products, orders, etc.). It was not deleted — use Close to mark it closed, or remove dependent records first.');
            }
            throw e;
        }
    }
};
exports.CompaniesService = CompaniesService;
exports.CompaniesService = CompaniesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], CompaniesService);
//# sourceMappingURL=companies.service.js.map
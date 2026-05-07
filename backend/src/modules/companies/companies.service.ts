import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCompanyDto } from './dto/create-company.dto';
import { ListCompaniesQueryDto } from './dto/list-companies-query.dto';
import { UpdateCompanyDto } from './dto/update-company.dto';

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
} satisfies Prisma.CompanySelect;

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  list(query: ListCompaniesQueryDto) {
    const where: Prisma.CompanyWhereInput = {};
    if (!query.includeAll) {
      where.status = CompanyStatus.active;
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

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: COMPANY_LIST_SELECT,
    });
    if (!company) throw new NotFoundException('Company not found.');
    return company;
  }

  async create(dto: CreateCompanyDto) {
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
        status: CompanyStatus.active,
      },
      select: COMPANY_LIST_SELECT,
    });
  }

  async update(id: string, dto: UpdateCompanyDto) {
    await this.ensureExists(id);
    const data: Prisma.CompanyUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.tradeName !== undefined) data.tradeName = dto.tradeName?.trim() || null;
    if (dto.contactEmail !== undefined) data.contactEmail = dto.contactEmail.trim().toLowerCase();
    if (dto.country !== undefined) data.country = dto.country.trim();
    if (dto.city !== undefined) data.city = dto.city?.trim() || null;
    if (dto.contactPhone !== undefined) data.contactPhone = dto.contactPhone?.trim() || null;
    if (dto.address !== undefined) data.address = dto.address?.trim() || null;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    if (dto.status !== undefined) data.status = dto.status;

    return this.prisma.company.update({
      where: { id },
      data,
      select: COMPANY_LIST_SELECT,
    });
  }

  /** Sets status to paused (suspend operations for this client). */
  async suspend(id: string) {
    return this.update(id, { status: CompanyStatus.paused });
  }

  /**
   * Soft-remove: set status to closed. Hard delete is blocked when related rows exist.
   */
  async softDelete(id: string) {
    return this.update(id, { status: CompanyStatus.closed });
  }

  private async ensureExists(id: string) {
    const n = await this.prisma.company.count({ where: { id } });
    if (!n) throw new NotFoundException('Company not found.');
  }

  /**
   * Permanently delete only when no blocking foreign keys. Otherwise use softDelete.
   */
  async remove(id: string) {
    await this.ensureExists(id);
    try {
      await this.prisma.company.delete({ where: { id } });
      return { id, deleted: true as const };
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2003') {
        throw new ConflictException(
          'This company has related data (products, orders, etc.). It was not deleted — use Close to mark it closed, or remove dependent records first.',
        );
      }
      throw e;
    }
  }
}

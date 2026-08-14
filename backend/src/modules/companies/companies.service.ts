import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompanyStatus, Prisma } from '@prisma/client';

import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CompanyAccessService } from '../../common/company-access/company-access.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImageProcessingService } from '../media/image-processing.service';
import { MediaStorageService } from '../media/media-storage.service';
import { toAvatarPublicUrl } from '../media/avatar-url';
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
  logoPath: true,
  suspendedAt: true,
  suspensionReason: true,
  archivedAt: true,
  archiveReason: true,
  purgedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CompanySelect;

type CompanyRow = Prisma.CompanyGetPayload<{ select: typeof COMPANY_LIST_SELECT }>;

function mapCompany(row: CompanyRow) {
  const { logoPath, ...rest } = row;
  return {
    ...rest,
    logoUrl: toAvatarPublicUrl(logoPath),
  };
}

@Injectable()
export class CompaniesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly companyAccess: CompanyAccessService,
    private readonly images: ImageProcessingService,
    private readonly storage: MediaStorageService,
  ) {}

  async list(user: AuthPrincipal, query: ListCompaniesQueryDto) {
    const where: Prisma.CompanyWhereInput = {};
    if (user.tenantScope === 'restricted') {
      where.id = { in: user.authorizedCompanyIds };
    }
    if (query.status) {
      where.status = query.status;
    } else if (!query.includeAll) {
      where.status = CompanyStatus.active;
    }
    if (query.search?.trim()) {
      const t = query.search.trim();
      where.OR = [
        { name: { contains: t, mode: 'insensitive' } },
        { tradeName: { contains: t, mode: 'insensitive' } },
        { contactEmail: { contains: t, mode: 'insensitive' } },
        { contactPhone: { contains: t, mode: 'insensitive' } },
        { city: { contains: t, mode: 'insensitive' } },
        { country: { contains: t, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.company.findMany({
      where,
      orderBy: { name: 'asc' },
      select: COMPANY_LIST_SELECT,
    });
    return rows.map(mapCompany);
  }

  async findById(user: AuthPrincipal, id: string) {
    this.companyAccess.assertCompanyAccess(user, id);
    const company = await this.prisma.company.findUnique({
      where: { id },
      select: COMPANY_LIST_SELECT,
    });
    if (!company) throw new NotFoundException('Company not found.');
    return mapCompany(company);
  }

  async create(dto: CreateCompanyDto) {
    const company = await this.prisma.company.create({
      data: {
        name: dto.name.trim(),
        tradeName: dto.tradeName?.trim() || null,
        contactEmail: dto.contactEmail.trim().toLowerCase(),
        country: dto.country.trim(),
        city: dto.city.trim(),
        contactPhone: dto.contactPhone?.trim() || null,
        address: dto.address?.trim() || null,
        notes: dto.notes?.trim() || null,
        status: CompanyStatus.active,
      },
      select: COMPANY_LIST_SELECT,
    });
    return mapCompany(company);
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateCompanyDto) {
    this.companyAccess.assertCompanyAccess(user, id);
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

    const company = await this.prisma.company.update({
      where: { id },
      data,
      select: COMPANY_LIST_SELECT,
    });
    return mapCompany(company);
  }

  async uploadLogo(user: AuthPrincipal, id: string, file: Express.Multer.File) {
    this.companyAccess.assertCompanyAccess(user, id);
    const existing = await this.prisma.company.findUnique({
      where: { id },
      select: { logoPath: true },
    });
    if (!existing) throw new NotFoundException('Company not found.');

    const compressed = await this.images.compress(file.buffer, file.mimetype, 'company-logo');
    const saved = await this.storage.write('company-logos', id, compressed);
    await this.storage.remove(existing.logoPath ?? null);
    const company = await this.prisma.company.update({
      where: { id },
      data: { logoPath: saved.relativePath },
      select: COMPANY_LIST_SELECT,
    });
    return {
      logoUrl: toAvatarPublicUrl(company.logoPath)!,
      company: mapCompany(company),
    };
  }

  async deleteLogo(user: AuthPrincipal, id: string): Promise<void> {
    this.companyAccess.assertCompanyAccess(user, id);
    const existing = await this.prisma.company.findUnique({
      where: { id },
      select: { logoPath: true },
    });
    if (!existing) throw new NotFoundException('Company not found.');
    await this.storage.remove(existing.logoPath ?? null);
    await this.prisma.company.update({
      where: { id },
      data: { logoPath: null },
    });
  }

  /** Sets status to paused (suspend operations for this client). */
  async suspend(user: AuthPrincipal, id: string) {
    return this.update(user, id, { status: CompanyStatus.paused });
  }

  /**
   * Soft-remove: set status to closed. Hard delete is blocked when related rows exist.
   */
  async softDelete(user: AuthPrincipal, id: string) {
    return this.update(user, id, { status: CompanyStatus.closed });
  }

  private async ensureExists(id: string) {
    const n = await this.prisma.company.count({ where: { id } });
    if (!n) throw new NotFoundException('Company not found.');
  }

  /**
   * Permanently delete only when no blocking foreign keys. Otherwise use softDelete.
   */
  async remove(user: AuthPrincipal, id: string) {
    this.companyAccess.assertCompanyAccess(user, id);
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

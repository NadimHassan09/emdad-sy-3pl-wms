import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { CreateLeadFormDto } from './dto/create-lead-form.dto';
import { ListLeadFormsQueryDto } from './dto/list-lead-forms-query.dto';

/** Resolve a yyyy-mm-dd (or ISO) string to the inclusive end-of-day boundary. */
function endOfDay(iso: string): Date {
  const d = new Date(iso);
  if (iso.length <= 10) {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

@Injectable()
export class FormsService {
  private readonly logger = new Logger(FormsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /** Public: persist a landing-page lead submission. */
  async submit(dto: CreateLeadFormDto, meta?: { ip?: string; origin?: string }) {
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
    this.logger.log(
      `lead submission received id=${submission.id} activity="${dto.activityType}" ` +
        `origin=${meta?.origin ?? 'n/a'} ip=${meta?.ip ?? 'n/a'}`,
    );
    return { id: submission.id, createdAt: submission.createdAt, received: true };
  }

  /** Admin: paginated + searchable + filterable list. */
  async list(_user: AuthPrincipal, query: ListLeadFormsQueryDto) {
    const and: Prisma.LeadFormSubmissionWhereInput[] = [];

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
      const createdAt: Prisma.DateTimeFilter = {};
      if (query.createdFrom) createdAt.gte = new Date(query.createdFrom);
      if (query.createdTo) createdAt.lte = endOfDay(query.createdTo);
      and.push({ createdAt });
    }

    const where: Prisma.LeadFormSubmissionWhereInput = and.length ? { AND: and } : {};
    const sort: Prisma.SortOrder = query.sort === 'asc' ? 'asc' : 'desc';

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

  /** Admin: full submission detail. */
  async findById(id: string) {
    const submission = await this.prisma.leadFormSubmission.findUnique({ where: { id } });
    if (!submission) throw new NotFoundException('Lead submission not found.');
    return submission;
  }

  /** super_admin only: permanently delete a submission. */
  async remove(id: string, user: AuthPrincipal) {
    const existing = await this.prisma.leadFormSubmission.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Lead submission not found.');
    await this.prisma.leadFormSubmission.delete({ where: { id } });
    this.logger.warn(`lead submission deleted id=${id} by=${user.id}`);
    return { id, deleted: true };
  }

  /** Distinct activity types present, for populating the admin filter dropdown. */
  async activityTypes(): Promise<string[]> {
    const rows = await this.prisma.leadFormSubmission.findMany({
      distinct: ['activityType'],
      select: { activityType: true },
      orderBy: { activityType: 'asc' },
    });
    return rows.map((r) => r.activityType).filter(Boolean);
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';

import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuthPrincipal } from '../../common/auth/current-user.types';
import { PrismaService } from '../../common/prisma/prisma.service';
import { BackupSchedulerService } from './backup-scheduler.service';
import { BackupStoragePolicyService } from './backup-storage-policy.service';
import { CreateBackupScheduleDto } from './dto/create-backup-schedule.dto';
import { UpdateBackupScheduleDto } from './dto/update-backup-schedule.dto';

@Injectable()
export class BackupSchedulesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditLogService,
    private readonly scheduler: BackupSchedulerService,
    private readonly storagePolicy: BackupStoragePolicyService,
  ) {}

  async list() {
    const items = await this.prisma.backupSchedule.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        updatedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    return { items };
  }

  async findById(id: string) {
    const row = await this.prisma.backupSchedule.findUnique({
      where: { id },
      include: {
        createdBy: { select: { id: true, email: true, fullName: true } },
        updatedBy: { select: { id: true, email: true, fullName: true } },
      },
    });
    if (!row) throw new NotFoundException('Backup schedule not found.');
    return row;
  }

  async create(user: AuthPrincipal, dto: CreateBackupScheduleDto) {
    const resolvedPolicy = await this.storagePolicy.resolveForSchedule(dto.storagePolicy ?? null);

    const row = await this.prisma.backupSchedule.create({
      data: {
        enabled: dto.enabled ?? true,
        frequency: dto.frequency,
        hour: dto.hour,
        minute: dto.minute,
        retentionDays: dto.retentionDays,
        storagePolicy: dto.storagePolicy ?? null,
        createdByUserId: user.id,
        updatedByUserId: user.id,
      },
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'backup.schedule.created',
        resourceType: 'backup_schedule',
        resourceId: row.id,
        newState: {
          message: `${user.email ?? user.id} created backup schedule ${row.id}`,
          frequency: row.frequency,
          hour: row.hour,
          minute: row.minute,
          retentionDays: row.retentionDays,
          storagePolicy: row.storagePolicy,
          effectiveStoragePolicy: resolvedPolicy,
          enabled: row.enabled,
        },
      }),
    );

    return { ...row, effectiveStoragePolicy: resolvedPolicy };
  }

  async update(user: AuthPrincipal, id: string, dto: UpdateBackupScheduleDto) {
    const existing = await this.findById(id);
    if (dto.storagePolicy !== undefined) {
      await this.storagePolicy.resolveForSchedule(dto.storagePolicy);
    }

    const row = await this.prisma.backupSchedule.update({
      where: { id },
      data: {
        ...dto,
        updatedByUserId: user.id,
      },
    });

    await this.audit.log(
      this.audit.fromPrincipal(user, {
        action: 'backup.schedule.updated',
        resourceType: 'backup_schedule',
        resourceId: id,
        newState: {
          message: `${user.email ?? user.id} updated backup schedule ${id}`,
          ...dto,
        },
      }),
    );

    const effectiveStoragePolicy = await this.storagePolicy.resolveForSchedule(
      row.storagePolicy ?? existing.storagePolicy ?? null,
    );

    return { ...row, effectiveStoragePolicy };
  }

  async runNow(user: AuthPrincipal, id: string) {
    await this.findById(id);
    return this.scheduler.runScheduleNow(id, user);
  }
}

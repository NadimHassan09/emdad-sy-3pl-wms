import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../auth/current-user.types';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../../modules/realtime/realtime.service';
import { auditLogSummaryPayload } from '../../modules/realtime/realtime-activity.payload';

type TxOrPrisma = Prisma.TransactionClient | PrismaService;

export type AuditLogInput = {
  actorId?: string | null;
  actorEmail: string;
  actorName: string;
  actorRole: string;
  companyId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  previousState?: unknown;
  newState?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

type AuditLogInsertRow = {
  id: string;
  actor_id: string | null;
  actor_email: string;
  actor_name: string;
  actor_role: string;
  company_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string;
  ip_address: string | null;
  created_at: Date;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
  ) {}

  async log(input: AuditLogInput): Promise<void> {
    const row = await this.insert(this.prisma, input);
    this.scheduleAuditEmit(row);
  }

  async logTx(tx: Prisma.TransactionClient, input: AuditLogInput): Promise<void> {
    const row = await this.insert(tx, input);
    this.scheduleAuditEmit(row);
  }

  /**
   * Persists an audit row without failing the caller; logs insert errors for ops visibility.
   */
  async logBestEffort(input: AuditLogInput): Promise<void> {
    try {
      await this.log(input);
    } catch (err) {
      this.logger.error(
        `Audit insert failed action=${input.action} resource=${input.resourceType}/${input.resourceId}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  fromPrincipal(
    principal: Pick<AuthPrincipal, 'id' | 'email' | 'role' | 'companyId'>,
    patch: Omit<AuditLogInput, 'actorId' | 'actorEmail' | 'actorName' | 'actorRole' | 'companyId'> &
      Partial<Pick<AuditLogInput, 'companyId'>>,
  ): AuditLogInput {
    return {
      actorId: principal.id,
      actorEmail: principal.email ?? `user-${principal.id}@unknown.local`,
      actorName: principal.email ?? principal.id,
      actorRole: principal.role,
      companyId: patch.companyId ?? principal.companyId ?? null,
      ...patch,
    };
  }

  private scheduleAuditEmit(row: AuditLogInsertRow): void {
    setTimeout(() => {
      try {
        const auditLog = auditLogSummaryPayload(row);
        this.realtime.emitAuditLogCreated(auditLog, row.company_id);
      } catch (err) {
        this.logger.warn(
          `Audit realtime emit failed id=${row.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }, 0);
  }

  private async insert(db: TxOrPrisma, input: AuditLogInput): Promise<AuditLogInsertRow> {
    if (!input.action?.trim() || !input.resourceType?.trim() || !input.resourceId?.trim()) {
      throw new Error('Audit log requires action, resourceType, and resourceId.');
    }
    if (!input.actorEmail?.trim() || !input.actorRole?.trim()) {
      throw new Error('Audit log requires actorEmail and actorRole.');
    }
    const rows = await db.$queryRaw<AuditLogInsertRow[]>(
      Prisma.sql`
        INSERT INTO audit_logs (
          actor_id,
          actor_email,
          actor_name,
          actor_role,
          company_id,
          action,
          resource_type,
          resource_id,
          previous_state,
          new_state,
          ip_address,
          user_agent
        ) VALUES (
          ${input.actorId ?? null}::uuid,
          ${input.actorEmail},
          ${input.actorName},
          ${input.actorRole},
          ${input.companyId ?? null}::uuid,
          ${input.action},
          ${input.resourceType},
          ${input.resourceId}::uuid,
          ${input.previousState ? JSON.stringify(input.previousState) : null}::jsonb,
          ${input.newState ? JSON.stringify(input.newState) : null}::jsonb,
          ${input.ipAddress ?? null},
          ${input.userAgent ?? null}
        )
        RETURNING
          id,
          actor_id,
          actor_email,
          actor_name,
          actor_role,
          company_id,
          action,
          resource_type,
          resource_id,
          ip_address,
          created_at
      `,
    );
    const row = rows[0];
    if (!row) throw new Error('Audit log insert returned no row.');
    return row;
  }
}

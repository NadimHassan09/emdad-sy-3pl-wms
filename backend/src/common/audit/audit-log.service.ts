import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../auth/current-user.types';
import { PrismaService } from '../prisma/prisma.service';

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

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    await this.insert(this.prisma, input);
  }

  async logTx(tx: Prisma.TransactionClient, input: AuditLogInput): Promise<void> {
    await this.insert(tx, input);
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

  private async insert(db: TxOrPrisma, input: AuditLogInput): Promise<void> {
    await db.$executeRaw(
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
      `,
    );
  }
}


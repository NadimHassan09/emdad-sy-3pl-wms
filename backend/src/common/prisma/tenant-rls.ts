import { Prisma } from '@prisma/client';

import { AuthPrincipal } from '../auth/current-user.types';
import { PrismaService } from './prisma.service';

const INTERNAL_ROLES = new Set<AuthPrincipal['role']>([
  'super_admin',
  'wh_manager',
  'wh_operator',
  'finance',
]);

/**
 * RLS policies on tenant tables read `app.user_role` / `app.current_company_id`.
 * Without this, internal users only see rows for the stale session tenant.
 */
export async function setTenantRlsContext(
  tx: Prisma.TransactionClient,
  user: AuthPrincipal,
): Promise<void> {
  const isInternal = INTERNAL_ROLES.has(user.role);
  const companyCtx = isInternal ? '' : user.companyId ?? '';
  await tx.$executeRaw(Prisma.sql`SELECT set_config('app.user_role', ${user.role}, true)`);
  await tx.$executeRaw(
    Prisma.sql`SELECT set_config('app.current_company_id', ${companyCtx}, true)`,
  );
}

export async function withTenantRls<T>(
  prisma: PrismaService,
  user: AuthPrincipal,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await setTenantRlsContext(tx, user);
    return fn(tx);
  });
}

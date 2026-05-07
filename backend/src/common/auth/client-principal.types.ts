import type { UserRole } from '@prisma/client';

/** Authenticated client portal user (JWT `typ: 'client'`). */
export interface ClientPrincipal {
  id: string;
  email: string | null;
  fullName: string;
  role: Extract<UserRole, 'client_admin' | 'client_staff'>;
  companyId: string;
  companyName: string;
}

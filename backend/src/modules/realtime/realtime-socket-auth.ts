import { ConfigService } from '@nestjs/config';
import { UserRole, UserStatus } from '@prisma/client';
import * as jwt from 'jsonwebtoken';

import { PrismaService } from '../../common/prisma/prisma.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLIENT_ROLES: UserRole[] = [UserRole.client_admin, UserRole.client_staff];

export type SocketPrincipal =
  | { kind: 'internal'; userId: string; role: UserRole; email: string | null }
  | { kind: 'client'; userId: string; companyId: string; role: UserRole; email: string | null };

function tryVerify(token: string, secret: string): jwt.JwtPayload | null {
  try {
    const p = jwt.verify(token, secret);
    if (typeof p === 'string' || !p || typeof p !== 'object') return null;
    return p as jwt.JwtPayload;
  } catch {
    return null;
  }
}

/**
 * Validates JWT from the Socket.IO handshake and returns a principal.
 * - Internal WMS: `typ` must not be `client`; optional `companyId` in handshake selects tenant room.
 * - Client portal: `typ === 'client'` and `companyId` on token; handshake `companyId` ignored.
 */
export async function authenticateSocketConnection(
  config: ConfigService,
  prisma: PrismaService,
  token: string,
): Promise<SocketPrincipal | null> {
  const internalSecret = config.get<string>('JWT_SECRET') ?? 'dev-only-change-in-production';
  const clientSecret =
    config.get<string>('CLIENT_JWT_SECRET') ?? config.get<string>('JWT_SECRET') ?? internalSecret;

  const internalPayload = tryVerify(token, internalSecret);
  if (internalPayload?.sub && internalPayload.typ !== 'client') {
    const user = await prisma.user.findUnique({
      where: { id: String(internalPayload.sub) },
      select: { id: true, role: true, status: true, companyId: true, email: true },
    });
    if (!user || user.status !== UserStatus.active) return null;
    if (user.companyId !== null || CLIENT_ROLES.includes(user.role)) return null;
    return {
      kind: 'internal',
      userId: user.id,
      role: user.role,
      email: user.email,
    };
  }

  const clientPayload = tryVerify(token, clientSecret);
  if (clientPayload?.sub && clientPayload.typ === 'client') {
    const companyId = typeof clientPayload.companyId === 'string' ? clientPayload.companyId : '';
    if (!UUID_RE.test(companyId)) return null;
    const user = await prisma.user.findUnique({
      where: { id: String(clientPayload.sub) },
      select: { id: true, role: true, status: true, companyId: true, email: true },
    });
    if (!user || user.status !== UserStatus.active) return null;
    if (user.companyId === null || !CLIENT_ROLES.includes(user.role)) return null;
    if (user.companyId !== companyId) return null;
    return {
      kind: 'client',
      userId: user.id,
      companyId: user.companyId,
      role: user.role,
      email: user.email,
    };
  }

  return null;
}

export function isValidCompanyRoomId(companyId: string | undefined): companyId is string {
  return typeof companyId === 'string' && UUID_RE.test(companyId.trim());
}

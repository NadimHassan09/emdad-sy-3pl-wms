import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ApiCredentialScope, UserRole } from '@prisma/client';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  SECRET_ONCE_WARNING,
  apiKeyPrefix,
  generateApiKey,
  generateApiSecret,
  hashApiSecret,
  maskApiKey,
} from './api-credential.util';
import { CreateApiCredentialDto } from './dto/create-api-credential.dto';

function assertClientAdmin(client: ClientPrincipal): void {
  if (client.role !== UserRole.client_admin) {
    throw new ForbiddenException('Only company administrators can manage API credentials.');
  }
}

function statusOf(row: { revokedAt: Date | null; isActive: boolean }): 'revoked' | 'disabled' | 'active' {
  if (row.revokedAt) return 'revoked';
  if (!row.isActive) return 'disabled';
  return 'active';
}

@Injectable()
export class ApiCredentialsService {
  constructor(private readonly prisma: PrismaService) {}

  list(client: ClientPrincipal) {
    assertClientAdmin(client);
    return this.prisma.apiCredential
      .findMany({
        where: { companyId: client.companyId },
        orderBy: { createdAt: 'desc' },
      })
      .then((rows) => rows.map((row) => this.toListItem(row)));
  }

  async create(client: ClientPrincipal, dto: CreateApiCredentialDto) {
    assertClientAdmin(client);
    const apiKey = generateApiKey();
    const apiSecret = generateApiSecret();
    const row = await this.prisma.apiCredential.create({
      data: {
        companyId: client.companyId,
        name: dto.name.trim(),
        scope: dto.scope,
        apiKey,
        keyPrefix: apiKeyPrefix(apiKey),
        secretHash: hashApiSecret(apiSecret),
        createdByUserId: client.id,
      },
    });
    return {
      ...this.toListItem(row),
      apiKey,
      apiSecret,
      warning: SECRET_ONCE_WARNING,
    };
  }

  async regenerate(client: ClientPrincipal, id: string) {
    const row = await this.requireOwned(client, id);
    if (row.revokedAt) {
      throw new ForbiddenException('A revoked API key cannot be regenerated.');
    }
    const apiSecret = generateApiSecret();
    const updated = await this.prisma.apiCredential.update({
      where: { id: row.id },
      data: { secretHash: hashApiSecret(apiSecret), updatedAt: new Date() },
    });
    return {
      ...this.toListItem(updated),
      apiKey: updated.apiKey,
      apiSecret,
      warning: SECRET_ONCE_WARNING,
    };
  }

  async revoke(client: ClientPrincipal, id: string) {
    const row = await this.requireOwned(client, id);
    if (row.revokedAt) return this.toListItem(row);
    const updated = await this.prisma.apiCredential.update({
      where: { id: row.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedByUserId: client.id,
      },
    });
    return this.toListItem(updated);
  }

  async setEnabled(client: ClientPrincipal, id: string, enabled: boolean) {
    const row = await this.requireOwned(client, id);
    if (row.revokedAt) {
      throw new ForbiddenException('A revoked API key cannot be enabled or disabled.');
    }
    const updated = await this.prisma.apiCredential.update({
      where: { id: row.id },
      data: { isActive: enabled },
    });
    return this.toListItem(updated);
  }

  async requireOwnedScope(client: ClientPrincipal, id: string): Promise<ApiCredentialScope> {
    const row = await this.requireOwned(client, id);
    return row.scope;
  }

  private async requireOwned(client: ClientPrincipal, id: string) {
    assertClientAdmin(client);
    const row = await this.prisma.apiCredential.findFirst({
      where: { id, companyId: client.companyId },
    });
    if (!row) throw new NotFoundException('API credential not found.');
    return row;
  }

  private toListItem(row: {
    id: string;
    name: string;
    scope: ApiCredentialScope;
    apiKey: string;
    isActive: boolean;
    lastUsedAt: Date | null;
    createdAt: Date;
    revokedAt: Date | null;
  }) {
    return {
      id: row.id,
      name: row.name,
      scope: row.scope,
      status: statusOf(row),
      maskedKey: maskApiKey(row.apiKey),
      createdAt: row.createdAt,
      lastUsedAt: row.lastUsedAt,
    };
  }
}

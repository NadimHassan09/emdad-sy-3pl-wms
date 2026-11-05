import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'node:crypto';

import { ClientPrincipal } from '../../../common/auth/client-principal.types';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import {
  WEBHOOK_MAX_ATTEMPTS,
  assertPublicHost,
  generateWebhookSecret,
  nextRetryDelayMinutes,
  signWebhookBody,
  validateWebhookUrlShape,
} from './webhook-security.util';

const MAX_ENDPOINTS_PER_COMPANY = 5;
const SCAN_BATCH = 300;
const DELIVERY_BATCH = 50;
const DISABLE_AFTER_FAILURES = 50;
const REQUEST_TIMEOUT_MS = 8000;

function assertClientAdmin(client: ClientPrincipal): void {
  if (client.role !== UserRole.client_admin) {
    throw new ForbiddenException('Only company administrators can manage webhooks.');
  }
}

@Injectable()
export class ClientWebhooksService {
  private readonly logger = new Logger(ClientWebhooksService.name);
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly encryption: EncryptionService,
  ) {}

  /** Overridden in tests. */
  fetchImpl: typeof fetch = fetch;

  async list(client: ClientPrincipal) {
    assertClientAdmin(client);
    const rows = await this.prisma.clientWebhookEndpoint.findMany({
      where: { companyId: client.companyId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toView(r));
  }

  async create(client: ClientPrincipal, urlRaw: string) {
    assertClientAdmin(client);
    const checked = validateWebhookUrlShape(urlRaw);
    if (!checked.ok) throw new BadRequestException(checked.reason);
    const count = await this.prisma.clientWebhookEndpoint.count({ where: { companyId: client.companyId } });
    if (count >= MAX_ENDPOINTS_PER_COMPANY) {
      throw new BadRequestException(`A company can have at most ${MAX_ENDPOINTS_PER_COMPANY} webhook addresses.`);
    }
    const secret = generateWebhookSecret();
    const row = await this.prisma.clientWebhookEndpoint.create({
      data: {
        companyId: client.companyId,
        url: checked.url.toString(),
        secretEnc: this.encryption.encrypt(secret),
        createdByUserId: client.id,
      },
    });
    return { ...this.toView(row), secret, secretNotice: 'Copy the signing secret now. It is not shown again.' };
  }

  async rotateSecret(client: ClientPrincipal, id: string) {
    assertClientAdmin(client);
    const row = await this.owned(client, id);
    const secret = generateWebhookSecret();
    const updated = await this.prisma.clientWebhookEndpoint.update({
      where: { id: row.id },
      data: { secretEnc: this.encryption.encrypt(secret) },
    });
    return { ...this.toView(updated), secret, secretNotice: 'Copy the signing secret now. It is not shown again.' };
  }

  async setEnabled(client: ClientPrincipal, id: string, enabled: boolean) {
    assertClientAdmin(client);
    const row = await this.owned(client, id);
    const updated = await this.prisma.clientWebhookEndpoint.update({
      where: { id: row.id },
      data: {
        isActive: enabled,
        ...(enabled ? { consecutiveFailures: 0, cursorAt: new Date() } : {}),
      },
    });
    return this.toView(updated);
  }

  async remove(client: ClientPrincipal, id: string) {
    assertClientAdmin(client);
    const row = await this.owned(client, id);
    await this.prisma.clientWebhookEndpoint.delete({ where: { id: row.id } });
    return { deleted: true };
  }

  async deliveries(client: ClientPrincipal, id: string) {
    assertClientAdmin(client);
    const row = await this.owned(client, id);
    return this.prisma.clientWebhookDelivery.findMany({
      where: { endpointId: row.id },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true, event: true, orderNumber: true, status: true, attempts: true,
        lastHttpStatus: true, lastError: true, createdAt: true, deliveredAt: true,
      },
    });
  }

  /** Queues a `ping` event so the client can check their receiver works. */
  async sendTest(client: ClientPrincipal, id: string) {
    assertClientAdmin(client);
    const row = await this.owned(client, id);
    await this.enqueue(row.id, 'ping', null, { message: 'EMDAD webhook test', companyId: client.companyId });
    await this.deliverDue();
    return { queued: true };
  }

  @Cron('*/30 * * * * *')
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await this.scanChanges();
      await this.deliverDue();
    } catch (err) {
      this.logger.error(`Webhook tick failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      this.running = false;
    }
  }

  /** Looks for orders changed since each endpoint's cursor and queues created / status-changed events. */
  async scanChanges(): Promise<number> {
    const endpoints = await this.prisma.clientWebhookEndpoint.findMany({ where: { isActive: true } });
    let queued = 0;
    for (const ep of endpoints) {
      const orders = await this.prisma.omsOrder.findMany({
        where: { companyId: ep.companyId, updatedAt: { gt: ep.cursorAt } },
        orderBy: { updatedAt: 'asc' },
        take: SCAN_BATCH,
        select: { id: true, orderNumber: true, status: true, codStatus: true, createdAt: true, updatedAt: true },
      });
      if (!orders.length) continue;
      const states = await this.prisma.clientWebhookOrderState.findMany({
        where: { endpointId: ep.id, orderId: { in: orders.map((o) => o.id) } },
      });
      const byOrder = new Map(states.map((s) => [s.orderId, s.lastStatus]));
      for (const o of orders) {
        const previous = byOrder.get(o.id) ?? null;
        const status = String(o.status);
        if (previous === status) continue;
        const isNew = previous == null && o.createdAt > ep.createdAt;
        await this.enqueue(ep.id, isNew ? 'order.created' : 'order.status_changed', o.orderNumber, {
          orderNumber: o.orderNumber,
          status,
          previousStatus: previous,
          codStatus: o.codStatus ? String(o.codStatus) : null,
          updatedAt: o.updatedAt.toISOString(),
        });
        await this.prisma.clientWebhookOrderState.upsert({
          where: { endpointId_orderId: { endpointId: ep.id, orderId: o.id } },
          create: { endpointId: ep.id, orderId: o.id, lastStatus: status },
          update: { lastStatus: status },
        });
        queued += 1;
      }
      await this.prisma.clientWebhookEndpoint.update({
        where: { id: ep.id },
        data: { cursorAt: orders[orders.length - 1].updatedAt },
      });
    }
    return queued;
  }

  async deliverDue(): Promise<number> {
    const due = await this.prisma.clientWebhookDelivery.findMany({
      where: { status: 'pending', nextAttemptAt: { lte: new Date() }, endpoint: { isActive: true } },
      orderBy: { nextAttemptAt: 'asc' },
      take: DELIVERY_BATCH,
      include: { endpoint: true },
    });
    for (const d of due) await this.attempt(d);
    return due.length;
  }

  private async attempt(d: {
    id: string; event: string; payload: Prisma.JsonValue; attempts: number;
    endpoint: { id: string; url: string; secretEnc: string; consecutiveFailures: number };
  }): Promise<void> {
    const body = JSON.stringify({ id: d.id, event: d.event, createdAt: new Date().toISOString(), data: d.payload });
    let httpStatus: number | null = null;
    let error: string | null = null;
    try {
      const url = new URL(d.endpoint.url);
      await assertPublicHost(url);
      const secret = this.encryption.decrypt(d.endpoint.secretEnc);
      const res = await this.fetchImpl(url, {
        method: 'POST',
        redirect: 'manual',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'EMDAD-Webhooks/1.0',
          'X-Emdad-Event': d.event,
          'X-Emdad-Delivery': d.id,
          'X-Emdad-Signature': signWebhookBody(secret, body),
        },
        body,
      });
      httpStatus = res.status;
      if (res.status < 200 || res.status >= 300) error = `Receiver answered HTTP ${res.status}`;
    } catch (err) {
      error = err instanceof Error ? err.message.slice(0, 300) : 'Delivery failed';
    }
    const attempts = d.attempts + 1;
    if (!error) {
      await this.prisma.clientWebhookDelivery.update({
        where: { id: d.id },
        data: { status: 'delivered', attempts, lastHttpStatus: httpStatus, lastError: null, deliveredAt: new Date() },
      });
      await this.prisma.clientWebhookEndpoint.update({
        where: { id: d.endpoint.id },
        data: { consecutiveFailures: 0, lastSuccessAt: new Date(), lastError: null },
      });
      return;
    }
    const delay = nextRetryDelayMinutes(attempts);
    await this.prisma.clientWebhookDelivery.update({
      where: { id: d.id },
      data: {
        attempts,
        lastHttpStatus: httpStatus,
        lastError: error,
        status: delay == null || attempts >= WEBHOOK_MAX_ATTEMPTS ? 'failed' : 'pending',
        ...(delay != null ? { nextAttemptAt: new Date(Date.now() + delay * 60_000) } : {}),
      },
    });
    const failures = d.endpoint.consecutiveFailures + 1;
    await this.prisma.clientWebhookEndpoint.update({
      where: { id: d.endpoint.id },
      data: {
        consecutiveFailures: failures,
        lastFailureAt: new Date(),
        lastError: error,
        ...(failures >= DISABLE_AFTER_FAILURES ? { isActive: false } : {}),
      },
    });
  }

  private enqueue(endpointId: string, event: string, orderNumber: string | null, payload: Record<string, unknown>) {
    return this.prisma.clientWebhookDelivery.create({
      data: { id: randomUUID(), endpointId, event, orderNumber, payload: payload as Prisma.InputJsonValue },
    });
  }

  private async owned(client: ClientPrincipal, id: string) {
    const row = await this.prisma.clientWebhookEndpoint.findFirst({ where: { id, companyId: client.companyId } });
    if (!row) throw new NotFoundException('Webhook address not found.');
    return row;
  }

  private toView(r: {
    id: string; url: string; isActive: boolean; consecutiveFailures: number;
    lastSuccessAt: Date | null; lastFailureAt: Date | null; lastError: string | null; createdAt: Date;
  }) {
    return {
      id: r.id,
      url: r.url,
      isActive: r.isActive,
      consecutiveFailures: r.consecutiveFailures,
      lastSuccessAt: r.lastSuccessAt,
      lastFailureAt: r.lastFailureAt,
      lastError: r.lastError,
      createdAt: r.createdAt,
    };
  }
}

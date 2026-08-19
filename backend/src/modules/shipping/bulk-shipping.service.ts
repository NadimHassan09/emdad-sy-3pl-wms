import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  BulkShippingItemStatus,
  BulkShippingJobStatus,
  CarrierShipmentStatus,
  OutboundOrderStatus,
  Prisma,
  ShippingMethod,
  ShippingProviderConnectionStatus,
} from '@prisma/client';

import { PrismaService } from '../../common/prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  isEligibleForBulkShipping,
  recommendCheapestProvider,
  resolveBulkProviderSelection,
} from './bulk-shipping.eligibility';
import {
  BULK_SHIPPING_CONCURRENCY,
  MANUAL_SHIPPING_CODE,
} from './shipping.constants';
import { ShippingProviderRegistry } from './shipping-provider.registry';
import { ShippingService } from './shipping.service';
import type { BulkShippingConfirmItemDto } from './dto/bulk-shipping.dto';

type PreviewQuote = {
  providerCode: string;
  providerName: string;
  price: number;
  currency: string;
};

type PreviewLine = {
  outboundOrderId: string;
  orderNumber: string;
  omsOrderNumber: string | null;
  companyId: string;
  companyName: string | null;
  weightKg: number | null;
  volumeCbm: number | null;
  currentMethod: ShippingMethod;
  currentProviderCode: string | null;
  quotes: PreviewQuote[];
  recommendedProviderCode: string | null;
  recommendedPrice: number | null;
  recommendedCurrency: string | null;
  selectedProviderCode: string;
  recommendationNote: string | null;
  labelDeliveryHint: string;
};

@Injectable()
export class BulkShippingService {
  private readonly logger = new Logger(BulkShippingService.name);
  private readonly runningJobs = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ShippingProviderRegistry,
    private readonly shipping: ShippingService,
    private readonly realtime: RealtimeService,
  ) {}

  async listEligible(params: {
    warehouseId?: string;
    companyId?: string;
    limit?: number;
  }) {
    const take = Math.min(Math.max(params.limit ?? 100, 1), 200);
    const rows = await this.prisma.outboundOrder.findMany({
      where: {
        status: OutboundOrderStatus.ready_to_ship,
        ...(params.companyId ? { companyId: params.companyId } : {}),
        AND: [
          { OR: [{ trackingNumber: null }, { trackingNumber: '' }] },
          {
            NOT: {
              carrierShipments: { some: { status: CarrierShipmentStatus.created } },
            },
          },
        ],
      },
      take,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        orderNumber: true,
        companyId: true,
        status: true,
        shippingMethod: true,
        shippingProviderCode: true,
        shippingWeightKg: true,
        shippingVolumeCbm: true,
        trackingNumber: true,
        company: { select: { name: true } },
        omsOrder: { select: { orderNumber: true } },
        carrierShipments: { select: { status: true } },
      },
    });

    return rows
      .filter((r) => isEligibleForBulkShipping(r))
      .map((r) => ({
        id: r.id,
        orderNumber: r.orderNumber,
        omsOrderNumber: r.omsOrder?.orderNumber ?? null,
        companyId: r.companyId,
        companyName: r.company?.name ?? null,
        status: r.status,
        shippingMethod: r.shippingMethod,
        shippingProviderCode: r.shippingProviderCode,
        shippingWeightKg: r.shippingWeightKg?.toString() ?? null,
        shippingVolumeCbm: r.shippingVolumeCbm?.toString() ?? null,
      }));
  }

  /**
   * Quote + recommend only. MUST NOT create carrier shipments.
   */
  async preview(outboundOrderIds: string[]): Promise<{
    lines: PreviewLine[];
    estimatedTotalCost: number | null;
    estimatedCurrency: string | null;
    selectableProviders: Array<{
      code: string;
      name: string;
      supportsQuote: boolean;
      supportsLabelPrinting: boolean;
      labelDelivery: string;
      connected: boolean;
    }>;
  }> {
    const uniqueIds = [...new Set(outboundOrderIds)];
    if (uniqueIds.length === 0) {
      throw new BadRequestException('Select at least one outbound order.');
    }

    const orders = await this.loadOrdersForBulk(uniqueIds);
    this.assertAllEligible(orders, uniqueIds);

    const selectableProviders = await this.listSelectableProviders();
    const connectedQuoteProviders = selectableProviders.filter(
      (p) => p.code !== MANUAL_SHIPPING_CODE && p.connected && p.supportsQuote,
    );

    const lines: PreviewLine[] = [];
    for (const order of orders) {
      const quotes: PreviewQuote[] = [];
      for (const provider of connectedQuoteProviders) {
        const q = await this.tryQuoteOrder(order, provider.code);
        if (q) quotes.push(q);
      }

      const recommended = recommendCheapestProvider(
        quotes.map((q) => ({
          providerCode: q.providerCode,
          price: q.price,
          currency: q.currency,
        })),
      );

      const selectedProviderCode = resolveBulkProviderSelection({
        recommendedCode: recommended?.providerCode ?? null,
        currentMethod: order.shippingMethod,
        currentProviderCode: order.shippingProviderCode,
      });

      const adapterCaps =
        selectedProviderCode === MANUAL_SHIPPING_CODE
          ? null
          : this.registry.has(selectedProviderCode)
            ? this.registry.get(selectedProviderCode).capabilities
            : null;

      lines.push({
        outboundOrderId: order.id,
        orderNumber: order.orderNumber,
        omsOrderNumber: order.omsOrder?.orderNumber ?? null,
        companyId: order.companyId,
        companyName: order.company?.name ?? null,
        weightKg: order.shippingWeightKg != null ? Number(order.shippingWeightKg) : null,
        volumeCbm: order.shippingVolumeCbm != null ? Number(order.shippingVolumeCbm) : null,
        currentMethod: order.shippingMethod ?? ShippingMethod.manual,
        currentProviderCode: order.shippingProviderCode,
        quotes,
        recommendedProviderCode: recommended?.providerCode ?? null,
        recommendedPrice: recommended?.price ?? null,
        recommendedCurrency: recommended?.currency ?? null,
        selectedProviderCode,
        recommendationNote: recommended
          ? null
          : 'No automatic recommendation available',
        labelDeliveryHint:
          adapterCaps?.labelDelivery === 'api'
            ? 'Available to print (carrier API)'
            : adapterCaps?.labelDelivery === 'carrier_provided'
              ? 'Provided by carrier'
              : selectedProviderCode === MANUAL_SHIPPING_CODE
                ? 'Manual — no carrier label'
                : 'No shipping label available from carrier API',
      });
    }

    const priced = lines.filter((l) => l.recommendedPrice != null);
    const currency =
      priced.find((l) => l.recommendedCurrency)?.recommendedCurrency ?? null;
    const estimatedTotalCost =
      priced.length > 0
        ? priced.reduce((sum, l) => sum + (l.recommendedPrice ?? 0), 0)
        : null;

    return {
      lines,
      estimatedTotalCost,
      estimatedCurrency: currency,
      selectableProviders,
    };
  }

  /**
   * Confirm & create shipments. Creates job then processes with controlled concurrency.
   * Idempotent per order via ShippingService.ensureShipmentForOutbound.
   */
  async confirmAndStart(
    userId: string,
    items: BulkShippingConfirmItemDto[],
  ) {
    if (!items.length) {
      throw new BadRequestException('Select at least one order.');
    }

    const outboundOrderIds = items.map((i) => i.outboundOrderId);
    const uniqueIds = [...new Set(outboundOrderIds)];
    if (uniqueIds.length !== outboundOrderIds.length) {
      throw new BadRequestException('Duplicate outbound orders in bulk confirmation.');
    }

    const orders = await this.loadOrdersForBulk(uniqueIds);
    this.assertAllEligible(orders, uniqueIds);
    const byId = new Map(orders.map((o) => [o.id, o]));

    let estimatedTotal = 0;
    let estimatedCurrency: string | null = null;
    let hasEstimate = false;

    for (const item of items) {
      const code = item.providerCode.trim().toUpperCase();
      if (code !== MANUAL_SHIPPING_CODE && !this.registry.has(code)) {
        throw new BadRequestException(`Unsupported shipping provider: ${code}`);
      }
      if (item.quotedPrice != null && Number.isFinite(Number(item.quotedPrice))) {
        estimatedTotal += Number(item.quotedPrice);
        hasEstimate = true;
        if (item.quotedCurrency) estimatedCurrency = item.quotedCurrency;
      }
      if (!byId.has(item.outboundOrderId)) {
        throw new BadRequestException(`Order not found: ${item.outboundOrderId}`);
      }
    }

    const job = await this.prisma.bulkShippingJob.create({
      data: {
        status: BulkShippingJobStatus.pending,
        triggeredByUserId: userId,
        totalCount: items.length,
        estimatedTotalCost: hasEstimate ? estimatedTotal : null,
        estimatedCurrency,
        items: {
          create: items.map((item) => ({
            outboundOrderId: item.outboundOrderId,
            selectedProviderCode: item.providerCode.trim().toUpperCase(),
            recommendedProviderCode: item.recommendedProviderCode?.trim().toUpperCase() ?? null,
            quotedPrice:
              item.quotedPrice != null && Number.isFinite(Number(item.quotedPrice))
                ? item.quotedPrice
                : null,
            quotedCurrency: item.quotedCurrency ?? null,
            status: BulkShippingItemStatus.pending,
            labelCapability:
              item.providerCode.trim().toUpperCase() === MANUAL_SHIPPING_CODE
                ? 'none'
                : this.registry.has(item.providerCode.trim().toUpperCase())
                  ? this.registry.get(item.providerCode.trim().toUpperCase()).capabilities
                      .labelDelivery
                  : 'none',
          })),
        },
      },
      include: { items: true },
    });

    // Fire-and-forget processing (same process). Idempotency is DB-backed.
    void this.processJob(job.id);

    return this.getJob(job.id);
  }

  async getJob(jobId: string) {
    const job = await this.prisma.bulkShippingJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' },
          include: {
            outboundOrder: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                trackingNumber: true,
                shippingMethod: true,
                shippingProviderCode: true,
                companyId: true,
                omsOrder: { select: { id: true, orderNumber: true } },
                company: { select: { name: true } },
              },
            },
          },
        },
      },
    });
    if (!job) throw new NotFoundException('Bulk shipping job not found.');
    return this.toJobView(job);
  }

  async retryItem(jobId: string, outboundOrderId: string) {
    const item = await this.prisma.bulkShippingJobItem.findFirst({
      where: { jobId, outboundOrderId },
    });
    if (!item) throw new NotFoundException('Bulk shipping job item not found.');
    if (item.status !== BulkShippingItemStatus.failed) {
      throw new BadRequestException('Only failed items can be retried.');
    }

    const order = await this.prisma.outboundOrder.findUnique({
      where: { id: outboundOrderId },
      include: { carrierShipments: { select: { status: true } } },
    });
    if (!order || !isEligibleForBulkShipping(order)) {
      // Already has shipment — mark succeeded without re-calling API.
      const created = await this.prisma.carrierShipment.findFirst({
        where: { outboundOrderId, status: CarrierShipmentStatus.created },
      });
      if (created?.externalAwb) {
        await this.prisma.bulkShippingJobItem.update({
          where: { id: item.id },
          data: {
            status: BulkShippingItemStatus.succeeded,
            externalAwb: created.externalAwb,
            lastErrorSafe: null,
            processedAt: new Date(),
          },
        });
        await this.recomputeJobCounts(jobId);
        return this.getJob(jobId);
      }
      throw new BadRequestException('Order is no longer eligible for bulk shipping retry.');
    }

    await this.prisma.bulkShippingJobItem.update({
      where: { id: item.id },
      data: {
        status: BulkShippingItemStatus.pending,
        lastErrorSafe: null,
        externalAwb: null,
        processedAt: null,
      },
    });
    await this.prisma.bulkShippingJob.update({
      where: { id: jobId },
      data: {
        status: BulkShippingJobStatus.processing,
        completedAt: null,
        errorMessage: null,
      },
    });

    void this.processJob(jobId);
    return this.getJob(jobId);
  }

  async getLabelsForJob(jobId: string) {
    const job = await this.prisma.bulkShippingJob.findUnique({
      where: { id: jobId },
      include: {
        items: {
          where: { status: BulkShippingItemStatus.succeeded },
          include: {
            outboundOrder: {
              select: {
                id: true,
                orderNumber: true,
                trackingNumber: true,
                shippingProviderCode: true,
              },
            },
          },
        },
      },
    });
    if (!job) throw new NotFoundException('Bulk shipping job not found.');

    const labels: Array<{
      outboundOrderId: string;
      orderNumber: string;
      awb: string | null;
      providerCode: string;
      labelDelivery: string;
      url?: string;
      pdfBase64?: string;
      message: string;
    }> = [];

    for (const item of job.items) {
      const providerCode = item.selectedProviderCode;
      const awb = item.externalAwb ?? item.outboundOrder.trackingNumber;
      if (providerCode === MANUAL_SHIPPING_CODE || !awb) {
        labels.push({
          outboundOrderId: item.outboundOrderId,
          orderNumber: item.outboundOrder.orderNumber,
          awb: awb ?? null,
          providerCode,
          labelDelivery: 'none',
          message: 'No shipping label available from carrier API.',
        });
        continue;
      }

      if (!this.registry.has(providerCode)) {
        labels.push({
          outboundOrderId: item.outboundOrderId,
          orderNumber: item.outboundOrder.orderNumber,
          awb,
          providerCode,
          labelDelivery: 'none',
          message: 'No shipping label available from carrier API.',
        });
        continue;
      }

      const adapter = this.registry.get(providerCode);
      const caps = adapter.capabilities;
      if (!caps.supportsLabelPrinting || !adapter.getLabel) {
        labels.push({
          outboundOrderId: item.outboundOrderId,
          orderNumber: item.outboundOrder.orderNumber,
          awb,
          providerCode,
          labelDelivery: caps.labelDelivery,
          message:
            caps.labelDelivery === 'carrier_provided'
              ? 'Shipping label: Provided by carrier'
              : 'No shipping label available from carrier API.',
        });
        continue;
      }

      try {
        const creds = await this.shipping.getDecryptedCredentials(providerCode);
        const label = await adapter.getLabel(creds, awb);
        if (label?.url || label?.pdfBase64) {
          labels.push({
            outboundOrderId: item.outboundOrderId,
            orderNumber: item.outboundOrder.orderNumber,
            awb,
            providerCode,
            labelDelivery: 'api',
            url: label.url,
            pdfBase64: label.pdfBase64,
            message: 'Shipping label: Available to print',
          });
        } else {
          labels.push({
            outboundOrderId: item.outboundOrderId,
            orderNumber: item.outboundOrder.orderNumber,
            awb,
            providerCode,
            labelDelivery: caps.labelDelivery,
            message: 'No shipping label available from carrier API.',
          });
        }
      } catch (err) {
        labels.push({
          outboundOrderId: item.outboundOrderId,
          orderNumber: item.outboundOrder.orderNumber,
          awb,
          providerCode,
          labelDelivery: caps.labelDelivery,
          message:
            err instanceof Error
              ? err.message.slice(0, 300)
              : 'Failed to fetch shipping label.',
        });
      }
    }

    return { jobId, labels };
  }

  // ─── Processing ───────────────────────────────────────────────────────────

  private async processJob(jobId: string) {
    if (this.runningJobs.has(jobId)) return;
    this.runningJobs.add(jobId);

    try {
      const claimed = await this.prisma.bulkShippingJob.updateMany({
        where: {
          id: jobId,
          status: {
            in: [
              BulkShippingJobStatus.pending,
              BulkShippingJobStatus.processing,
              BulkShippingJobStatus.completed_with_errors,
            ],
          },
        },
        data: {
          status: BulkShippingJobStatus.processing,
          startedAt: new Date(),
        },
      });
      if (claimed.count === 0) return;

      const pendingItems = await this.prisma.bulkShippingJobItem.findMany({
        where: {
          jobId,
          status: {
            in: [BulkShippingItemStatus.pending, BulkShippingItemStatus.failed],
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // Only process pending on fresh run; failed retries are set back to pending by retryItem.
      const queue = pendingItems.filter((i) => i.status === BulkShippingItemStatus.pending);

      await this.runPool(queue, BULK_SHIPPING_CONCURRENCY, async (item) => {
        await this.processItem(jobId, item.id);
      });

      await this.recomputeJobCounts(jobId);
    } catch (err) {
      this.logger.error(
        `Bulk shipping job ${jobId} failed: ${err instanceof Error ? err.message : err}`,
      );
      await this.prisma.bulkShippingJob.update({
        where: { id: jobId },
        data: {
          status: BulkShippingJobStatus.failed,
          errorMessage: (err instanceof Error ? err.message : 'Bulk job failed').slice(0, 500),
          completedAt: new Date(),
        },
      });
      this.emitProgress(jobId);
    } finally {
      this.runningJobs.delete(jobId);
    }
  }

  private async processItem(jobId: string, itemId: string) {
    const item = await this.prisma.bulkShippingJobItem.findUnique({
      where: { id: itemId },
    });
    if (!item || item.status !== BulkShippingItemStatus.pending) return;

    await this.prisma.bulkShippingJobItem.update({
      where: { id: itemId },
      data: { status: BulkShippingItemStatus.processing },
    });
    this.emitProgress(jobId);

    try {
      const providerCode = item.selectedProviderCode.trim().toUpperCase();

      if (providerCode === MANUAL_SHIPPING_CODE) {
        await this.prisma.outboundOrder.update({
          where: { id: item.outboundOrderId },
          data: {
            shippingMethod: ShippingMethod.manual,
            shippingProviderCode: null,
          },
        });
        await this.prisma.bulkShippingJobItem.update({
          where: { id: itemId },
          data: {
            status: BulkShippingItemStatus.skipped,
            lastErrorSafe: null,
            externalAwb: null,
            labelCapability: 'none',
            processedAt: new Date(),
          },
        });
        this.emitProgress(jobId);
        return;
      }

      // Apply selected carrier intent, then reuse canonical create path (idempotent).
      await this.prisma.outboundOrder.update({
        where: { id: item.outboundOrderId },
        data: {
          shippingMethod: ShippingMethod.carrier,
          shippingProviderCode: providerCode,
        },
      });

      await this.shipping.ensureShipmentForOutbound(item.outboundOrderId);

      const created = await this.prisma.carrierShipment.findFirst({
        where: {
          outboundOrderId: item.outboundOrderId,
          status: CarrierShipmentStatus.created,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (created?.externalAwb) {
        if (item.quotedPrice != null) {
          await this.prisma.carrierShipment.update({
            where: { id: created.id },
            data: {
              shippingCost: item.quotedPrice,
              currency: item.quotedCurrency ?? created.currency,
            },
          });
        }

        const order = await this.prisma.outboundOrder.findUnique({
          where: { id: item.outboundOrderId },
          select: { status: true },
        });
        // Never move away from ready_to_ship / never auto-ship.
        if (order && order.status !== OutboundOrderStatus.ready_to_ship) {
          this.logger.warn(
            `Bulk shipping: outbound ${item.outboundOrderId} status is ${order.status} after create (expected ready_to_ship)`,
          );
        }

        await this.prisma.bulkShippingJobItem.update({
          where: { id: itemId },
          data: {
            status: BulkShippingItemStatus.succeeded,
            externalAwb: created.externalAwb,
            lastErrorSafe: null,
            processedAt: new Date(),
            labelCapability: this.registry.has(providerCode)
              ? this.registry.get(providerCode).capabilities.labelDelivery
              : 'none',
          },
        });
      } else {
        const failed = await this.prisma.carrierShipment.findFirst({
          where: {
            outboundOrderId: item.outboundOrderId,
            status: CarrierShipmentStatus.failed,
          },
          orderBy: { createdAt: 'desc' },
        });
        await this.prisma.bulkShippingJobItem.update({
          where: { id: itemId },
          data: {
            status: BulkShippingItemStatus.failed,
            lastErrorSafe:
              failed?.lastErrorSafe?.trim() ||
              'Carrier shipment was not created. Check provider connection and order shipping details.',
            processedAt: new Date(),
          },
        });
      }
    } catch (err) {
      await this.prisma.bulkShippingJobItem.update({
        where: { id: itemId },
        data: {
          status: BulkShippingItemStatus.failed,
          lastErrorSafe: (err instanceof Error ? err.message : 'Processing failed').slice(0, 500),
          processedAt: new Date(),
        },
      });
    }

    this.emitProgress(jobId);
  }

  private async recomputeJobCounts(jobId: string) {
    const items = await this.prisma.bulkShippingJobItem.findMany({
      where: { jobId },
      select: { status: true },
    });
    const successCount = items.filter(
      (i) =>
        i.status === BulkShippingItemStatus.succeeded ||
        i.status === BulkShippingItemStatus.skipped,
    ).length;
    const failedCount = items.filter((i) => i.status === BulkShippingItemStatus.failed).length;
    const pendingCount = items.filter(
      (i) =>
        i.status === BulkShippingItemStatus.pending ||
        i.status === BulkShippingItemStatus.processing,
    ).length;
    const skippedCount = items.filter((i) => i.status === BulkShippingItemStatus.skipped).length;
    const trueSuccess = items.filter((i) => i.status === BulkShippingItemStatus.succeeded).length;
    const total = items.length;
    const done = total - pendingCount;
    const progressPercent = total === 0 ? 100 : Math.round((done / total) * 100);

    let status: BulkShippingJobStatus = BulkShippingJobStatus.processing;
    let completedAt: Date | null = null;
    if (pendingCount === 0) {
      completedAt = new Date();
      if (failedCount === 0) status = BulkShippingJobStatus.completed;
      else if (trueSuccess + skippedCount === 0) status = BulkShippingJobStatus.failed;
      else status = BulkShippingJobStatus.completed_with_errors;
    }

    await this.prisma.bulkShippingJob.update({
      where: { id: jobId },
      data: {
        successCount: trueSuccess,
        failedCount,
        skippedCount,
        progressPercent,
        status,
        completedAt,
      },
    });
    this.emitProgress(jobId);
  }

  private emitProgress(jobId: string) {
    void this.prisma.bulkShippingJob
      .findUnique({
        where: { id: jobId },
        select: {
          id: true,
          status: true,
          progressPercent: true,
          totalCount: true,
          successCount: true,
          failedCount: true,
          skippedCount: true,
        },
      })
      .then((job) => {
        if (!job) return;
        this.realtime.emitBulkShippingProgress({
          jobId: job.id,
          status: job.status,
          progressPercent: job.progressPercent,
          totalCount: job.totalCount,
          successCount: job.successCount,
          failedCount: job.failedCount,
          skippedCount: job.skippedCount,
        });
      })
      .catch(() => undefined);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  private async loadOrdersForBulk(ids: string[]) {
    return this.prisma.outboundOrder.findMany({
      where: { id: { in: ids } },
      include: {
        company: { select: { name: true } },
        omsOrder: { select: { id: true, orderNumber: true, trackingNumber: true } },
        carrierShipments: { select: { status: true, externalAwb: true } },
      },
    });
  }

  private assertAllEligible(
    orders: Array<{
      id: string;
      status: string;
      trackingNumber: string | null;
      carrierShipments: Array<{ status: string }>;
    }>,
    requestedIds: string[],
  ) {
    if (orders.length !== requestedIds.length) {
      const found = new Set(orders.map((o) => o.id));
      const missing = requestedIds.filter((id) => !found.has(id));
      throw new BadRequestException(`Outbound order(s) not found: ${missing.join(', ')}`);
    }
    const ineligible = orders.filter((o) => !isEligibleForBulkShipping(o));
    if (ineligible.length) {
      throw new BadRequestException(
        `Orders not eligible for bulk shipping (must be Waiting for Dispatch without an existing carrier shipment): ${ineligible
          .map((o) => o.id)
          .join(', ')}`,
      );
    }
  }

  private async listSelectableProviders() {
    const rows = await this.prisma.shippingProvider.findMany({
      where: { enabled: true },
      include: { connection: true },
      orderBy: { name: 'asc' },
    });

    const connected = rows.map((p) => {
      const caps = this.registry.has(p.code)
        ? this.registry.get(p.code).capabilities
        : {
            supportsQuote: false,
            supportsLabelPrinting: false,
            labelDelivery: 'none' as const,
          };
      return {
        code: p.code,
        name: p.name,
        supportsQuote: caps.supportsQuote,
        supportsLabelPrinting: caps.supportsLabelPrinting,
        labelDelivery: caps.labelDelivery,
        connected:
          p.connection?.status === ShippingProviderConnectionStatus.connected &&
          !!p.connection.encryptedUsername &&
          !!p.connection.encryptedPassword,
      };
    });

    return [
      {
        code: MANUAL_SHIPPING_CODE,
        name: 'Manual',
        supportsQuote: false,
        supportsLabelPrinting: false,
        labelDelivery: 'none',
        connected: true,
      },
      ...connected,
    ];
  }

  private async tryQuoteOrder(
    order: {
      shippingReceiverLat: Prisma.Decimal | null;
      shippingReceiverLng: Prisma.Decimal | null;
      shippingPackageType: string | null;
      shippingWeightKg: Prisma.Decimal | null;
      shippingDeliveryType: string | null;
      shippingPickupType: string | null;
    },
    providerCode: string,
  ): Promise<PreviewQuote | null> {
    try {
      if (!this.registry.has(providerCode)) return null;
      const adapter = this.registry.get(providerCode);
      if (!adapter.capabilities.supportsQuote) return null;

      const lat = Number(order.shippingReceiverLat);
      const lng = Number(order.shippingReceiverLng);
      const weightKg = Number(order.shippingWeightKg);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
      if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
      if (!order.shippingPackageType || !order.shippingDeliveryType) return null;

      const creds = await this.shipping.getDecryptedCredentials(providerCode);
      const result = await adapter.getQuote(creds, {
        receiverLat: lat,
        receiverLng: lng,
        packageType: order.shippingPackageType as 'box' | 'envelope',
        weightKg: order.shippingPackageType === 'envelope' ? 1 : weightKg,
        deliveryType: order.shippingDeliveryType as 'address' | 'hub',
        pickupType: (order.shippingPickupType as 'address' | 'hub' | undefined) ?? undefined,
      });

      if (!Number.isFinite(result.price)) return null;

      const provider = await this.prisma.shippingProvider.findUnique({
        where: { code: providerCode },
        select: { name: true },
      });

      return {
        providerCode,
        providerName: provider?.name ?? providerCode,
        price: result.price,
        currency: result.currency || 'USD',
      };
    } catch (err) {
      this.logger.debug(
        `Quote failed for ${providerCode}: ${err instanceof Error ? err.message : err}`,
      );
      return null;
    }
  }

  private async runPool<T>(
    items: T[],
    concurrency: number,
    worker: (item: T) => Promise<void>,
  ) {
    const queue = [...items];
    const runners = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (queue.length) {
        const next = queue.shift();
        if (!next) return;
        await worker(next);
      }
    });
    await Promise.all(runners);
  }

  private toJobView(job: {
    id: string;
    status: BulkShippingJobStatus;
    triggeredByUserId: string;
    totalCount: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    progressPercent: number;
    estimatedTotalCost: Prisma.Decimal | null;
    estimatedCurrency: string | null;
    errorMessage: string | null;
    startedAt: Date | null;
    completedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    items: Array<{
      id: string;
      outboundOrderId: string;
      status: BulkShippingItemStatus;
      selectedProviderCode: string;
      recommendedProviderCode: string | null;
      quotedPrice: Prisma.Decimal | null;
      quotedCurrency: string | null;
      externalAwb: string | null;
      labelCapability: string | null;
      lastErrorSafe: string | null;
      processedAt: Date | null;
      outboundOrder?: {
        id: string;
        orderNumber: string;
        status: string;
        trackingNumber: string | null;
        shippingMethod: ShippingMethod | null;
        shippingProviderCode: string | null;
        companyId: string;
        omsOrder: { id: string; orderNumber: string } | null;
        company: { name: string } | null;
      };
    }>;
  }) {
    return {
      id: job.id,
      status: job.status,
      triggeredByUserId: job.triggeredByUserId,
      totalCount: job.totalCount,
      successCount: job.successCount,
      failedCount: job.failedCount,
      skippedCount: job.skippedCount,
      progressPercent: job.progressPercent,
      estimatedTotalCost: job.estimatedTotalCost?.toString() ?? null,
      estimatedCurrency: job.estimatedCurrency,
      errorMessage: job.errorMessage,
      startedAt: job.startedAt?.toISOString() ?? null,
      completedAt: job.completedAt?.toISOString() ?? null,
      createdAt: job.createdAt.toISOString(),
      updatedAt: job.updatedAt.toISOString(),
      items: job.items.map((item) => ({
        id: item.id,
        outboundOrderId: item.outboundOrderId,
        status: item.status,
        selectedProviderCode: item.selectedProviderCode,
        recommendedProviderCode: item.recommendedProviderCode,
        quotedPrice: item.quotedPrice?.toString() ?? null,
        quotedCurrency: item.quotedCurrency,
        externalAwb: item.externalAwb,
        labelCapability: item.labelCapability,
        lastErrorSafe: item.lastErrorSafe,
        processedAt: item.processedAt?.toISOString() ?? null,
        orderNumber: item.outboundOrder?.orderNumber ?? null,
        omsOrderNumber: item.outboundOrder?.omsOrder?.orderNumber ?? null,
        companyName: item.outboundOrder?.company?.name ?? null,
        outboundStatus: item.outboundOrder?.status ?? null,
      })),
    };
  }
}

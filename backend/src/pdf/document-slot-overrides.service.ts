import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';

import { PrismaService } from '../common/prisma/prisma.service';
import { UpdateDocumentSlotDto } from './dto/document-slot.dto';

export type DocumentSlotFields = {
  clientReference: string;
  notes: string;
  supplier: string;
  poNumber: string;
  operatorName: string;
  destination: string;
  carrier: string;
  trackingNumber: string;
  vehicle: string;
  driver: string;
};

const EMPTY: DocumentSlotFields = {
  clientReference: '',
  notes: '',
  supplier: '',
  poNumber: '',
  operatorName: '',
  destination: '',
  carrier: '',
  trackingNumber: '',
  vehicle: '',
  driver: '',
};

function orEmpty(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function display(value: string): string {
  return value || '—';
}

@Injectable()
export class DocumentSlotOverridesService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolved PDF field values (override wins, then order/task defaults). */
  async resolveForTask(taskId: string, type: 'grn' | 'delivery_note') {
    const merged = await this.loadMerged(taskId, type);
    return {
      clientReference: display(merged.clientReference),
      notes: merged.notes,
      supplier: display(merged.supplier),
      poNumber: display(merged.poNumber),
      operatorName: display(merged.operatorName),
      destination: display(merged.destination),
      carrier: display(merged.carrier),
      trackingNumber: display(merged.trackingNumber),
      vehicle: display(merged.vehicle),
      driver: display(merged.driver),
    };
  }

  async getEditable(taskId: string, type: 'grn' | 'delivery_note') {
    const merged = await this.loadMerged(taskId, type);
    return { taskId, type, fields: merged };
  }

  async upsert(taskId: string, dto: UpdateDocumentSlotDto) {
    await this.assertTaskMatchesType(taskId, dto.type);

    const data = {
      clientReference: dto.clientReference?.trim() || null,
      notes: dto.notes?.trim() || null,
      supplier: dto.supplier?.trim() || null,
      poNumber: dto.poNumber?.trim() || null,
      operatorName: dto.operatorName?.trim() || null,
      destination: dto.destination?.trim() || null,
      carrier: dto.carrier?.trim() || null,
      trackingNumber: dto.trackingNumber?.trim() || null,
      vehicle: dto.vehicle?.trim() || null,
      driver: dto.driver?.trim() || null,
    };

    await this.prisma.documentSlotOverride.upsert({
      where: { taskId },
      create: { taskId, ...data },
      update: data,
    });

    return this.getEditable(taskId, dto.type);
  }

  private async loadMerged(taskId: string, type: 'grn' | 'delivery_note'): Promise<DocumentSlotFields> {
    const { defaults, override } = await this.loadSources(taskId, type);
    return {
      clientReference: orEmpty(override?.clientReference ?? defaults.clientReference),
      notes: orEmpty(override?.notes ?? defaults.notes),
      supplier: orEmpty(override?.supplier ?? defaults.supplier),
      poNumber: orEmpty(override?.poNumber ?? defaults.poNumber),
      operatorName: orEmpty(override?.operatorName ?? defaults.operatorName),
      destination: orEmpty(override?.destination ?? defaults.destination),
      carrier: orEmpty(override?.carrier ?? defaults.carrier),
      trackingNumber: orEmpty(override?.trackingNumber ?? defaults.trackingNumber),
      vehicle: orEmpty(override?.vehicle ?? defaults.vehicle),
      driver: orEmpty(override?.driver ?? defaults.driver),
    };
  }

  private async loadSources(taskId: string, type: 'grn' | 'delivery_note') {
    const task = await this.prisma.warehouseTask.findUnique({
      where: { id: taskId },
      include: { workflowInstance: true },
    });
    if (!task) throw new NotFoundException('Task not found.');
    await this.assertTaskMatchesType(taskId, type, task);

    const override = await this.prisma.documentSlotOverride.findUnique({ where: { taskId } });
    const refId = task.workflowInstance.referenceId;

    if (type === 'grn') {
      const order = await this.prisma.inboundOrder.findUnique({
        where: { id: refId },
        include: { company: true },
      });
      if (!order) throw new NotFoundException('Inbound order not found.');
      const operator = task.completedById
        ? await this.prisma.user.findUnique({ where: { id: task.completedById } })
        : null;
      return {
        override,
        defaults: {
          ...EMPTY,
          clientReference: orEmpty(order.clientReference),
          notes: orEmpty(order.notes),
          operatorName: orEmpty(operator?.fullName),
        },
      };
    }

    const order = await this.prisma.outboundOrder.findUnique({ where: { id: refId } });
    if (!order) throw new NotFoundException('Outbound order not found.');
    const operator = task.completedById
      ? await this.prisma.user.findUnique({ where: { id: task.completedById } })
      : null;
    return {
      override,
      defaults: {
        ...EMPTY,
        clientReference: orEmpty(order.clientReference),
        notes: orEmpty(order.notes),
        destination: orEmpty(order.destinationAddress),
        carrier: orEmpty(order.carrier),
        trackingNumber: orEmpty(order.trackingNumber),
        operatorName: orEmpty(operator?.fullName),
      },
    };
  }

  private async assertTaskMatchesType(
    taskId: string,
    type: 'grn' | 'delivery_note',
    task?: { taskType: string } | null,
  ) {
    const row =
      task ??
      (await this.prisma.warehouseTask.findUnique({
        where: { id: taskId },
        select: { taskType: true },
      }));
    if (!row) throw new NotFoundException('Task not found.');
    const expected = type === 'grn' ? 'receiving' : 'dispatch';
    if (row.taskType !== expected) {
      throw new BadRequestException(`Task type does not match document type ${type}.`);
    }
  }
}

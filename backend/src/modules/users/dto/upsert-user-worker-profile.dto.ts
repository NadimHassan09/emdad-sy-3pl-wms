import { WorkerOperationalRole } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsUUID,
  ValidateIf,
} from 'class-validator';

export class UpsertUserWorkerProfileDto {
  /** Optional home warehouse; omit to leave unchanged, `null` for tenant-wide. */
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsUUID()
  warehouseId?: string | null;

  /** Operational roles (receiver, picker, etc.). Required when provisioning a new profile. */
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(WorkerOperationalRole, { each: true })
  roles?: WorkerOperationalRole[];

  /** Link an existing unassigned worker row instead of creating a new one. */
  @IsOptional()
  @IsUUID()
  linkWorkerId?: string;
}

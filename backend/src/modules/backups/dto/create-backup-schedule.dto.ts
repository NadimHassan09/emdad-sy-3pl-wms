import { BackupScheduleFrequency, BackupStoragePolicy } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class CreateBackupScheduleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;

  @IsEnum(BackupScheduleFrequency)
  frequency!: BackupScheduleFrequency;

  @IsInt()
  @Min(0)
  @Max(23)
  hour!: number;

  @IsInt()
  @Min(0)
  @Max(59)
  minute!: number;

  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays!: number;

  @IsOptional()
  @IsEnum(BackupStoragePolicy)
  storagePolicy?: BackupStoragePolicy;
}

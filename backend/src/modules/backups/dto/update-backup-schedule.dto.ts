import { BackupScheduleFrequency, BackupStoragePolicy } from '@prisma/client';
import { IsBoolean, IsEnum, IsInt, IsOptional, Max, Min } from 'class-validator';

export class UpdateBackupScheduleDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsEnum(BackupScheduleFrequency)
  frequency?: BackupScheduleFrequency;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  hour?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(59)
  minute?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  retentionDays?: number;

  @IsOptional()
  @IsEnum(BackupStoragePolicy)
  storagePolicy?: BackupStoragePolicy | null;
}

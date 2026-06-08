import { BackupJobStatus, BackupJobType } from '@prisma/client';
import { Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Backup types shown in Backup History (excludes restore / factory_reset metadata rows). */
export const BACKUP_HISTORY_JOB_TYPES: BackupJobType[] = [
  BackupJobType.manual,
  BackupJobType.scheduled,
  BackupJobType.upload,
  BackupJobType.pre_snapshot,
];

export class ListBackupsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsIn(BACKUP_HISTORY_JOB_TYPES)
  type?: BackupJobType;

  @IsOptional()
  @IsEnum(BackupJobStatus)
  status?: BackupJobStatus;

  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;
}

import { BackupStoragePolicy } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateBackupStoragePolicyDto {
  @IsEnum(BackupStoragePolicy)
  defaultPolicy!: BackupStoragePolicy;
}

import {
  ProtectedBackupSummary,
  RetentionBucket,
  RetentionBucketSummary,
  RetentionProtectionReason,
} from './backup-retention.types';

export type DriveRetentionCleanupResult = {
  dryRun: boolean;
  policies: {
    keepLastDaily: number;
    keepLastWeekly: number;
    keepLastMonthly: number;
  };
  buckets: RetentionBucketSummary[];
  protected: ProtectedBackupSummary[];
  deletedDriveCount: number;
  deletedJobCount: number;
  deletedDriveJobIds: string[];
  deletedJobIds: string[];
};

export type { RetentionBucket, RetentionProtectionReason };

export type RetentionBucket = 'daily' | 'weekly' | 'monthly';

export type RetentionProtectionReason =
  | 'latest_successful'
  | 'active_operation'
  | 'pre_snapshot_age'
  | 'retained_in_bucket';

export type ProtectedBackupSummary = {
  jobId: string;
  type: string;
  label: string | null;
  completedAt: string | null;
  reasons: RetentionProtectionReason[];
};

export type RetentionBucketSummary = {
  bucket: RetentionBucket;
  keepLast: number;
  totalEligible: number;
  retainedCount: number;
  expiredCount: number;
  retainedJobIds: string[];
  expiredJobIds: string[];
};

export type RetentionCleanupResult = {
  dryRun: boolean;
  policies: {
    keepLastDaily: number;
    keepLastWeekly: number;
    keepLastMonthly: number;
    preSnapshotProtectDays: number;
  };
  buckets: RetentionBucketSummary[];
  protected: ProtectedBackupSummary[];
  deletedCount: number;
  bytesReclaimed: number;
  deletedJobIds: string[];
};

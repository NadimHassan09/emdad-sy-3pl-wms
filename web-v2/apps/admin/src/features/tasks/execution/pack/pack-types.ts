export type PackageType = 'box' | 'carton' | 'pallet' | 'envelope' | 'other';

export type PackPackageItem = {
  outboundOrderLineId: string;
  quantity: string;
};

export type PackPackageDraft = {
  id: string;
  label: string;
  packageType: PackageType;
  weightKg: string;
  lengthCm: string;
  widthCm: string;
  heightCm: string;
  status: 'open' | 'finalized';
  items: PackPackageItem[];
};

export type PackLineDraft = {
  outboundOrderLineId: string;
  pickedQty: string;
  packedQty: string;
  damagedQty: string;
  verified: boolean;
  productVerified: boolean;
  notes: string;
  exceptionType: 'none' | 'missing' | 'damaged' | 'overpack';
};

export type PackLineStatus = 'pending' | 'verifying' | 'packing' | 'complete' | 'short' | 'overpack';

export type PackScanStep = 'product' | 'package';

export type PackExecutionDraft = {
  lines: PackLineDraft[];
  packages: PackPackageDraft[];
  activePackageId?: string;
  activeLineIndex?: number;
  verificationComplete?: boolean;
  packingStationId?: string;
};

export type PackSummary = {
  totalSkus: number;
  totalPickedUnits: number;
  packedUnits: number;
  remainingUnits: number;
  packageCount: number;
  completionPct: number;
};

export type DispatchReadiness = 'awaiting' | 'partial' | 'ready' | 'blocked';

export type DispatchScanStep = 'source' | 'destination' | 'package';

export type DispatchPackageDraft = {
  id: string;
  label: string;
  weightKg: string;
  itemCount: number;
  scanned: boolean;
  ready: boolean;
};

export type DispatchLineDraft = {
  outboundOrderLineId: string;
  pickedQty: string;
  shipQty: string;
  verified: boolean;
  notes: string;
};

export type DispatchExecutionDraft = {
  sourceLocationId: string;
  destinationLocationId: string;
  sourceVerified: boolean;
  destVerified: boolean;
  packages: DispatchPackageDraft[];
  lines: DispatchLineDraft[];
  carrier: string;
  tracking: string;
  driverName: string;
  vehicleInfo: string;
  dispatchNotes: string;
};

export type DispatchSummary = {
  totalSkus: number;
  totalUnits: number;
  packageCount: number;
  packagesScanned: number;
  totalWeightKg: number;
  readiness: DispatchReadiness;
  completionPct: number;
};

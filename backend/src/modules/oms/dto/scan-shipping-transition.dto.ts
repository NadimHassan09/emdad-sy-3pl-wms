import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';

export const OMS_SHIPPING_SCAN_ACTIONS = ['ready_to_ship', 'handover'] as const;
export type OmsShippingScanAction = (typeof OMS_SHIPPING_SCAN_ACTIONS)[number];

export class ScanShippingTransitionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  code!: string;

  @IsIn(OMS_SHIPPING_SCAN_ACTIONS)
  action!: OmsShippingScanAction;
}

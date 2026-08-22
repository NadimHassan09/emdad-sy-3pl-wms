import { IsObject } from 'class-validator';

export class PatchTaskPlanDto {
  @IsObject()
  plan_patch!: Record<string, unknown>;
}

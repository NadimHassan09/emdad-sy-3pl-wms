import { IsInt, IsObject, IsOptional, IsUUID } from 'class-validator';

export class PatchTaskProgressDto {
  @IsObject()
  execution_state_patch!: Record<string, unknown>;

  @IsOptional()
  @IsUUID()
  task_id?: string;

  @IsOptional()
  @IsInt()
  schema_version?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

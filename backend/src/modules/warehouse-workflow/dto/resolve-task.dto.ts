import { IsIn, IsOptional, IsString, MinLength } from 'class-validator';

export type ResolveTaskResolution =
  | 'resume'
  | 'cancel_remaining'
  | 'approve_partial'
  | 'fork_new_task';

/** Part III GAP2 — extended manager outcome on blocked tasks. */
export class ResolveTaskDto {
  @IsIn(['resume', 'cancel_remaining', 'approve_partial', 'fork_new_task'])
  resolution!: ResolveTaskResolution;

  @IsString()
  @MinLength(4)
  reason!: string;

  /** Optional hint for auditing when forking remediation work. */
  @IsOptional()
  @IsString()
  fork_hint?: string;
}

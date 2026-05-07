import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

/** Logical system roles in the admin UI — mapped to `UserRole` in the service. */
export type CreateSystemRoleUi = 'super_admin' | 'admin' | 'worker';

export class CreateUserDto {
  @IsIn(['system', 'client'])
  kind!: 'system' | 'client';

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(40)
  phone?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @ValidateIf((o: CreateUserDto) => o.kind === 'client')
  @IsUUID()
  companyId!: string;

  @ValidateIf((o: CreateUserDto) => o.kind === 'client')
  @IsIn(['client_admin', 'client_staff'])
  clientRole!: 'client_admin' | 'client_staff';

  @ValidateIf((o: CreateUserDto) => o.kind === 'system')
  @IsIn(['super_admin', 'admin', 'worker'])
  systemRole!: CreateSystemRoleUi;

  /**
   * When creating a system user with Worker role, optional default warehouse on the
   * tenant `Worker` row (requires caller `X-Company-Id` / mock company on the session).
   */
  @ValidateIf((o: CreateUserDto) => o.kind === 'system' && o.systemRole === 'worker')
  @Transform(({ value }) => (value === '' || value === null ? undefined : value))
  @IsOptional()
  @IsUUID()
  workerWarehouseId?: string;
}

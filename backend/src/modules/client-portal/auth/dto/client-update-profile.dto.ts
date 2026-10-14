import { IsString, MaxLength, MinLength } from 'class-validator';

export class ClientUpdateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  fullName!: string;
}

import { IsEmail } from 'class-validator';

export class ClientRequestPasswordResetDto {
  @IsEmail()
  email!: string;
}

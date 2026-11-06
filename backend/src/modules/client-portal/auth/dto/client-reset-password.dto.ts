import { IsEmail, IsString, Length, MinLength } from 'class-validator';

export class ClientResetPasswordDto {
  @IsEmail()
  email!: string;

  @IsString()
  @Length(6, 6)
  code!: string;

  @IsString()
  @MinLength(8)
  newPassword!: string;
}

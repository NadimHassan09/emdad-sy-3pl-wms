import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ClientLoginDto {
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;
}

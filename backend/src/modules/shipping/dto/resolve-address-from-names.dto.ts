import { IsString, MaxLength } from 'class-validator';

export class ResolveAddressFromNamesDto {
  @IsString()
  @MaxLength(120)
  governorate!: string;

  @IsString()
  @MaxLength(120)
  cityRegion!: string;

  @IsString()
  @MaxLength(200)
  townNeighborhood!: string;
}

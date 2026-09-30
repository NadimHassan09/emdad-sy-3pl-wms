import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ExportWaybillsDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  orderIds!: string[];
}

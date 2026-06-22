import { IsArray, ArrayMaxSize, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { CreateTierDto } from './create-tier.dto';

export class BulkCreateTiersDto {
  @ApiProperty({ type: [CreateTierDto], description: 'Tiers to create (max 10)' })
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateTierDto)
  tiers: CreateTierDto[];
}

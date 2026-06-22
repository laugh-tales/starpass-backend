import { IsOptional, IsBoolean, IsInt, Min, Max, Matches, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type, Transform } from 'class-transformer';

export class ListPassesDto {
  @ApiPropertyOptional({ description: 'Stellar address of the fan to filter by' })
  @IsOptional()
  @Matches(/^G[A-Z2-7]{55}$/, {
    message: 'fan must be a valid Stellar public key',
  })
  fan?: string;

  @ApiPropertyOptional({ description: 'UUID of the tier to filter by' })
  @IsOptional()
  @IsUUID('4')
  tier_id?: string;

  @ApiPropertyOptional({ description: 'Filter by active status (true/false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  active?: boolean;

  @ApiPropertyOptional({ description: 'Filter by expired status (true/false)' })
  @IsOptional()
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @IsBoolean()
  expired?: boolean;

  @ApiPropertyOptional({ description: 'Page number for pagination', default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: 'Number of records per page', default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 20;
}

import { IsString, IsNotEmpty, IsOptional, IsNumber, IsBoolean, Min, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class CreateTierDto {
  @ApiProperty({ description: 'On-chain tier ID' })
  @IsNumber()
  @Type(() => Number)
  onChainId: number;

  @ApiProperty({ description: 'Tier name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: 'Tier description' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  description?: string;

  @ApiProperty({ description: 'Price in USDC' })
  @IsString()
  @IsNotEmpty()
  priceUsdc: string;

  @ApiProperty({ description: 'Duration in days' })
  @IsNumber()
  @Min(1)
  @Type(() => Number)
  durationDays: number;

  @ApiPropertyOptional({ description: 'Max supply (0 = unlimited)' })
  @IsNumber()
  @IsOptional()
  @Min(0)
  @Type(() => Number)
  maxSupply?: number;

  @ApiPropertyOptional({ description: 'Whether the tier is active', default: true })
  @IsBoolean()
  @IsOptional()
  active?: boolean;
}

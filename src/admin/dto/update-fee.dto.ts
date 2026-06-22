import { IsInt, Min, Max } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateFeeDto {
  @ApiProperty({
    description: 'Platform fee in basis points (bps). 100 bps = 1%. Must be between 0 and 1000 (0–10%).',
    minimum: 0,
    maximum: 1000,
    example: 250,
  })
  @IsInt()
  @Min(0)
  @Max(1000)
  feeBps: number;
}

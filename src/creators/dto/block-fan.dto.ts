import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class BlockFanDto {
  @ApiProperty({ description: 'Stellar public key of the fan to block' })
  @IsString()
  @IsNotEmpty()
  fanAddress: string;

  @ApiPropertyOptional({ description: 'Reason for blocking this fan' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  reason?: string;
}

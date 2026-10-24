import { IsString, IsOptional, IsEnum, IsInt, IsEmail, IsObject, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum TenantStatus {
  ACTIVE = 'ACTIVE',
  SUSPENDED = 'SUSPENDED',
  PENDING = 'PENDING',
  TRIAL = 'TRIAL',
}

export class CreateTenantDto {
  @ApiProperty({ description: 'Tenant name' })
  @IsString()
  name: string;

  @ApiProperty({ description: 'Tenant slug (unique identifier)' })
  @IsString()
  slug: string;

  @ApiPropertyOptional({ enum: TenantStatus, default: TenantStatus.ACTIVE })
  @IsEnum(TenantStatus)
  @IsOptional()
  status?: TenantStatus;

  @ApiPropertyOptional({ description: 'Logo URL' })
  @IsString()
  @IsOptional()
  logoUrl?: string;

  @ApiPropertyOptional({ description: 'Primary brand color (hex)' })
  @IsString()
  @IsOptional()
  primaryColor?: string;

  @ApiPropertyOptional({ description: 'Secondary brand color (hex)' })
  @IsString()
  @IsOptional()
  secondaryColor?: string;

  @ApiPropertyOptional({ description: 'Custom domain' })
  @IsString()
  @IsOptional()
  customDomain?: string;

  @ApiPropertyOptional({ description: 'Feature flags', default: {} })
  @IsObject()
  @IsOptional()
  features?: Record<string, any>;

  @ApiPropertyOptional({ description: 'Platform fee in basis points', default: 250 })
  @IsInt()
  @Min(0)
  @Max(10000)
  @IsOptional()
  feeBps?: number;

  @ApiPropertyOptional({ description: 'Maximum number of creators', default: 1000 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxCreators?: number;

  @ApiPropertyOptional({ description: 'Maximum passes per creator', default: 100 })
  @IsInt()
  @Min(1)
  @IsOptional()
  maxPassesPerCreator?: number;

  @ApiPropertyOptional({ description: 'Admin email' })
  @IsEmail()
  @IsOptional()
  adminEmail?: string;

  @ApiPropertyOptional({ description: 'Support email' })
  @IsEmail()
  @IsOptional()
  supportEmail?: string;
}

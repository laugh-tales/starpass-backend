import { IsString, IsOptional, IsUrl, MaxLength } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateCreatorDto {
  @ApiPropertyOptional({ description: 'Updated display name shown to fans', example: 'Jane Doe' })
  @IsString()
  @IsOptional()
  @MaxLength(100)
  displayName?: string;

  @ApiPropertyOptional({ description: 'Updated creator bio', example: 'A digital artist making illustrations.' })
  @IsString()
  @IsOptional()
  @MaxLength(500)
  bio?: string;

  @ApiPropertyOptional({ description: 'Updated avatar image URL', example: 'https://example.com/avatar.png' })
  @IsString()
  @IsOptional()
  @IsUrl()
  avatarUrl?: string;

  @ApiPropertyOptional({ description: 'Updated Twitter/X profile URL', example: 'https://x.com/janedoe' })
  @IsUrl()
  @IsOptional()
  twitterUrl?: string;

  @ApiPropertyOptional({ description: 'Updated Instagram profile URL', example: 'https://instagram.com/janedoe' })
  @IsUrl()
  @IsOptional()
  instagramUrl?: string;

  @ApiPropertyOptional({ description: 'Updated personal or creator website URL', example: 'https://janedoe.example' })
  @IsUrl()
  @IsOptional()
  websiteUrl?: string;
}

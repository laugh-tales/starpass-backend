import { Controller, Post, Body, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

class RefreshDto {
  @ApiProperty({ description: 'Refresh token issued at login' })
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

@ApiTags('auth')
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private authService: AuthService) {}

  @Get('challenge')
  @ApiOperation({ summary: 'Get a challenge message to sign with your Stellar keypair' })
  @ApiResponse({ status: 200, description: 'Challenge message generated successfully' })
  getChallenge(@Query('address') address: string) {
    return { challenge: this.authService.getChallenge(address) };
  }

  @Post('login')
  @ApiOperation({ summary: 'Login with a signed Stellar challenge' })
  @ApiResponse({ status: 201, description: 'Login successful — returns access token and refresh token' })
  @ApiResponse({ status: 401, description: 'Invalid signature or challenge' })
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.stellarAddress, dto.signature, dto.message);
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Issue a new access token using a refresh token' })
  @ApiResponse({ status: 201, description: 'New access token issued' })
  @ApiResponse({ status: 401, description: 'Refresh token expired or invalid' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refresh(dto.refreshToken);
  }

  @Post('logout')
  @ApiOperation({ summary: 'Revoke a refresh token' })
  @ApiResponse({ status: 201, description: 'Logged out successfully' })
  logout(@Body() dto: RefreshDto) {
    return this.authService.logout(dto.refreshToken);
  }
}

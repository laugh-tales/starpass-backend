import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-admin-api-key'];
    const expected = this.configService.get<string>('ADMIN_API_KEY');
    if (!expected || key !== expected) {
      throw new UnauthorizedException('Invalid or missing admin API key');
    }
    return true;
  }
}

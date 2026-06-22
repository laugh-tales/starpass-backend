import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminApiKeyGuard implements CanActivate {
  constructor(private config: ConfigService) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request & { headers: Record<string, string> }>();
    const key = req.headers['x-admin-api-key'];
    const expected = this.config.get<string>('ADMIN_API_KEY');

    if (!expected || !key || key !== expected) {
      throw new ForbiddenException('Invalid or missing admin API key');
    }

    return true;
  }
}

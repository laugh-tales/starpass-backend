import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ApiKeysService } from './api-keys.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private apiKeysService: ApiKeysService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = request.headers['x-api-key'];
    if (!key) throw new UnauthorizedException('Missing X-API-Key header');

    const apiKey = await this.apiKeysService.validateKey(key);
    request.apiKey = apiKey;
    return true;
  }
}

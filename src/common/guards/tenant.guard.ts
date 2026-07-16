import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TenantRequest } from '../middleware/tenant.middleware';

@Injectable()
export class TenantGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<TenantRequest>();
    
    // Check if tenant context is set
    if (!request.tenantId || !request.tenant) {
      throw new ForbiddenException('Tenant context not found');
    }

    // Check if tenant is active
    if (request.tenant.status !== 'ACTIVE') {
      throw new ForbiddenException('Tenant is not active');
    }

    return true;
  }
}

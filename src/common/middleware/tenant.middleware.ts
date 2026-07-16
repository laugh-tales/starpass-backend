import { Injectable, NestMiddleware, BadRequestException, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../prisma.service';

export interface TenantRequest extends Request {
  tenant?: {
    id: string;
    slug: string;
    name: string;
    status: string;
    features: Record<string, any>;
  };
  tenantId?: string;
}

@Injectable()
export class TenantMiddleware implements NestMiddleware {
  private readonly logger = new Logger(TenantMiddleware.name);
  private readonly DEFAULT_TENANT_SLUG = 'default';

  constructor(private prisma: PrismaService) {}

  async use(req: TenantRequest, res: Response, next: NextFunction) {
    try {
      // Extract tenant from various sources in order of priority:
      // 1. Custom domain (subdomain or full domain)
      // 2. X-Tenant-Slug header
      // 3. X-Tenant-Id header
      // 4. JWT token (if authenticated)
      // 5. Default to 'default' tenant

      let tenantSlug: string | undefined;
      let tenantId: string | undefined;

      // Extract from custom domain
      const host = req.headers.host;
      if (host) {
        const subdomain = this.extractSubdomain(host);
        if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
          tenantSlug = subdomain;
        }
      }

      // Extract from headers
      if (!tenantSlug) {
        tenantSlug = req.headers['x-tenant-slug'] as string;
      }
      if (!tenantId) {
        tenantId = req.headers['x-tenant-id'] as string;
      }

      // If no tenant info found, use default
      if (!tenantSlug && !tenantId) {
        tenantSlug = this.DEFAULT_TENANT_SLUG;
      }

      // Fetch tenant from database
      let tenant;
      if (tenantId) {
        tenant = await this.prisma.tenant.findUnique({
          where: { id: tenantId },
        });
      } else if (tenantSlug) {
        tenant = await this.prisma.tenant.findUnique({
          where: { slug: tenantSlug },
        });
      }

      if (!tenant) {
        throw new BadRequestException('Tenant not found');
      }

      // Check tenant status
      if (tenant.status !== 'ACTIVE') {
        throw new BadRequestException('Tenant is not active');
      }

      // Set tenant context
      req.tenant = {
        id: tenant.id,
        slug: tenant.slug,
        name: tenant.name,
        status: tenant.status,
        features: tenant.features as Record<string, any>,
      };
      req.tenantId = tenant.id;

      this.logger.debug(`Tenant context set: ${tenant.slug} (${tenant.id})`);
      next();
    } catch (error) {
      this.logger.error(`Tenant middleware error: ${error.message}`);
      throw error;
    }
  }

  private extractSubdomain(host: string): string | null {
    // Remove port if present
    const hostname = host.split(':')[0];
    
    // Split by dots
    const parts = hostname.split('.');
    
    // If we have at least 3 parts (subdomain.domain.tld), extract subdomain
    if (parts.length >= 3) {
      return parts[0];
    }
    
    return null;
  }
}

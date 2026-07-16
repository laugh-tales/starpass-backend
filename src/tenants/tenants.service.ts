import { Injectable, NotFoundException, ConflictException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';

@Injectable()
export class TenantsService {
  private readonly logger = new Logger(TenantsService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Create a new tenant
   */
  async create(dto: CreateTenantDto) {
    // Check if slug already exists
    const existing = await this.prisma.tenant.findUnique({
      where: { slug: dto.slug },
    });

    if (existing) {
      throw new ConflictException('Tenant slug already exists');
    }

    // Check if custom domain already exists
    if (dto.customDomain) {
      const existingDomain = await this.prisma.tenant.findUnique({
        where: { customDomain: dto.customDomain },
      });

      if (existingDomain) {
        throw new ConflictException('Custom domain already in use');
      }
    }

    return this.prisma.tenant.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        status: dto.status || 'ACTIVE',
        logoUrl: dto.logoUrl,
        primaryColor: dto.primaryColor,
        secondaryColor: dto.secondaryColor,
        customDomain: dto.customDomain,
        features: dto.features || {},
        feeBps: dto.feeBps ?? 250,
        maxCreators: dto.maxCreators ?? 1000,
        maxPassesPerCreator: dto.maxPassesPerCreator ?? 100,
        adminEmail: dto.adminEmail,
        supportEmail: dto.supportEmail,
      },
    });
  }

  /**
   * Get all tenants (admin only)
   */
  async findAll(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;

    const [tenants, total] = await Promise.all([
      this.prisma.tenant.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          _count: {
            select: {
              users: true,
              creators: true,
            },
          },
        },
      }),
      this.prisma.tenant.count(),
    ]);

    return { data: tenants, total, page, limit };
  }

  /**
   * Get tenant by ID
   */
  async findById(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            creators: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Get tenant by slug
   */
  async findBySlug(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      include: {
        _count: {
          select: {
            users: true,
            creators: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return tenant;
  }

  /**
   * Update tenant
   */
  async update(id: string, dto: UpdateTenantDto) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Check if slug is being changed and if it already exists
    if (dto.slug && dto.slug !== tenant.slug) {
      const existing = await this.prisma.tenant.findUnique({
        where: { slug: dto.slug },
      });

      if (existing) {
        throw new ConflictException('Tenant slug already exists');
      }
    }

    // Check if custom domain is being changed and if it already exists
    if (dto.customDomain && dto.customDomain !== tenant.customDomain) {
      const existingDomain = await this.prisma.tenant.findUnique({
        where: { customDomain: dto.customDomain },
      });

      if (existingDomain) {
        throw new ConflictException('Custom domain already in use');
      }
    }

    return this.prisma.tenant.update({
      where: { id },
      data: dto,
    });
  }

  /**
   * Delete tenant (soft delete by setting status to SUSPENDED)
   */
  async remove(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    // Soft delete by suspending
    return this.prisma.tenant.update({
      where: { id },
      data: { status: 'SUSPENDED' },
    });
  }

  /**
   * Get tenant statistics
   */
  async getStats(id: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    const [userCount, creatorCount, passCount, tierCount] = await Promise.all([
      this.prisma.user.count({ where: { tenantId: id } }),
      this.prisma.creator.count({ where: { tenantId: id } }),
      this.prisma.pass.count({ where: { tenantId: id } }),
      this.prisma.tier.count({ where: { tenantId: id } }),
    ]);

    return {
      tenantId: id,
      userCount,
      creatorCount,
      passCount,
      tierCount,
    };
  }

  /**
   * Check if a feature is enabled for a tenant
   */
  async isFeatureEnabled(tenantId: string, feature: string): Promise<boolean> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { features: true },
    });

    if (!tenant) {
      return false;
    }

    const features = tenant.features as Record<string, boolean>;
    return features[feature] === true;
  }

  /**
   * Get tenant configuration for frontend
   */
  async getFrontendConfig(slug: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        primaryColor: true,
        secondaryColor: true,
        features: true,
      },
    });

    if (!tenant) {
      throw new NotFoundException('Tenant not found');
    }

    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      branding: {
        logoUrl: tenant.logoUrl,
        primaryColor: tenant.primaryColor,
        secondaryColor: tenant.secondaryColor,
      },
      features: tenant.features,
    };
  }
}

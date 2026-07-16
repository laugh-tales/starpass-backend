# Multi-Tenant Architecture Implementation

This document describes the multi-tenant architecture implementation for StarPass, supporting white-label deployments.

## Overview

The StarPass backend now supports multi-tenancy, allowing multiple white-label deployments to run on a single infrastructure while maintaining complete data isolation and custom branding for each tenant.

## Architecture Components

### 1. Database Schema

#### Tenant Model
- **Location**: `prisma/schema.prisma`
- **Fields**:
  - `id`: Unique identifier
  - `name`: Display name
  - `slug`: URL-friendly unique identifier
  - `status`: ACTIVE, SUSPENDED, PENDING, TRIAL
  - `logoUrl`: Custom branding logo
  - `primaryColor`, `secondaryColor`: Brand colors
  - `customDomain`: Custom domain for white-label deployments
  - `features`: JSON field for feature flags
  - `feeBps`: Platform fee configuration
  - `maxCreators`, `maxPassesPerCreator`: Tenant limits
  - `adminEmail`, `supportEmail`: Contact information

#### Tenant Isolation
All core models now include `tenantId` for data isolation:
- User
- Creator
- Category
- Fan
- Tier
- Pass
- EarningsRecord
- ContentSchedule
- Notification
- WaitlistEntry
- Block
- CreatorMember

### 2. Tenant Middleware

**Location**: `src/common/middleware/tenant.middleware.ts`

The middleware extracts tenant context from requests using multiple strategies:
1. **Custom Domain**: Extracts subdomain from `Host` header
2. **X-Tenant-Slug Header**: Explicit tenant slug
3. **X-Tenant-Id Header**: Explicit tenant ID
4. **Default**: Falls back to 'default' tenant

The middleware sets:
- `req.tenant`: Full tenant object with features
- `req.tenantId`: Tenant ID for filtering

### 3. Tenant Service

**Location**: `src/tenants/tenants.service.ts`

Provides CRUD operations for tenant management:
- `create()`: Create new tenant
- `findAll()`: List all tenants (admin)
- `findById()`, `findBySlug()`: Get specific tenant
- `update()`: Update tenant configuration
- `remove()`: Soft delete (suspend tenant)
- `getStats()`: Get tenant usage statistics
- `isFeatureEnabled()`: Check feature flags
- `getFrontendConfig()`: Get public tenant configuration

### 4. Tenant Controller

**Location**: `src/tenants/tenants.controller.ts`

REST API endpoints:
- `POST /tenants`: Create tenant (admin)
- `GET /tenants`: List tenants (admin)
- `GET /tenants/:id`: Get tenant by ID (admin)
- `GET /tenants/slug/:slug`: Get tenant by slug (public)
- `GET /tenants/config/:slug`: Get frontend config (public)
- `GET /tenants/:id/stats`: Get statistics (admin)
- `PUT /tenants/:id`: Update tenant (admin)
- `DELETE /tenants/:id`: Suspend tenant (admin)

### 5. Tenant Decorators

**Location**: `src/common/decorators/tenant.decorator.ts`

Custom decorators for injecting tenant context:
- `@TenantId()`: Inject tenant ID into controller method
- `@Tenant()`: Inject full tenant object into controller method

### 6. Tenant Guard

**Location**: `src/common/guards/tenant.guard.ts`

Guard to ensure tenant context is present and active:
- Validates tenant exists
- Checks tenant status is ACTIVE
- Throws ForbiddenException if invalid

## Service Updates

### Authentication Service
- Updated `login()` to accept optional `tenantId` parameter
- Users are automatically assigned to tenant on login
- JWT tokens now include `tenantId` claim
- Default tenant is created automatically if missing

### Creators Service
- `findFeatured()`: Added optional `tenantId` filter
- `findAll()`: Added optional `tenantId` filter
- `register()`: Validates tenant limits before creating creators

### Categories Service
- `findAll()`: Added optional `tenantId` filter

### Tiers Service
- `bulkCreate()`: Automatically includes tenant ID from creator
- `upsertFromChain()`: Automatically includes tenant ID from creator

### Passes Service
- `mintPass()`: Automatically includes tenant ID from tier
- `upsertFromChain()`: Automatically includes tenant ID from tier

## Migration

**Location**: `prisma/migrations/20240716000000_add_multi_tenant_support/migration.sql`

The migration:
1. Creates the `tenants` table
2. Adds `tenant_id` columns to all tenant-aware tables
3. Creates foreign key constraints
4. Creates indexes for performance
5. Inserts default tenant
6. Migrates existing data to default tenant

## Seed Script

**Location**: `prisma/seed.ts`

Updated to:
1. Create default tenant
2. Create categories under default tenant

## Usage Examples

### Creating a New Tenant

```typescript
POST /tenants
{
  "name": "Acme Creator Platform",
  "slug": "acme",
  "logoUrl": "https://acme.com/logo.png",
  "primaryColor": "#FF0000",
  "secondaryColor": "#00FF00",
  "customDomain": "acme.starpass.io",
  "features": {
    "advanced_analytics": true,
    "custom_webhooks": true
  },
  "feeBps": 500,
  "maxCreators": 500,
  "maxPassesPerCreator": 50,
  "adminEmail": "admin@acme.com",
  "supportEmail": "support@acme.com"
}
```

### Accessing Tenant-Specific Data

```typescript
// Using custom domain
GET https://acme.starpass.io/v1/creators

// Using header
GET https://api.starpass.io/v1/creators
Headers:
  X-Tenant-Slug: acme

// Using controller decorator
@Get()
findAll(@TenantId() tenantId: string) {
  return this.creatorsService.findAll(1, 20, undefined, tenantId);
}
```

### Getting Frontend Configuration

```typescript
GET /tenants/config/acme

Response:
{
  "id": "tenant-uuid",
  "name": "Acme Creator Platform",
  "slug": "acme",
  "branding": {
    "logoUrl": "https://acme.com/logo.png",
    "primaryColor": "#FF0000",
    "secondaryColor": "#00FF00"
  },
  "features": {
    "advanced_analytics": true,
    "custom_webhooks": true
  }
}
```

## Feature Flags

Tenants can have custom feature flags configured in the `features` JSON field:

```typescript
{
  "advanced_analytics": true,
  "custom_webhooks": true,
  "bulk_purchases": false,
  "content_scheduling": true
}
```

Check feature availability in services:

```typescript
const enabled = await this.tenantsService.isFeatureEnabled(tenantId, 'advanced_analytics');
```

## Tenant Limits

Each tenant can have custom limits:
- `maxCreators`: Maximum number of creators
- `maxPassesPerCreator`: Maximum passes per creator
- `feeBps`: Platform fee in basis points

These limits are enforced during creator registration and pass creation.

## Security Considerations

1. **Data Isolation**: All queries automatically filter by tenant ID
2. **Tenant Context**: Middleware ensures tenant context is always present
3. **Status Checks**: Suspended tenants cannot access the system
4. **Cross-Tenant Access**: Prevented by foreign key constraints and query filters

## Deployment Steps

1. Run the migration:
   ```bash
   npx prisma migrate dev --name add_multi_tenant_support
   ```

2. Run the seed script:
   ```bash
   npx prisma db seed
   ```

3. Regenerate Prisma client:
   ```bash
   npx prisma generate
   ```

4. Update environment variables if needed (no new variables required)

5. Restart the application

## Testing

Test the multi-tenant functionality:

1. Create a test tenant via API
2. Access endpoints with different tenant contexts
3. Verify data isolation between tenants
4. Test custom domain routing
5. Verify feature flags work correctly

## Future Enhancements

Potential improvements:
- Tenant-specific rate limiting
- Per-tenant API key management
- Tenant audit logs
- Multi-language support per tenant
- Custom email templates per tenant
- Tenant-specific webhooks configuration

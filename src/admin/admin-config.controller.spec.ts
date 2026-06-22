import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { AdminConfigController } from './admin-config.controller';
import { AdminConfigService } from './admin-config.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Reflector } from '@nestjs/core';

describe('AdminConfigController', () => {
  let controller: AdminConfigController;
  let service: AdminConfigService;

  const mockAdminConfigService = {
    getFeeConfig: jest.fn(),
    updateFee: jest.fn(),
  };

  // Mock admin request
  const adminReq = { user: { sub: 'admin-uuid', address: 'GB_ADMIN', role: 'ADMIN' } };
  // Mock fan request (non-admin)
  const fanReq = { user: { sub: 'fan-uuid', address: 'GB_FAN', role: 'FAN' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminConfigController],
      providers: [
        { provide: AdminConfigService, useValue: mockAdminConfigService },
        Reflector,
      ],
    })
      // Override guards so we can test controller logic in isolation
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<AdminConfigController>(AdminConfigController);
    service = module.get<AdminConfigService>(AdminConfigService);

    jest.clearAllMocks();
  });

  describe('GET /admin/config/fee', () => {
    it('should return the current fee config', async () => {
      const mockConfig = { id: 'singleton', feeBps: 250, updatedAt: new Date(), updatedBy: null };
      mockAdminConfigService.getFeeConfig.mockResolvedValue(mockConfig);

      const result = await controller.getFee();

      expect(service.getFeeConfig).toHaveBeenCalled();
      expect(result).toEqual(mockConfig);
    });
  });

  describe('PATCH /admin/config/fee', () => {
    it('should update the fee and return the new config', async () => {
      const dto = { feeBps: 500 };
      const mockConfig = { id: 'singleton', feeBps: 500, updatedAt: new Date(), updatedBy: 'GB_ADMIN' };
      mockAdminConfigService.updateFee.mockResolvedValue(mockConfig);

      const result = await controller.updateFee(dto, adminReq);

      expect(service.updateFee).toHaveBeenCalledWith(dto, 'GB_ADMIN');
      expect(result).toEqual(mockConfig);
    });

    it('should accept fee of 0 bps (free)', async () => {
      const dto = { feeBps: 0 };
      const mockConfig = { id: 'singleton', feeBps: 0, updatedAt: new Date(), updatedBy: 'GB_ADMIN' };
      mockAdminConfigService.updateFee.mockResolvedValue(mockConfig);

      const result = await controller.updateFee(dto, adminReq);

      expect(result.feeBps).toBe(0);
    });

    it('should accept fee of 1000 bps (10%)', async () => {
      const dto = { feeBps: 1000 };
      const mockConfig = { id: 'singleton', feeBps: 1000, updatedAt: new Date(), updatedBy: 'GB_ADMIN' };
      mockAdminConfigService.updateFee.mockResolvedValue(mockConfig);

      const result = await controller.updateFee(dto, adminReq);

      expect(result.feeBps).toBe(1000);
    });
  });

  describe('RolesGuard — admin-only access', () => {
    let guardedModule: TestingModule;

    beforeEach(async () => {
      guardedModule = await Test.createTestingModule({
        controllers: [AdminConfigController],
        providers: [
          { provide: AdminConfigService, useValue: mockAdminConfigService },
          Reflector,
        ],
      })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        // Use the real RolesGuard backed by Reflector
        .compile();
    });

    it('should throw ForbiddenException for non-admin users', () => {
      const rolesGuard = new RolesGuard(guardedModule.get(Reflector));

      // Build a mock execution context with a FAN role
      const mockContext: any = {
        switchToHttp: () => ({ getRequest: () => fanReq }),
        getHandler: () => AdminConfigController.prototype.updateFee,
        getClass: () => AdminConfigController,
      };

      expect(() => rolesGuard.canActivate(mockContext)).toThrow(ForbiddenException);
    });

    it('should allow ADMIN users through', () => {
      const rolesGuard = new RolesGuard(guardedModule.get(Reflector));

      const mockContext: any = {
        switchToHttp: () => ({ getRequest: () => adminReq }),
        getHandler: () => AdminConfigController.prototype.updateFee,
        getClass: () => AdminConfigController,
      };

      expect(rolesGuard.canActivate(mockContext)).toBe(true);
    });
  });
});

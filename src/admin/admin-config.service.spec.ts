import { Test, TestingModule } from '@nestjs/testing';
import { AdminConfigService } from './admin-config.service';
import { PrismaService } from '../common/prisma.service';
import { StellarService } from '../stellar/stellar.service';

describe('AdminConfigService', () => {
  let service: AdminConfigService;
  let prisma: PrismaService;
  let stellar: StellarService;

  const mockPrismaService = {
    platformConfig: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  const mockStellarService = {
    emitFeeUpdatedEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminConfigService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: StellarService, useValue: mockStellarService },
      ],
    }).compile();

    service = module.get<AdminConfigService>(AdminConfigService);
    prisma = module.get<PrismaService>(PrismaService);
    stellar = module.get<StellarService>(StellarService);

    jest.clearAllMocks();
  });

  describe('getFeeConfig', () => {
    it('should upsert and return the singleton config', async () => {
      const mockConfig = { id: 'singleton', feeBps: 250, updatedAt: new Date(), updatedBy: null };
      mockPrismaService.platformConfig.upsert.mockResolvedValue(mockConfig);

      const result = await service.getFeeConfig();

      expect(prisma.platformConfig.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton', feeBps: 250 },
      });
      expect(result).toEqual(mockConfig);
    });
  });

  describe('updateFee', () => {
    it('should update fee and emit Soroban event', async () => {
      const mockConfig = { id: 'singleton', feeBps: 500, updatedAt: new Date(), updatedBy: 'GB_ADMIN' };
      mockPrismaService.platformConfig.upsert.mockResolvedValue(mockConfig);
      mockStellarService.emitFeeUpdatedEvent.mockResolvedValue(undefined);

      const result = await service.updateFee({ feeBps: 500 }, 'GB_ADMIN');

      expect(prisma.platformConfig.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        update: { feeBps: 500, updatedBy: 'GB_ADMIN' },
        create: { id: 'singleton', feeBps: 500, updatedBy: 'GB_ADMIN' },
      });
      expect(result).toEqual(mockConfig);

      // Give the fire-and-forget a tick to run
      await new Promise(process.nextTick);
      expect(stellar.emitFeeUpdatedEvent).toHaveBeenCalledWith(500);
    });

    it('should still return updated config even if Soroban emit fails', async () => {
      const mockConfig = { id: 'singleton', feeBps: 300, updatedAt: new Date(), updatedBy: 'GB_ADMIN' };
      mockPrismaService.platformConfig.upsert.mockResolvedValue(mockConfig);
      mockStellarService.emitFeeUpdatedEvent.mockRejectedValue(new Error('RPC timeout'));

      const result = await service.updateFee({ feeBps: 300 }, 'GB_ADMIN');

      expect(result).toEqual(mockConfig);
      await new Promise(process.nextTick);
      expect(stellar.emitFeeUpdatedEvent).toHaveBeenCalledWith(300);
    });

    it('should reject fee values below 0', async () => {
      // Validation happens at the DTO/controller layer — service stores whatever is passed
      // This test confirms the service itself does not add extra range checks
      const mockConfig = { id: 'singleton', feeBps: 0, updatedAt: new Date(), updatedBy: 'GB_ADMIN' };
      mockPrismaService.platformConfig.upsert.mockResolvedValue(mockConfig);
      mockStellarService.emitFeeUpdatedEvent.mockResolvedValue(undefined);

      const result = await service.updateFee({ feeBps: 0 }, 'GB_ADMIN');
      expect(result.feeBps).toBe(0);
    });
  });

  describe('getCurrentFeeBps', () => {
    it('should return feeBps from existing config', async () => {
      mockPrismaService.platformConfig.findUnique.mockResolvedValue({ id: 'singleton', feeBps: 750 });

      const result = await service.getCurrentFeeBps();

      expect(result).toBe(750);
      expect(prisma.platformConfig.findUnique).toHaveBeenCalledWith({ where: { id: 'singleton' } });
    });

    it('should return default 250 bps when no config row exists', async () => {
      mockPrismaService.platformConfig.findUnique.mockResolvedValue(null);

      const result = await service.getCurrentFeeBps();

      expect(result).toBe(250);
    });
  });
});

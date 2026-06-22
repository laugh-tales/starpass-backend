import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../common/prisma.service';
import { UpdateCreatorDto } from './dto/update-creator.dto';

describe('CreatorsService', () => {
  let service: CreatorsService;

  const mockPrismaService = {
    creator: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    pass: {
      findMany: jest.fn(),
    },
    payout: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatorsService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<CreatorsService>(CreatorsService);
    jest.clearAllMocks();
  });

  // ─── getRevenue ────────────────────────────────────────────────────────────

  describe('getRevenue', () => {
    it('should throw NotFoundException when creator is missing', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(null);
      await expect(service.getRevenue('user-123')).rejects.toThrow(NotFoundException);
    });

    it('should return revenue summary and top tiers sorted by revenue', async () => {
      const creator = { id: 'creator-1', totalEarned: '1200.50' };
      const passes = [
        { id: 'pass-1', tier: { id: 'tier-123', name: 'VIP Access', priceUsdc: '8500.00' } },
        { id: 'pass-2', tier: { id: 'tier-456', name: 'Early Bird', priceUsdc: '5000.00' } },
        { id: 'pass-3', tier: { id: 'tier-789', name: 'Base Tier', priceUsdc: '1949.50' } },
        { id: 'pass-4', tier: { id: 'tier-456', name: 'Early Bird', priceUsdc: '5000.00' } },
      ];

      mockPrismaService.creator.findUnique.mockResolvedValue(creator);
      mockPrismaService.pass.findMany.mockResolvedValue(passes);

      const result = await service.getRevenue('user-123');

      expect(result).toEqual({
        totalRevenue: 20449.5,
        totalPasses: 4,
        pendingBalance: 1200.5,
        topTiers: [
          { id: 'tier-456', name: 'Early Bird', revenue: 10000.0 },
          { id: 'tier-123', name: 'VIP Access', revenue: 8500.0 },
          { id: 'tier-789', name: 'Base Tier', revenue: 1949.5 },
        ],
      });

      expect(mockPrismaService.creator.findUnique).toHaveBeenCalledWith({ where: { userId: 'user-123' } });
      expect(mockPrismaService.pass.findMany).toHaveBeenCalledWith({
        where: { creatorId: creator.id },
        include: { tier: true },
      });
    });

    it('should return empty topTiers when there are no passes', async () => {
      const creator = { id: 'creator-1', totalEarned: '0' };
      mockPrismaService.creator.findUnique.mockResolvedValue(creator);
      mockPrismaService.pass.findMany.mockResolvedValue([]);

      const result = await service.getRevenue('user-123');

      expect(result).toEqual({
        totalRevenue: 0,
        totalPasses: 0,
        pendingBalance: 0,
        topTiers: [],
      });
    });
  });

  // ─── recordPayout ──────────────────────────────────────────────────────────

  describe('recordPayout', () => {
    const mockCreator = { id: 'creator-uuid', userId: 'user-uuid', stellarAddress: 'GB_CREATOR' };

    it('should create and return a payout record on successful withdrawal', async () => {
      const mockPayout = {
        id: 'payout-uuid',
        creatorId: 'creator-uuid',
        amount: '50.00',
        txHash: 'stellar-tx-abc',
        status: 'COMPLETED',
        createdAt: new Date(),
      };
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.create.mockResolvedValue(mockPayout);

      const result = await service.recordPayout('creator-uuid', '50.00', 'stellar-tx-abc');

      expect(prisma.payout.create).toHaveBeenCalledWith({
        data: {
          creatorId: 'creator-uuid',
          amount: '50.00',
          txHash: 'stellar-tx-abc',
          status: 'COMPLETED',
        },
      });
      expect(result).toEqual(mockPayout);
    });

    it('should record a payout with FAILED status', async () => {
      const mockPayout = {
        id: 'payout-uuid-2',
        creatorId: 'creator-uuid',
        amount: '25.00',
        txHash: null,
        status: 'FAILED',
        createdAt: new Date(),
      };
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.create.mockResolvedValue(mockPayout);

      const result = await service.recordPayout('creator-uuid', '25.00', null, 'FAILED');

      expect(prisma.payout.create).toHaveBeenCalledWith({
        data: {
          creatorId: 'creator-uuid',
          amount: '25.00',
          txHash: null,
          status: 'FAILED',
        },
      });
      expect(result.status).toBe('FAILED');
    });

    it('should throw NotFoundException when creator does not exist', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(null);

      await expect(
        service.recordPayout('nonexistent-id', '10.00'),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.payout.create).not.toHaveBeenCalled();
    });
  });

  // ─── getPayouts ────────────────────────────────────────────────────────────

  describe('getPayouts', () => {
    const mockCreator = { id: 'creator-uuid', userId: 'user-uuid' };
    const mockPayouts = [
      { id: 'p1', creatorId: 'creator-uuid', amount: '100.00', txHash: 'tx1', status: 'COMPLETED', createdAt: new Date() },
      { id: 'p2', creatorId: 'creator-uuid', amount: '50.00', txHash: 'tx2', status: 'COMPLETED', createdAt: new Date() },
    ];

    it('should return paginated payouts for the owning creator', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.findMany.mockResolvedValue(mockPayouts);
      mockPrismaService.payout.count.mockResolvedValue(2);

      const result = await service.getPayouts('user-uuid', 'user-uuid', { page: 1, limit: 20 });

      expect(prisma.payout.findMany).toHaveBeenCalledWith({
        where: { creatorId: 'creator-uuid' },
        orderBy: { createdAt: 'desc' },
        skip: 0,
        take: 20,
      });
      expect(prisma.payout.count).toHaveBeenCalledWith({ where: { creatorId: 'creator-uuid' } });
      expect(result).toEqual({ data: mockPayouts, total: 2, page: 1, limit: 20 });
    });

    it('should apply pagination correctly on page 2', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.findMany.mockResolvedValue([]);
      mockPrismaService.payout.count.mockResolvedValue(5);

      await service.getPayouts('user-uuid', 'user-uuid', { page: 2, limit: 2 });

      expect(prisma.payout.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 2, take: 2 }),
      );
    });

    it('should throw ForbiddenException when a different user requests the payouts', async () => {
      await expect(
        service.getPayouts('user-uuid', 'different-user-uuid', { page: 1, limit: 20 }),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.creator.findUnique).not.toHaveBeenCalled();
      expect(prisma.payout.findMany).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when creator record is not found', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(null);

      await expect(
        service.getPayouts('user-uuid', 'user-uuid', { page: 1, limit: 20 }),
      ).rejects.toThrow(NotFoundException);

      expect(prisma.payout.findMany).not.toHaveBeenCalled();
    });

    it('should return empty data array when creator has no payouts', async () => {
      mockPrismaService.creator.findUnique.mockResolvedValue(mockCreator);
      mockPrismaService.payout.findMany.mockResolvedValue([]);
      mockPrismaService.payout.count.mockResolvedValue(0);

      const result = await service.getPayouts('user-uuid', 'user-uuid', { page: 1, limit: 20 });

      expect(result).toEqual({ data: [], total: 0, page: 1, limit: 20 });
    });
  });
});

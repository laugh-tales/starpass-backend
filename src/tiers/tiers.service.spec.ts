import { Test, TestingModule } from '@nestjs/testing';
import { TiersService } from './tiers.service';
import { PrismaService } from '../common/prisma.service';

describe('TiersService', () => {
  let service: TiersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    creator: {
      findUnique: jest.fn(),
    },
    tier: {
      count: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TiersService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<TiersService>(TiersService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return paginated tiers with total count', async () => {
      const tiers = [{ id: 'tier-1', creatorId: 'creator-1', onChainId: 1 }];
      mockPrismaService.tier.findMany.mockResolvedValue(tiers);
      mockPrismaService.tier.count.mockResolvedValue(1);

      const result = await service.findAll(1, 20);

      expect(result).toEqual({ data: tiers, total: 1, page: 1, limit: 20 });
      expect(prisma.tier.findMany).toHaveBeenCalledWith({
        where: {},
        skip: 0,
        take: 20,
        orderBy: { onChainId: 'asc' },
      });
      expect(prisma.tier.count).toHaveBeenCalledWith({ where: {} });
    });

    it('should apply page, limit, and creatorId filter', async () => {
      mockPrismaService.tier.findMany.mockResolvedValue([]);
      mockPrismaService.tier.count.mockResolvedValue(0);

      const result = await service.findAll(3, 10, 'creator-123');

      expect(result).toEqual({ data: [], total: 0, page: 3, limit: 10 });
      expect(prisma.tier.findMany).toHaveBeenCalledWith({
        where: { creatorId: 'creator-123' },
        skip: 20,
        take: 10,
        orderBy: { onChainId: 'asc' },
      });
      expect(prisma.tier.count).toHaveBeenCalledWith({
        where: { creatorId: 'creator-123' },
      });
    });
  });
});

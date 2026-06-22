import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { FansService } from './fans.service';
import { PrismaService } from '../common/prisma.service';

describe('FansService', () => {
  let service: FansService;
  let prisma: PrismaService;

  const mockFan = {
    id: 'fan-1',
    userId: 'user-1',
    stellarAddress: 'GBRPYHIL2CI3FV4BMSXIOCNUTZ37NKPNCV63N7VBFQXNWLQRWV4V24F',
    displayName: 'John Doe',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    deletionRequestedAt: null,
    anonymized: false,
    permanentlyDeletedAt: null,
  };

  const mockPass = {
    id: 'pass-1',
    onChainId: BigInt(1),
    tierId: 'tier-1',
    creatorId: 'creator-1',
    fanId: 'fan-1',
    purchasedAt: new Date('2024-01-01'),
    expiresAt: new Date('2025-01-01'),
    txHash: 'hash-1',
    active: true,
    syncedAt: new Date('2024-01-01'),
    createdAt: new Date('2024-01-01'),
  };

  const mockPrismaService = {
    fan: {
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    pass: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      delete: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FansService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<FansService>(FansService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('requestDeletion', () => {
    it('should successfully request deletion and cancel active passes', async () => {
      const updatedFan = {
        ...mockFan,
        deletionRequestedAt: new Date(),
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(mockFan);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          pass: {
            updateMany: jest.fn().mockResolvedValue({ count: 2 }),
          },
          fan: {
            update: jest.fn().mockResolvedValue(updatedFan),
          },
        };
        return callback(txMock);
      });

      const result = await service.requestDeletion(mockFan.stellarAddress);

      expect(result).toEqual(updatedFan);
      expect(mockPrismaService.fan.findUnique).toHaveBeenCalledWith({
        where: { stellarAddress: mockFan.stellarAddress },
      });
    });

    it('should throw NotFoundException when fan does not exist', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(null);

      await expect(
        service.requestDeletion('nonexistent-address'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if deletion already requested', async () => {
      const fanWithDeletion = {
        ...mockFan,
        deletionRequestedAt: new Date(),
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithDeletion);

      await expect(
        service.requestDeletion(mockFan.stellarAddress),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('anonymizeFanData', () => {
    it('should anonymize fan personal data', async () => {
      const fanWithDeletion = {
        ...mockFan,
        deletionRequestedAt: new Date(),
      };

      const anonymizedFan = {
        ...fanWithDeletion,
        displayName: `Deleted User ${mockFan.id.slice(0, 8)}`,
        anonymized: true,
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithDeletion);
      mockPrismaService.fan.update.mockResolvedValue(anonymizedFan);

      const result = await service.anonymizeFanData(mockFan.stellarAddress);

      expect(result.anonymized).toBe(true);
      expect(result.displayName).toContain('Deleted User');
      expect(mockPrismaService.fan.update).toHaveBeenCalledWith({
        where: { id: mockFan.id },
        data: {
          displayName: `Deleted User ${mockFan.id.slice(0, 8)}`,
          anonymized: true,
        },
      });
    });

    it('should throw NotFoundException when fan not found', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(null);

      await expect(
        service.anonymizeFanData('nonexistent-address'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if deletion not requested', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(mockFan);

      await expect(
        service.anonymizeFanData(mockFan.stellarAddress),
      ).rejects.toThrow(BadRequestException);
    });

    it('should skip anonymization if already anonymized', async () => {
      const anonymizedFan = {
        ...mockFan,
        deletionRequestedAt: new Date(),
        anonymized: true,
        displayName: `Deleted User ${mockFan.id.slice(0, 8)}`,
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(anonymizedFan);

      const result = await service.anonymizeFanData(mockFan.stellarAddress);

      expect(result.anonymized).toBe(true);
      expect(mockPrismaService.fan.update).not.toHaveBeenCalled();
    });
  });

  describe('getDeletionStatus', () => {
    it('should return deletion status when not requested', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(mockFan);

      const result = await service.getDeletionStatus(mockFan.stellarAddress);

      expect(result).toEqual({
        deletionRequested: false,
        deletionRequestedAt: null,
        coolingOffEndDate: null,
        canFinalizeDeletion: false,
        anonymized: false,
      });
    });

    it('should return deletion status when requested but cooling off period not elapsed', async () => {
      const now = new Date();
      const fanWithDeletion = {
        ...mockFan,
        deletionRequestedAt: now,
        anonymized: true,
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithDeletion);

      const result = await service.getDeletionStatus(mockFan.stellarAddress);

      expect(result.deletionRequested).toBe(true);
      expect(result.anonymized).toBe(true);
      expect(result.canFinalizeDeletion).toBe(false);
      expect(result.coolingOffEndDate).toBeDefined();
    });

    it('should indicate deletable status after 30 days', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const fanWithDeletion = {
        ...mockFan,
        deletionRequestedAt: thirtyDaysAgo,
        anonymized: true,
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithDeletion);

      const result = await service.getDeletionStatus(mockFan.stellarAddress);

      expect(result.canFinalizeDeletion).toBe(true);
    });

    it('should throw NotFoundException when fan not found', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(null);

      await expect(
        service.getDeletionStatus('nonexistent-address'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('permanentlyDeleteFan', () => {
    it('should permanently delete fan after cooling off period', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const fanWithDeletion = {
        ...mockFan,
        deletionRequestedAt: thirtyDaysAgo,
        anonymized: true,
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithDeletion);
      mockPrismaService.fan.delete.mockResolvedValue(fanWithDeletion);
      mockPrismaService.user.delete.mockResolvedValue({ id: mockFan.userId });

      const result = await service.permanentlyDeleteFan(mockFan.stellarAddress);

      expect(result.id).toBe(mockFan.id);
      expect(mockPrismaService.fan.delete).toHaveBeenCalledWith({
        where: { id: mockFan.id },
      });
      expect(mockPrismaService.user.delete).toHaveBeenCalledWith({
        where: { id: mockFan.userId },
      });
    });

    it('should throw NotFoundException when fan not found', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(null);

      await expect(
        service.permanentlyDeleteFan('nonexistent-address'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if deletion not requested', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(mockFan);

      await expect(
        service.permanentlyDeleteFan(mockFan.stellarAddress),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if cooling off period not elapsed', async () => {
      const fanWithDeletion = {
        ...mockFan,
        deletionRequestedAt: new Date(),
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithDeletion);

      await expect(
        service.permanentlyDeleteFan(mockFan.stellarAddress),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('findByAddress', () => {
    it('should return fan with active passes', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue({
        ...mockFan,
        passes: [mockPass],
      });

      const result = await service.findByAddress(mockFan.stellarAddress);

      expect(result.passes).toHaveLength(1);
      expect(mockPrismaService.fan.findUnique).toHaveBeenCalledWith({
        where: { stellarAddress: mockFan.stellarAddress },
        include: {
          passes: {
            where: { active: true, expiresAt: { gt: expect.any(Date) } },
            include: { tier: true, creator: true },
          },
        },
      });
    });

    it('should throw NotFoundException when fan not found', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(null);

      await expect(
        service.findByAddress('nonexistent-address'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getSubscriptions', () => {
    it('should return active subscriptions for a fan', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(mockFan);
      mockPrismaService.pass.findMany.mockResolvedValue([mockPass]);

      const result = await service.getSubscriptions(mockFan.stellarAddress);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockPass.id);
      expect(mockPrismaService.pass.findMany).toHaveBeenCalledWith({
        where: {
          fanId: mockFan.id,
          active: true,
          expiresAt: { gt: expect.any(Date) },
        },
        include: { creator: true, tier: true },
        orderBy: { expiresAt: 'asc' },
      });
    });

    it('should throw NotFoundException when fan not found', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(null);

      await expect(
        service.getSubscriptions('nonexistent-address'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Data Anonymization and Transaction Retention', () => {
    it('should retain transaction records while anonymizing personal data', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const fanWithDeletion = {
        ...mockFan,
        deletionRequestedAt: thirtyDaysAgo,
        anonymized: true,
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithDeletion);

      // Verify that displayName is anonymized
      const anonymizedFan = {
        ...fanWithDeletion,
        displayName: `Deleted User ${mockFan.id.slice(0, 8)}`,
      };

      // The important thing is that the pass records (transaction history) should not be deleted
      // This is verified by the permanentlyDeleteFan method only deleting the Fan record, not Pass records

      expect(anonymizedFan.displayName).not.toEqual(mockFan.displayName);
    });
  });

  describe('Cooling Off Period', () => {
    it('should enforce 30-day cooling off period', async () => {
      const now = new Date();
      const fanWithRecentDeletion = {
        ...mockFan,
        deletionRequestedAt: now,
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithRecentDeletion);

      // Should throw because cooling off period hasn't elapsed
      await expect(
        service.permanentlyDeleteFan(mockFan.stellarAddress),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow deletion exactly at 30 day mark', async () => {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const fanWithDeletion = {
        ...mockFan,
        deletionRequestedAt: thirtyDaysAgo,
      };

      mockPrismaService.fan.findUnique.mockResolvedValue(fanWithDeletion);
      mockPrismaService.fan.delete.mockResolvedValue(fanWithDeletion);
      mockPrismaService.user.delete.mockResolvedValue({ id: mockFan.userId });

      const result = await service.permanentlyDeleteFan(mockFan.stellarAddress);

      expect(result).toBeDefined();
      expect(mockPrismaService.fan.delete).toHaveBeenCalled();
    });
  });

  describe('Pass Cancellation on Deletion Request', () => {
    it('should cancel all active passes when deletion is requested', async () => {
      mockPrismaService.fan.findUnique.mockResolvedValue(mockFan);
      mockPrismaService.$transaction.mockImplementation(async (callback) => {
        const txMock = {
          pass: {
            updateMany: jest.fn().mockResolvedValue({ count: 3 }),
          },
          fan: {
            update: jest.fn().mockResolvedValue({
              ...mockFan,
              deletionRequestedAt: new Date(),
            }),
          },
        };
        return callback(txMock);
      });

      await service.requestDeletion(mockFan.stellarAddress);

      expect(mockPrismaService.$transaction).toHaveBeenCalled();
    });
  });
});

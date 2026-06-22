import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { CreatorsController } from './creators.controller';
import { CreatorsService } from './creators.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RegisterWebhookDto } from '../webhooks/dto/register-webhook.dto';

describe('CreatorsController', () => {
  let controller: CreatorsController;
  let creatorsService: CreatorsService;
  let webhooksService: WebhooksService;

  const mockCreatorsService = {
    findAll: jest.fn(),
    getRevenue: jest.fn(),
    getPayouts: jest.fn(),
  };
  const mockWebhooksService = {
    register: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CreatorsController],
      providers: [
        { provide: CreatorsService, useValue: mockCreatorsService },
        { provide: WebhooksService, useValue: mockWebhooksService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<CreatorsController>(CreatorsController);
    creatorsService = module.get<CreatorsService>(CreatorsService);
    webhooksService = module.get<WebhooksService>(WebhooksService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  // ─── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    const mockResult = { data: [], total: 0, page: 1, limit: 10 };

    it('should use default page=1 and limit=10', async () => {
      mockCreatorsService.findAll.mockResolvedValue(mockResult);
      await controller.findAll(1, 10);
      expect(creatorsService.findAll).toHaveBeenCalledWith(1, 10);
    });

    it('should pass custom page and limit', async () => {
      mockCreatorsService.findAll.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });
      await controller.findAll(2, 5);
      expect(creatorsService.findAll).toHaveBeenCalledWith(2, 5);
    });

    it('should throw BadRequestException when limit exceeds 50', () => {
      expect(() => controller.findAll(1, 51)).toThrow(BadRequestException);
    });
  });

  // ─── registerWebhook ───────────────────────────────────────────────────────

  describe('registerWebhook', () => {
    it('should call WebhooksService.register', async () => {
      const creatorId = 'creator-123';
      const dto: RegisterWebhookDto = { url: 'https://example.com/webhook', secret: 'mysecret' };

      await controller.registerWebhook(creatorId, dto);

      expect(webhooksService.register).toHaveBeenCalledWith(creatorId, dto.url, dto.secret);
    });
  });

  // ─── getRevenue ────────────────────────────────────────────────────────────

  describe('getRevenue', () => {
    it('should return revenue analytics for the authenticated creator', async () => {
      const creatorId = 'user-123';
      const result = {
        totalRevenue: 15450.0,
        totalPasses: 342,
        pendingBalance: 1200.5,
        topTiers: [{ id: 'tier-123', name: 'VIP Access', revenue: 8500.0 }],
      };
      mockCreatorsService.getRevenue.mockResolvedValue(result);

      const response = await controller.getRevenue(creatorId, { user: { sub: creatorId } });

      expect(response).toEqual(result);
      expect(creatorsService.getRevenue).toHaveBeenCalledWith(creatorId);
    });

    it('should throw ForbiddenException when authenticated user does not match path id', () => {
      expect(() => controller.getRevenue('user-123', { user: { sub: 'user-456' } })).toThrow(
        ForbiddenException,
      );
    });
  });

  // ─── removeWebhook ─────────────────────────────────────────────────────────

  describe('removeWebhook', () => {
    it('should call WebhooksService.remove', async () => {
      const creatorId = 'creator-123';
      const webhookId = 'webhook-123';

      await controller.removeWebhook(creatorId, webhookId);

      expect(webhooksService.remove).toHaveBeenCalledWith(creatorId, webhookId);
    });
  });

  // ─── getPayouts ────────────────────────────────────────────────────────────

  describe('getPayouts', () => {
    const creatorId = 'user-uuid';
    const mockPayoutsResult = {
      data: [
        { id: 'p1', amount: '100.00', txHash: 'tx1', status: 'COMPLETED', createdAt: new Date() },
      ],
      total: 1,
      page: 1,
      limit: 20,
    };

    it('should return payout history for the owning creator', async () => {
      mockCreatorsService.getPayouts.mockResolvedValue(mockPayoutsResult);

      const result = await controller.getPayouts(
        creatorId,
        { page: 1, limit: 20 },
        { user: { sub: creatorId } },
      );

      expect(creatorsService.getPayouts).toHaveBeenCalledWith(
        creatorId,
        creatorId,
        { page: 1, limit: 20 },
      );
      expect(result).toEqual(mockPayoutsResult);
    });

    it('should propagate ForbiddenException when user does not own the creator profile', async () => {
      mockCreatorsService.getPayouts.mockRejectedValue(
        new ForbiddenException('You are not authorized to access this creator payout history'),
      );

      await expect(
        controller.getPayouts(creatorId, { page: 1, limit: 20 }, { user: { sub: 'other-user' } }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should propagate NotFoundException when creator does not exist', async () => {
      mockCreatorsService.getPayouts.mockRejectedValue(new NotFoundException('Creator not found'));

      await expect(
        controller.getPayouts(creatorId, { page: 1, limit: 20 }, { user: { sub: creatorId } }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use default pagination when no query params provided', async () => {
      mockCreatorsService.getPayouts.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });

      await controller.getPayouts(creatorId, {}, { user: { sub: creatorId } });

      expect(creatorsService.getPayouts).toHaveBeenCalledWith(creatorId, creatorId, {});
    });
  });
});

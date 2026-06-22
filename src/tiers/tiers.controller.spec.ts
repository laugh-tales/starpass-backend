import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TiersController } from './tiers.controller';
import { TiersService } from './tiers.service';

describe('TiersController', () => {
  let controller: TiersController;
  let service: TiersService;

  const mockTiersService = {
    findAll: jest.fn(),
    findByCreator: jest.fn(),
    findOne: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TiersController],
      providers: [
        {
          provide: TiersService,
          useValue: mockTiersService,
        },
      ],
    }).compile();

    controller = module.get<TiersController>(TiersController);
    service = module.get<TiersService>(TiersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should use default pagination values', async () => {
      const result = { data: [], total: 0, page: 1, limit: 20 };
      mockTiersService.findAll.mockResolvedValue(result);

      await expect(controller.findAll()).resolves.toEqual(result);

      expect(service.findAll).toHaveBeenCalledWith(1, 20, undefined);
    });

    it('should pass custom pagination and creator filter', async () => {
      const result = { data: [], total: 0, page: 2, limit: 10 };
      mockTiersService.findAll.mockResolvedValue(result);

      await expect(controller.findAll('2', '10', 'creator-123')).resolves.toEqual(result);

      expect(service.findAll).toHaveBeenCalledWith(2, 10, 'creator-123');
    });

    it('should throw BadRequestException when limit exceeds 100', () => {
      expect(() => controller.findAll('1', '101')).toThrow(BadRequestException);
    });

    it('should throw BadRequestException for invalid pagination values', () => {
      expect(() => controller.findAll('0', '20')).toThrow(BadRequestException);
      expect(() => controller.findAll('1', '0')).toThrow(BadRequestException);
      expect(() => controller.findAll('abc', '20')).toThrow(BadRequestException);
    });
  });
});

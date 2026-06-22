import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { UpdateReportStatusDto } from './dto/update-report-status.dto';
import { ReportStatus, ReportTargetType } from '@prisma/client';

describe('ReportsController', () => {
  let controller: ReportsController;
  let reportsService: ReportsService;

  const mockReportsService = {
    submitReport: jest.fn(),
    findAll: jest.fn(),
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        {
          provide: ReportsService,
          useValue: mockReportsService,
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ReportsController>(ReportsController);
    reportsService = module.get<ReportsService>(ReportsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('submit', () => {
    it('should call ReportsService.submitReport', async () => {
      const req = { user: { sub: 'user-123' } };
      const dto: CreateReportDto = {
        targetType: ReportTargetType.CREATOR,
        targetId: 'creator-123',
        reason: 'Inappropriate content',
      };
      await controller.submit(req, dto);
      expect(reportsService.submitReport).toHaveBeenCalledWith('user-123', dto);
    });
  });

  describe('findAll', () => {
    const mockResult = { data: [], total: 0, page: 1, limit: 20 };

    it('should use default page=1 and limit=20', async () => {
      mockReportsService.findAll.mockResolvedValue(mockResult);
      await controller.findAll(1, 20);
      expect(reportsService.findAll).toHaveBeenCalledWith(1, 20);
    });

    it('should pass custom page and limit', async () => {
      mockReportsService.findAll.mockResolvedValue({ data: [], total: 0, page: 2, limit: 5 });
      await controller.findAll(2, 5);
      expect(reportsService.findAll).toHaveBeenCalledWith(2, 5);
    });

    it('should throw BadRequestException when limit exceeds 50', () => {
      expect(() => controller.findAll(1, 51)).toThrow(BadRequestException);
    });
  });

  describe('updateStatus', () => {
    it('should call ReportsService.updateStatus', async () => {
      const id = 'report-123';
      const dto: UpdateReportStatusDto = {
        status: ReportStatus.RESOLVED,
      };
      await controller.updateStatus(id, dto);
      expect(reportsService.updateStatus).toHaveBeenCalledWith(id, dto.status);
    });
  });
});

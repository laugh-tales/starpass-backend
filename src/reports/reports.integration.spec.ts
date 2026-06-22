import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ReportsModule } from './reports.module';
import { ReportsService } from './reports.service';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { AdminGuard } from '../common/guards/admin.guard';
import { ReportStatus, ReportTargetType } from '@prisma/client';

describe('Reports Integration', () => {
  let app: INestApplication;

  const mockReports = [
    {
      id: 'report-1',
      reporterId: 'user-1',
      targetType: ReportTargetType.CREATOR,
      targetId: 'creator-1',
      reason: 'Inappropriate content',
      status: ReportStatus.PENDING,
      createdAt: new Date(),
      updatedAt: new Date(),
      reporter: { id: 'user-1', role: 'FAN' },
    },
    {
      id: 'report-2',
      reporterId: 'user-2',
      targetType: ReportTargetType.TIER,
      targetId: 'tier-1',
      reason: 'Misleading description',
      status: ReportStatus.RESOLVED,
      createdAt: new Date(),
      updatedAt: new Date(),
      reporter: { id: 'user-2', role: 'FAN' },
    },
  ];

  const mockReportsService = {
    submitReport: jest.fn().mockResolvedValue(mockReports[0]),
    findAll: jest.fn().mockResolvedValue({
      data: mockReports,
      total: mockReports.length,
      page: 1,
      limit: 20,
    }),
    updateStatus: jest.fn().mockResolvedValue({ ...mockReports[0], status: ReportStatus.DISMISSED }),
  };

  const mockReqUser = { sub: 'user-123', address: 'G...', role: 'FAN' };
  const mockAdminUser = { sub: 'admin-123', address: 'G...', role: 'ADMIN' };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ReportsModule],
    })
      .overrideProvider(ReportsService)
      .useValue(mockReportsService)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockReqUser;
          return true;
        },
      })
      .overrideGuard(AdminGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = mockAdminUser;
          return true;
        },
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      })
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /reports', () => {
    it('should submit a report', async () => {
      const res = await request(app.getHttpServer())
        .post('/reports')
        .send({
          targetType: ReportTargetType.CREATOR,
          targetId: 'creator-1',
          reason: 'Inappropriate content',
        })
        .expect(201);

      expect(mockReportsService.submitReport).toHaveBeenCalled();
      expect(res.body).toHaveProperty('id');
    });
  });

  describe('GET /admin/reports', () => {
    it('should return paginated reports', async () => {
      const res = await request(app.getHttpServer())
        .get('/admin/reports')
        .expect(200);

      expect(res.body).toEqual({
        data: expect.any(Array),
        total: 2,
        page: 1,
        limit: 20,
      });
      expect(mockReportsService.findAll).toHaveBeenCalledWith(1, 20);
    });
  });

  describe('PATCH /admin/reports/:id', () => {
    it('should update report status', async () => {
      const res = await request(app.getHttpServer())
        .patch('/admin/reports/report-1')
        .send({
          status: ReportStatus.DISMISSED,
        })
        .expect(200);

      expect(mockReportsService.updateStatus).toHaveBeenCalledWith('report-1', ReportStatus.DISMISSED);
      expect(res.body.status).toEqual(ReportStatus.DISMISSED);
    });
  });
});

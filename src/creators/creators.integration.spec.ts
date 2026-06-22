import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { CreatorsModule } from './creators.module';
import { CreatorsService } from './creators.service';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PrismaService } from '../common/prisma.service';

describe('Creators GET /creators/:id/earnings-history Integration', () => {
  let app: INestApplication;

  const mockEarningsResult = {
    data: [
      {
        id: 'er-1',
        creatorId: 'creator-1',
        fanId: 'fan-1',
        tierId: 'tier-1',
        amount: '10.00',
        fee: '0',
        netAmount: '10.00',
        createdAt: '2024-06-01T00:00:00.000Z',
        fan: { id: 'fan-1', stellarAddress: 'GB_FAN1' },
        tier: { id: 'tier-1', name: 'Gold' },
      },
    ],
    total: 1,
    page: 1,
    limit: 20,
  };

  const mockCreatorsService = {
    getEarningsHistory: jest.fn().mockResolvedValue(mockEarningsResult),
  };

  const successJwtGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'user-123' };
      return true;
    },
  };

  const mismatchJwtGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'user-456' };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule],
    })
      .overrideProvider(CreatorsService)
      .useValue(mockCreatorsService)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideGuard(JwtAuthGuard)
      .useValue(successJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return paginated earnings history for the authenticated creator', async () => {
    await request(app.getHttpServer())
      .get('/creators/user-123/earnings-history')
      .expect(200)
      .expect(mockEarningsResult);

    expect(mockCreatorsService.getEarningsHistory).toHaveBeenCalled();
  });

  it('should return 403 when the authenticated user does not own the creator', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule],
    })
      .overrideProvider(CreatorsService)
      .useValue(mockCreatorsService)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideGuard(JwtAuthGuard)
      .useValue(mismatchJwtGuard)
      .compile();

    const localApp = moduleFixture.createNestApplication();
    await localApp.init();

    await request(localApp.getHttpServer())
      .get('/creators/user-123/earnings-history')
      .expect(403);

    await localApp.close();
  });

  it('should pass date range query params to the service', async () => {
    await request(app.getHttpServer())
      .get('/creators/user-123/earnings-history?from=2024-01-01&to=2024-06-30&page=2&limit=10')
      .expect(200);

    expect(mockCreatorsService.getEarningsHistory).toHaveBeenCalled();
  });
});

describe('Creators GET /creators/:id/revenue Integration', () => {
  let app: INestApplication;

  const mockRevenueResult = {
    totalRevenue: 15450.0,
    totalPasses: 342,
    pendingBalance: 1200.5,
    topTiers: [
      { id: 'tier-123', name: 'VIP Access', revenue: 8500.0 },
      { id: 'tier-456', name: 'Early Bird', revenue: 5000.0 },
      { id: 'tier-789', name: 'Base Tier', revenue: 1949.5 },
    ],
  };

  const mockCreatorsService = {
    getRevenue: jest.fn().mockResolvedValue(mockRevenueResult),
  };
  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const mockPrismaService = {
    onModuleInit: jest.fn(),
    onModuleDestroy: jest.fn(),
  };

  const successJwtGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'user-123' };
      return true;
    },
  };

  const mismatchJwtGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'user-456' };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule],
    })
      .overrideProvider(CreatorsService)
      .useValue(mockCreatorsService)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue(successJwtGuard)
      .compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return creator revenue analytics when the authenticated user owns the creator', async () => {
    await request(app.getHttpServer())
      .get('/creators/user-123/revenue')
      .expect(200)
      .expect(mockRevenueResult);

    expect(mockCreatorsService.getRevenue).toHaveBeenCalledWith('user-123');
  });

  it('should return 403 when the authenticated user does not own the creator', async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule],
    })
      .overrideProvider(CreatorsService)
      .useValue(mockCreatorsService)
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .overrideGuard(JwtAuthGuard)
      .useValue(mismatchJwtGuard)
      .compile();

    const localApp = moduleFixture.createNestApplication();
    await localApp.init();

    await request(localApp.getHttpServer()).get('/creators/user-123/revenue').expect(403);

    await localApp.close();
  });
});

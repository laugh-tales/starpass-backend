import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { CreatorsModule } from '../creators/creators.module';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('Creator Analytics Endpoint', () => {
  let app: INestApplication;
  const mockPasses = [
    {
      id: 'pass-1',
      creatorId: 'creator-1',
      purchasedAt: new Date('2026-05-01T00:00:00Z'),
      expiresAt: new Date('2026-05-31T00:00:00Z'),
    },
    {
      id: 'pass-2',
      creatorId: 'creator-1',
      purchasedAt: new Date('2026-05-15T00:00:00Z'),
      expiresAt: new Date('2026-06-15T00:00:00Z'),
    },
    {
      id: 'pass-3',
      creatorId: 'creator-1',
      purchasedAt: new Date('2025-06-01T00:00:00Z'),
      expiresAt: new Date('2026-06-10T00:00:00Z'),
    },
  ];

  const mockCreator = { id: 'creator-1', userId: 'user-123' };

  const mockPrisma = {
    creator: { findUnique: jest.fn().mockResolvedValue(mockCreator) },
    pass: { findMany: jest.fn().mockResolvedValue(mockPasses) },
  };

  const authGuard = {
    canActivate: (context: any) => {
      const req = context.switchToHttp().getRequest();
      req.user = { sub: 'user-123' };
      return true;
    },
  };

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideGuard(JwtAuthGuard)
      .useValue(authGuard)
      .compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should compute analytics for 30d period and cache results', async () => {
    jest.useFakeTimers({ now: new Date('2026-06-15T12:00:00Z') });

    const res = await request(app.getHttpServer())
      .get('/creators/user-123/analytics?period=30d')
      .expect(200);

    expect(res.body).toMatchObject({
      subscriberGrowth: expect.any(Array),
      churnRate: expect.any(Number),
      avgPassDuration: expect.any(Number),
      retentionRate: expect.any(Number),
    });
    expect(mockPrisma.pass.findMany).toHaveBeenCalledTimes(1);

    const res2 = await request(app.getHttpServer())
      .get('/creators/user-123/analytics?period=30d')
      .expect(200);

    expect(res2.body).toEqual(res.body);
    expect(mockPrisma.pass.findMany).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  it('should use the correct date window for 90d period', async () => {
    const res = await request(app.getHttpServer())
      .get('/creators/user-123/analytics?period=90d')
      .expect(200);

    expect(mockPrisma.pass.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creatorId: 'creator-1',
          OR: expect.any(Array),
        }),
      }),
    );
    expect(res.body.subscriberGrowth.length).toBeGreaterThan(0);
  });

  it('should reject incorrect creator access with 403', async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [CreatorsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (context: any) => {
          const req = context.switchToHttp().getRequest();
          req.user = { sub: 'user-456' };
          return true;
        },
      })
      .compile();

    const localApp = moduleRef.createNestApplication();
    await localApp.init();

    await request(localApp.getHttpServer())
      .get('/creators/user-123/analytics?period=30d')
      .expect(403);

    await localApp.close();
  });
});

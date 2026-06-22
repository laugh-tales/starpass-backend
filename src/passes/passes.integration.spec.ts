import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { PassesModule } from './passes.module';
import { PassesService } from './passes.service';
import { PrismaService } from '../common/prisma.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

describe('Passes GET /passes Integration', () => {
  let app: INestApplication;

  const mockPasses = [
    {
      id: 'pass-1',
      onChainId: BigInt(1),
      tierId: '550e8400-e29b-41d4-a716-446655440000',
      creatorId: 'creator-1',
      fanId: 'fan-1',
      fan: { stellarAddress: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA' },
      purchasedAt: new Date('2026-01-01T00:00:00Z'),
      expiresAt: new Date('2026-12-31T23:59:59Z'),
      active: true,
      syncedAt: new Date(),
      createdAt: new Date(),
    },
    {
      id: 'pass-2',
      onChainId: BigInt(2),
      tierId: '6ba7b810-9dad-41d1-80b4-00c04fd430c8',
      creatorId: 'creator-2',
      fanId: 'fan-2',
      fan: { stellarAddress: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB' },
      purchasedAt: new Date('2025-01-01T00:00:00Z'),
      expiresAt: new Date('2025-06-30T23:59:59Z'), // expired
      active: false,
      syncedAt: new Date(),
      createdAt: new Date(),
    },
  ];

  const mockPassesService = {
    findAll: jest.fn().mockImplementation((filters) => {
      const { fan, tier_id, active, expired, page = 1, limit = 20 } = filters;
      let filtered = [...mockPasses];

      if (fan) {
        filtered = filtered.filter(p => p.fan.stellarAddress === fan);
      }
      if (tier_id) {
        filtered = filtered.filter(p => p.tierId === tier_id);
      }
      if (active !== undefined) {
        filtered = filtered.filter(p => p.active === active);
      }
      if (expired !== undefined) {
        const now = new Date();
        filtered = filtered.filter(p => {
          const isExpired = new Date(p.expiresAt) <= now;
          return expired ? isExpired : !isExpired;
        });
      }

      const total = filtered.length;
      const data = filtered.slice((page - 1) * limit, page * limit);

      const serializedData = JSON.parse(
        JSON.stringify(data, (key, value) =>
          typeof value === 'bigint' ? value.toString() : value
        )
      );

      return Promise.resolve({
        data: serializedData,
        total,
        page,
        limit,
      });
    }),
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PassesModule],
    })
      .overrideProvider(PassesService)
      .useValue(mockPassesService)
      .overrideProvider(PrismaService)
      .useValue({})
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
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

  it('should return paginated passes with default filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/passes')
      .expect(200);

    expect(res.body).toEqual({
      data: expect.any(Array),
      total: 2,
      page: 1,
      limit: 20,
    });
    expect(mockPassesService.findAll).toHaveBeenCalledWith({
      page: 1,
      limit: 20,
    });
  });

  it('should filter by active status', async () => {
    const res = await request(app.getHttpServer())
      .get('/passes?active=true')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('pass-1');
    expect(mockPassesService.findAll).toHaveBeenCalledWith({
      active: true,
      page: 1,
      limit: 20,
    });
  });

  it('should filter by expired status', async () => {
    const res = await request(app.getHttpServer())
      .get('/passes?expired=true')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('pass-2');
    expect(mockPassesService.findAll).toHaveBeenCalledWith({
      expired: true,
      page: 1,
      limit: 20,
    });
  });

  it('should filter by tier_id', async () => {
    const res = await request(app.getHttpServer())
      .get('/passes?tier_id=550e8400-e29b-41d4-a716-446655440000')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('pass-1');
    expect(mockPassesService.findAll).toHaveBeenCalledWith({
      tier_id: '550e8400-e29b-41d4-a716-446655440000',
      page: 1,
      limit: 20,
    });
  });

  it('should filter by fan Stellar address', async () => {
    const res = await request(app.getHttpServer())
      .get('/passes?fan=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('pass-1');
    expect(mockPassesService.findAll).toHaveBeenCalledWith({
      fan: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      page: 1,
      limit: 20,
    });
  });

  it('should combine fan, tier_id, active, and expired filters', async () => {
    const res = await request(app.getHttpServer())
      .get('/passes?fan=GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA&tier_id=550e8400-e29b-41d4-a716-446655440000&active=true&expired=false')
      .expect(200);

    expect(res.body.total).toBe(1);
    expect(res.body.data[0].id).toBe('pass-1');
    expect(mockPassesService.findAll).toHaveBeenCalledWith({
      fan: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
      tier_id: '550e8400-e29b-41d4-a716-446655440000',
      active: true,
      expired: false,
      page: 1,
      limit: 20,
    });
  });

  it('should paginate passes with custom page and limit', async () => {
    const res = await request(app.getHttpServer())
      .get('/passes?page=2&limit=1')
      .expect(200);

    expect(res.body).toEqual({
      data: expect.any(Array),
      total: 2,
      page: 2,
      limit: 1,
    });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe('pass-2');
    expect(mockPassesService.findAll).toHaveBeenCalledWith({
      page: 2,
      limit: 1,
    });
  });

  it('should reject invalid fan value with 400', async () => {
    await request(app.getHttpServer())
      .get('/passes?fan=not-a-stellar-address')
      .expect(400);
  });

  it('should reject invalid tier_id value with 400', async () => {
    await request(app.getHttpServer())
      .get('/passes?tier_id=not-a-uuid')
      .expect(400);
  });

  it('should reject invalid active value with 400', async () => {
    await request(app.getHttpServer())
      .get('/passes?active=invalid')
      .expect(400);
  });

  it('should reject invalid expired value with 400', async () => {
    await request(app.getHttpServer())
      .get('/passes?expired=invalid')
      .expect(400);
  });

  it('should reject negative page with 400', async () => {
    await request(app.getHttpServer())
      .get('/passes?page=-1')
      .expect(400);
  });

  it('should reject too large limit with 400', async () => {
    await request(app.getHttpServer())
      .get('/passes?limit=100')
      .expect(400);
  });
});

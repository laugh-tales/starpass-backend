import { Controller, Get, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { createCorsOptions, isCorsOriginAllowed } from './cors.config';

@Controller('cors-test')
class CorsTestController {
  @Get()
  ping() {
    return { ok: true };
  }
}

describe('CORS configuration', () => {
  let app: INestApplication;

  afterEach(async () => {
    delete process.env.FRONTEND_URL;
    process.env.NODE_ENV = 'test';

    if (app) {
      await app.close();
    }
  });

  it('allows localhost:3000 in development', () => {
    expect(
      isCorsOriginAllowed('http://localhost:3000', 'development', undefined),
    ).toBe(true);
  });

  it('restricts production to FRONTEND_URL', () => {
    expect(
      isCorsOriginAllowed(
        'https://app.starpass.test',
        'production',
        'https://app.starpass.test',
      ),
    ).toBe(true);
    expect(
      isCorsOriginAllowed(
        'http://localhost:3000',
        'production',
        'https://app.starpass.test',
      ),
    ).toBe(false);
    expect(
      isCorsOriginAllowed(
        'https://evil.example',
        'production',
        'https://app.starpass.test',
      ),
    ).toBe(false);
  });

  it('sets CORS headers for the configured frontend origin', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.starpass.test';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [CorsTestController],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.enableCors(createCorsOptions());
    await app.init();

    const response = await request(app.getHttpServer())
      .get('/cors-test')
      .set('Origin', 'https://app.starpass.test')
      .expect(200);

    expect(response.headers['access-control-allow-origin']).toBe(
      'https://app.starpass.test',
    );
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });
});

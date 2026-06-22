import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import * as http from 'node:http';
import { AddressInfo } from 'node:net';
import * as StellarSdk from '@stellar/stellar-sdk';
import { DevController } from './dev.controller';
import { DevService } from './dev.service';

jest.setTimeout(15000);

describe('DevController', () => {
  let app: INestApplication;
  let baseUrl: string;
  let friendbotFetchMock: jest.Mock;
  const originalFetch = global.fetch;

  async function createApp(nodeEnv: string) {
    const moduleRef = await Test.createTestingModule({
      controllers: [DevController],
      providers: [
        DevService,
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) => {
              if (key === 'NODE_ENV') return nodeEnv;
              return undefined;
            },
          },
        },
      ],
    }).compile();

    const nestApp = moduleRef.createNestApplication();
    nestApp.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await nestApp.listen(0, '127.0.0.1');

    const address = nestApp.getHttpServer().address() as AddressInfo;
    return {
      app: nestApp,
      url: `http://127.0.0.1:${address.port}`,
    };
  }

  async function postJson(url: string, body: unknown) {
    return await new Promise<{ status: number; body: any }>((resolve, reject) => {
      const parsedUrl = new URL(url);
      const payload = JSON.stringify(body);
      const request = http.request(
        {
          hostname: parsedUrl.hostname,
          port: parsedUrl.port,
          path: parsedUrl.pathname,
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'content-length': Buffer.byteLength(payload),
          },
        },
        (response) => {
          let responseBody = '';
          response.setEncoding('utf8');
          response.on('data', (chunk) => {
            responseBody += chunk;
          });
          response.on('end', () => {
            resolve({
              status: response.statusCode ?? 0,
              body: responseBody ? JSON.parse(responseBody) : undefined,
            });
          });
        },
      );

      request.on('error', reject);
      request.write(payload);
      request.end();
    });
  }

  beforeEach(() => {
    friendbotFetchMock = jest.fn();
    global.fetch = friendbotFetchMock as typeof fetch;
  });

  afterEach(async () => {
    jest.resetAllMocks();
    global.fetch = originalFetch;
    if (app) {
      await app.close();
    }
    app = undefined;
    baseUrl = undefined;
  });

  it('funds a wallet in development mode', async () => {
    const testAddress = StellarSdk.Keypair.random().publicKey();
    friendbotFetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        hash: 'funding-hash',
        ledger: 12345,
        successful: true,
      }),
    });

    const createdApp = await createApp('development');
    app = createdApp.app;
    baseUrl = createdApp.url;

    const response = await postJson(`${baseUrl}/dev/fund-wallet`, {
      address: testAddress,
    });

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      hash: 'funding-hash',
      ledger: 12345,
      successful: true,
    });
    expect(friendbotFetchMock).toHaveBeenCalledWith(
      expect.objectContaining({
        href: `https://friendbot.stellar.org/?addr=${testAddress}`,
      }),
      { method: 'GET' },
    );
  });

  it('returns 404 in production mode', async () => {
    const testAddress = StellarSdk.Keypair.random().publicKey();

    const createdApp = await createApp('production');
    app = createdApp.app;
    baseUrl = createdApp.url;

    const response = await postJson(`${baseUrl}/dev/fund-wallet`, {
      address: testAddress,
    });

    expect(response.status).toBe(404);
    expect(friendbotFetchMock).not.toHaveBeenCalled();
  });
});

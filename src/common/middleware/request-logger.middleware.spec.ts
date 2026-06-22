import { RequestLoggerMiddleware } from './request-logger.middleware';
import { Request, Response, NextFunction } from 'express';
import { Logger } from '@nestjs/common';

describe('RequestLoggerMiddleware', () => {
  let middleware: RequestLoggerMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    middleware = new RequestLoggerMiddleware();
    mockRequest = {
      method: 'GET',
      originalUrl: '/creators',
    };
    
    const listeners: Record<string, () => void> = {};
    mockResponse = {
      statusCode: 200,
      on: jest.fn().mockImplementation((event: string, callback: () => void) => {
        listeners[event] = callback;
        return mockResponse;
      }),
    };

    mockNext = jest.fn();
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
    
    (mockResponse as any).triggerFinish = () => {
      if (listeners['finish']) {
        listeners['finish']();
      }
    };
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('should be defined', () => {
    expect(middleware).toBeDefined();
  });

  it('should call next()', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it('should log non-health requests on finish', () => {
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    (mockResponse as any).triggerFinish();

    expect(logSpy).toHaveBeenCalled();
    const logCall = logSpy.mock.calls[0][0];
    expect(logCall).toContain('GET');
    expect(logCall).toContain('/creators');
    expect(logCall).toContain('200');
    expect(logCall).toContain('ms');
  });

  it('should not log health requests', () => {
    mockRequest.originalUrl = '/health';
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    (mockResponse as any).triggerFinish();

    expect(logSpy).not.toHaveBeenCalled();
  });

  it('should not log deep health requests', () => {
    mockRequest.originalUrl = '/health/deep';
    middleware.use(mockRequest as Request, mockResponse as Response, mockNext);
    (mockResponse as any).triggerFinish();

    expect(logSpy).not.toHaveBeenCalled();
  });
});

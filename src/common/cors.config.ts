import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';

const LOCAL_DEVELOPMENT_ORIGIN = 'http://localhost:3000';

export function isCorsOriginAllowed(
  origin: string | undefined,
  nodeEnv = process.env.NODE_ENV,
  frontendUrl = process.env.FRONTEND_URL,
): boolean {
  if (!origin) {
    return true;
  }

  if (nodeEnv === 'production') {
    return Boolean(frontendUrl && origin === frontendUrl);
  }

  return [frontendUrl, LOCAL_DEVELOPMENT_ORIGIN].filter(Boolean).includes(origin);
}

export function createCorsOptions(): CorsOptions {
  return {
    credentials: true,
    origin(origin, callback) {
      if (isCorsOriginAllowed(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
  };
}

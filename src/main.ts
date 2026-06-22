import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { validateConfig } from './common/config.validation';
import { createCorsOptions } from './common/cors.config';

// Fail fast if required environment variables are missing
validateConfig();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // URI versioning — all routes prefixed with /v{n}/
  app.enableVersioning({ type: VersioningType.URI });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // CORS
  app.enableCors(createCorsOptions());

  // Swagger docs
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('StarPass API')
      .setDescription('Backend API for the StarPass creator membership platform on Stellar')
      .setVersion('1.0')
      .addServer('/v1', 'Version 1')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`StarPass API running on port ${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();

import 'reflect-metadata';
import './env.js'; // DEVE ser o primeiro: carrega o .env da raiz antes de tudo
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module.js';
import { RedisIoAdapter } from './realtime/redis-io.adapter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: false });

  app.use(helmet());
  app.use(cookieParser());

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';
  app.enableCors({ origin: webOrigin, credentials: true });

  // Socket.IO: usa Redis quando REDIS_URL está configurado (escala horizontal)
  const redisAdapter = new RedisIoAdapter(app);
  const usingRedis = await redisAdapter.connectToRedis();
  if (usingRedis) {
    app.useWebSocketAdapter(redisAdapter);
    // eslint-disable-next-line no-console
    console.log('[tabletop] Socket.IO usando adapter Redis (escala horizontal).');
  }

  // Validação global de DTOs: nenhum payload não-declarado chega aos services.
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  app.setGlobalPrefix('api');

  const port = Number(process.env.PORT ?? 3001);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[tabletop] API ouvindo em http://localhost:${port}/api`);
}

bootstrap();

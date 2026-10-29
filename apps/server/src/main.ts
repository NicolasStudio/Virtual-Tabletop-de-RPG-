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

  const webOrigin = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

  // Hardening de headers. CSP explícito: libera só o necessário (imagens do
  // próprio backend/data/blob e conexões ws para o Socket.IO), bloqueia o resto.
  // crossOriginResourcePolicy relaxado para o front (porta diferente) poder
  // carregar imagens servidas por /api/files.
  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          'img-src': ["'self'", 'data:', 'blob:', webOrigin],
          'connect-src': ["'self'", webOrigin, 'ws:', 'wss:'],
          'script-src': ["'self'"],
        },
      },
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  );
  app.use(cookieParser());

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

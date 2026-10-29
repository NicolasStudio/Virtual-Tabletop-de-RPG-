import { IoAdapter } from '@nestjs/platform-socket.io';
import type { INestApplicationContext } from '@nestjs/common';
import type { ServerOptions } from 'socket.io';

/**
 * Adapter do Socket.IO com suporte OPCIONAL a Redis para escala horizontal.
 * Só ativa o Redis quando REDIS_URL está definido E os pacotes estão instalados.
 * Sem Redis, funciona normalmente em instância única (desenvolvimento).
 */
export class RedisIoAdapter extends IoAdapter {
  private adapterConstructor?: (nsp: unknown) => unknown;

  constructor(app: INestApplicationContext) {
    super(app);
  }

  async connectToRedis(): Promise<boolean> {
    const url = process.env.REDIS_URL;
    if (!url) return false;
    try {
      // @ts-ignore — dependências OPCIONAIS de escala (instalar só p/ multi-instância)
      const { createAdapter } = await import('@socket.io/redis-adapter');
      // @ts-ignore
      const { createClient } = await import('redis');
      const pubClient = createClient({ url });
      const subClient = pubClient.duplicate();
      await Promise.all([pubClient.connect(), subClient.connect()]);
      this.adapterConstructor = createAdapter(pubClient, subClient) as never;
      return true;
    } catch {
      // pacotes não instalados ou Redis indisponível: segue em instância única
      return false;
    }
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const server = super.createIOServer(port, options);
    if (this.adapterConstructor) {
      (server as { adapter: (c: unknown) => void }).adapter(this.adapterConstructor);
    }
    return server;
  }
}

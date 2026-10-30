import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig(({ mode }) => {
  // .env da raiz do monorepo (o mesmo do servidor)
  const env = loadEnv(mode, fileURLToPath(new URL('../..', import.meta.url)), '');

  // O app e a API ficam num endereço só: o Vite repassa /api e /socket.io para o
  // servidor Nest. Assim basta publicar a porta do Vite (ex.: túnel do Cloudflare)
  // e o login pela Ficha funciona (o cookie de sessão é da mesma origem).
  const apiTarget = `http://localhost:${env.PORT || 3001}`;
  const proxy = {
    '/api': { target: apiTarget },
    '/socket.io': { target: apiTarget, ws: true },
  };

  // Endereços públicos aceitos além de localhost: túneis rápidos do Cloudflare
  // (*.trycloudflare.com) e os de TABLETOP_HOSTS (ex.: mesa.seudominio.com,outro.com)
  const allowedHosts = [
    '.trycloudflare.com',
    ...(env.TABLETOP_HOSTS ?? '')
      .split(',')
      .map((h) => h.trim())
      .filter(Boolean),
  ];

  return {
    plugins: [react()],
    // cors: false — quem decide o CORS é o servidor Nest (a Ficha só lê /api/health)
    server: { port: 5173, proxy, allowedHosts, cors: false },
    preview: { port: 4173, proxy, allowedHosts, cors: false },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            konva: ['konva', 'react-konva'],
            socket: ['socket.io-client'],
            'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          },
        },
      },
    },
  };
});

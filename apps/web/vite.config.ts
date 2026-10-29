import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    rollupOptions: {
      output: {
        // separa as libs pesadas em chunks próprios (cacheáveis e carregados
        // sob demanda), tirando-as do bundle de entrada
        manualChunks: {
          konva: ['konva', 'react-konva'],
          socket: ['socket.io-client'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});

// Carrega o .env da RAIZ do monorepo antes de qualquer outro import que precise
// de variáveis de ambiente (Prisma, JWT, etc.). Importar ESTE módulo primeiro
// garante, pela ordem de imports do main, que process.env esteja populado.
import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url)); // apps/server/src
// sobe até a raiz do monorepo (…/Tabletop)
const candidates = [
  resolve(here, '../../../.env'), // raiz do monorepo
  resolve(here, '../.env'), // apps/server/.env (fallback)
  resolve(process.cwd(), '.env'),
];

for (const path of candidates) {
  if (existsSync(path)) {
    config({ path });
    break;
  }
}

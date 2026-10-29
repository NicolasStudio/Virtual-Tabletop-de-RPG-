// Seed de demonstração: um GM, um jogador, uma campanha, uma cena e tokens.
// Usa apenas placeholders — nenhum asset protegido por direitos autorais.
import '../src/env.js'; // carrega o .env da raiz antes do PrismaClient
import { PrismaClient } from '@prisma/client';
import argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  const gmPass = await argon2.hash('senha-demo-gm');
  const playerPass = await argon2.hash('senha-demo-jogador');

  const gm = await prisma.user.upsert({
    where: { email: 'gm@tabletop.dev' },
    update: {},
    create: { email: 'gm@tabletop.dev', displayName: 'Mestre Demo', passwordHash: gmPass },
  });

  const player = await prisma.user.upsert({
    where: { email: 'jogador@tabletop.dev' },
    update: {},
    create: { email: 'jogador@tabletop.dev', displayName: 'Jogador Demo', passwordHash: playerPass },
  });

  // idempotente: remove uma campanha de demonstração anterior deste GM (cascata
  // apaga membros, cenas e tokens) para poder rodar o seed várias vezes.
  const existing = await prisma.campaign.findFirst({
    where: { ownerId: gm.id, name: 'Campanha de Demonstração' },
  });
  if (existing) {
    await prisma.campaign.delete({ where: { id: existing.id } });
  }

  const campaign = await prisma.campaign.create({
    data: {
      name: 'Campanha de Demonstração',
      description: 'Dados gerados pelo seed.',
      system: 'generic',
      ownerId: gm.id,
      members: {
        create: [
          { userId: gm.id, role: 'GM' },
          { userId: player.id, role: 'PLAYER' },
        ],
      },
    },
  });

  const scene = await prisma.scene.create({
    data: {
      campaignId: campaign.id,
      name: 'Taverna',
      gridType: 'SQUARE',
      gridSize: 70,
      width: 1920,
      height: 1080,
      tokens: {
        create: [
          { name: 'Herói', x: 140, y: 140, ownerUserId: player.id, stats: { hp: 30, maxHp: 30 } },
          { name: 'Goblin', x: 420, y: 280, stats: { hp: 7, maxHp: 7 } },
        ],
      },
    },
  });

  await prisma.campaign.update({
    where: { id: campaign.id },
    data: { activeSceneId: scene.id },
  });

  // eslint-disable-next-line no-console
  console.log('Seed concluído:', { gm: gm.email, player: player.email, campaign: campaign.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

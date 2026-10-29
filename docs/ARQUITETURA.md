# Tabletop VTT — Arquitetura

> Documento vivo. Atualizado por fase. Última revisão: Fase 0 (fundação/scaffolding).

## 1. Visão geral

Tabletop é um **Virtual Tabletop (VTT)** de RPG online: mestres e jogadores criam
campanhas, entram em sessões em tempo real, manipulam mapas, tokens, fichas e
combates com sincronização ao vivo. Projetado para ser **modular, seguro,
responsivo e evoluível em produção**.

Princípio central de segurança: **o servidor é a fonte da verdade**. O cliente
nunca calcula permissões, revela conteúdo secreto (fog of war, notas do mestre),
autoriza movimentos nem valida rolagens. Toda decisão sensível é feita e
reforçada no backend.

## 2. Topologia

```
┌─────────────┐   HTTPS/REST    ┌──────────────┐   TCP     ┌────────────┐
│  Web (SPA)  │ ───────────────▶│  API (Nest)  │ ─────────▶│ PostgreSQL │
│ React+Vite  │                 │              │  Prisma   └────────────┘
│  Zustand    │   WebSocket     │  Socket.IO   │
│  Konva      │ ◀──────────────▶│   Gateway    │ ─────────▶ Redis (opcional,
└─────────────┘                 └──────┬───────┘            adapter p/ escala)
                                       │
                                       ▼
                              Armazenamento de arquivos
                              (S3-compatível; local em dev)
```

- **Separação clara**: frontend, backend (REST), eventos em tempo real
  (Socket.IO), banco (Postgres), arquivos (S3-compatível). Redis é opcional e
  entra apenas como adapter do Socket.IO para escala horizontal.

## 3. Stack e justificativas

| Camada | Escolha | Justificativa |
|---|---|---|
| Monorepo | **npm workspaces** | pnpm não disponível no host; workspaces é nativo do npm 11, sem ferramenta extra. |
| Frontend | React + TypeScript + Vite | Pedido. Vite = DX e build rápidos. |
| Estado | Zustand | Pedido. Leve, sem boilerplate, bom para estado de cena/sessão. |
| Mapa/Canvas | **Konva** (react-konva) | Pedido. Camadas, hit-detection, transform de tokens e grid performático. |
| Backend | NestJS + TypeScript | Pedido. DI, módulos, guards de autorização, gateways Socket.IO integrados. |
| ORM/DB | Prisma + PostgreSQL | Pedido. Migrações versionadas, tipos gerados, JSON para fichas flexíveis. |
| Tempo real | Socket.IO | Pedido. Salas (rooms) por campanha/cena, reconexão, ack. |
| Arquivos | S3-compatível | Pedido. Driver configurável; adapter local em dev. |
| Escala | Redis (opcional) | Pedido. `@socket.io/redis-adapter` para múltiplas instâncias. |
| Contratos | `packages/shared` | Fonte única de tipos e nomes de eventos entre web e server. |

## 4. Autenticação e sessão

- Senhas com **argon2** (ou bcrypt como fallback).
- **Access token** JWT curto (~15 min) no header `Authorization`.
- **Refresh token** opaco em **cookie httpOnly + SameSite + Secure** (em prod),
  rotacionado a cada refresh; revogável no servidor.
- Recuperação de senha via token de uso único com expiração.
- Rate limiting nas rotas de auth.

## 5. Autorização (modelo de permissões)

Autorização em três níveis, sempre no servidor:

1. **Usuário** — dono da conta.
2. **Membership de campanha** — papel: `GM` | `PLAYER` | `SPECTATOR`.
3. **Propriedade de objeto** — ex.: um token pertence a um personagem/jogador;
   só o dono ou o GM o move; notas privadas do GM nunca saem do servidor para o
   cliente do jogador.

Guards NestJS: `JwtAuthGuard` → `CampaignRoleGuard` → checagem de propriedade no
service antes de cada mutação ou emissão de evento.

## 6. Modelo de dados (resumo)

Ver `apps/server/prisma/schema.prisma`. Entidades principais:

- `User`, `RefreshToken`, `PasswordResetToken`
- `Campaign`, `CampaignMember`, `InviteCode`
- `Scene`, `Asset`
- `Token`
- `Character` (ficha como JSON tipado em `packages/shared` — permite múltiplos
  sistemas de RPG sem acoplar a app a um conjunto de regras)
- `DiceRoll`
- `ChatMessage`
- `CombatEncounter`, `CombatCombatant`
- `FogRegion` (regiões reveladas/ocultas por cena)
- `BestiaryEntry` (compêndio: criaturas, itens, magias)
- `AuditLog`

## 7. Contrato de eventos em tempo real

Nomes e payloads em `packages/shared/src/events.ts`. Regra: todo evento que
muda estado passa pelo servidor, que valida, persiste e re-emite para a sala
(`campaign:{id}` / `scene:{id}`). O cliente **nunca** confia em evento de outro
cliente; só no que o servidor re-emite.

## 8. Fases de implementação

Ver `docs/TASKS.md` — lista de tarefas persistente, retomável entre sessões.

## 9. Limitações atuais

Preenchido ao fim de cada fase. Na Fase 0 nada roda ainda (só scaffolding).

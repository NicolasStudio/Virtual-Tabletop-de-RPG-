# Manual Técnico — Tabletop VTT

> Virtual Tabletop (VTT) de RPG: mestres e jogadores criam campanhas, entram em
> sessões online e manipulam mapas, tokens, dados e combate com sincronização em
> tempo real. O servidor é a autoridade — visibilidade, permissões e resultados
> são decididos no backend, nunca no cliente.

## 1. Arquitetura

Monorepo **npm workspaces** com três pacotes:

```
Tabletop/
├─ apps/
│  ├─ server/   NestJS (API REST + WebSocket) — autoridade do jogo
│  └─ web/      React + Vite — cliente (SPA)
└─ packages/
   └─ shared/   Tipos de domínio + contratos de evento + motor de dados (puro)
```

- **`@tabletop/shared`** é a fonte única de verdade dos contratos (DTOs, nomes de
  eventos Socket.IO, motor de rolagem de dados). Não importa nada de runtime do
  servidor; é consumido por `server` e `web`.
- Regra de ouro: **todo evento que muda estado** é enviado ao servidor, validado,
  persistido e só então re-emitido. O cliente nunca confia em evento de outro
  cliente.

## 2. Stack

| Camada    | Tecnologia |
|-----------|------------|
| Backend   | NestJS, TypeScript (ESM/NodeNext), Prisma ORM |
| Runtime   | `node --watch --loader ts-node/esm` (dev) |
| Banco     | PostgreSQL 16 |
| Tempo real| Socket.IO (adapter Redis opcional p/ escala horizontal) |
| Auth      | JWT (access curto) + refresh token opaco rotativo, argon2 |
| Frontend  | React 18, Vite, Zustand (estado), react-konva (canvas do mapa) |
| Upload    | Storage local (`uploads/`) ou S3-compatível (driver configurável) |

> **Nota de runtime (ESM + NestJS):** o runner é `ts-node/esm`, não `tsx`. O
> `tsx`/esbuild não emite `design:paramtypes`, o que quebra a injeção de
> dependência do Nest. O `ts-node` usa o compilador TypeScript real, emitindo os
> metadados de decorator **e** resolvendo os imports `.js` do NodeNext.

## 3. Módulos do servidor

- **auth** — registro/login/refresh/recuperação de senha. Access JWT curto +
  refresh opaco rotativo com detecção de reuso; cookie httpOnly escopado em
  `/api/auth`; rate limiting.
- **campaigns** — CRUD de campanhas, convites por código, membros, papéis
  (GM/PLAYER/SPECTATOR). `CampaignRoleGuard` + `@RequireRole('GM')` leem o papel
  do banco.
- **scenes** — cenas, tokens, mapas-overlay, upload de assets e névoa de guerra.
  Filtra segredos por papel no servidor (tokens/overlays ocultos não vão ao
  cliente não-GM).
- **folders** — biblioteca de pastas da campanha (Cenas/Mapas/Tokens/Itens),
  com subpastas. CRUD só GM.
- **realtime** — `RealtimeGateway` Socket.IO: handshake JWT, salas por campanha,
  re-emissão autoritativa, presença, chat, broadcasts de cena/token/overlay/fog
  /combate.
- **combat** — iniciativa determinística, turnos/rodadas, dano/cura com clamp,
  condições. Mutações só GM, broadcast ao vivo.

## 4. Modelo de dados (Prisma — principais)

- **User, RefreshToken, PasswordResetToken** — contas e sessões.
- **Campaign, CampaignMember, InviteCode** — campanhas, membros, convites.
  `Campaign.activeSceneId` = cena que os jogadores acompanham.
- **AssetFolder** — pastas (enum `FolderKind`: SCENE/MAP/TOKEN/ITEM), subpastas
  via `parentId`.
- **Scene** — cenário (fundo), grade, `backgroundAssetId`, `folderId`.
- **MapOverlay** — mapa sobre a cena: imagem posicionável/redimensionável,
  `opacity`, `order`, `isLocked`, `isHidden`, `folderId`.
- **Token** — personagem/monstro/npc/item (`TokenKind`), posição/tamanho/rotação,
  `ownerUserId`, `isLocked`, `isHidden`, `imageUrl`, `folderId`.
- **SceneFog** — névoa de guerra por cena: `enabled`, `coverAll`,
  `revealedCells` (células), `brushReveal`/`brushHide` (traços de pincel).
- **Asset** — arquivos carregados (imagem/áudio/handout), `folderId`, `category`.
- **DiceRoll, ChatMessage** — rolagens (com visibilidade) e chat.
- **CombatEncounter, CombatCombatant** — combate.
- **Character, BestiaryEntry, AuditLog** — definidos no schema; não implementados
  neste projeto (fichas e bestiário vivem em outro projeto).

## 5. Fluxos-chave

### Autenticação
Login → access JWT (curto) em memória + refresh opaco em cookie httpOnly. O
cliente renova o access via `/api/auth/refresh` automaticamente em 401.

### Cena ativa (mestre dirige, jogador segue)
O GM abre/seleciona uma cena → `POST /scenes/:id/activate` grava
`Campaign.activeSceneId` e emite `SCENE_ACTIVATE`. O jogador não escolhe cena:
carrega a ativa e segue as trocas, criação/remoção de tokens e mapas ao vivo.

### Movimento de token
Preview otimista no cliente → `token:move` ao servidor → validação de
propriedade/lock → re-emissão autoritativa a todos. Jogador move qualquer token
não bloqueado; excluir é só GM; `isLocked` barra todos.

### Névoa de guerra (modelo por células + pincel)
Composição por máscara no canvas: base de névoa (quando `coverAll`), `brushHide`
adiciona névoa, `revealedCells` + `brushReveal` furam (`destination-out`). GM vê
translúcido; jogador vê opaco. Pincel enviado **em lote** ao soltar o mouse para
não saturar o rate limiter. Sincroniza via `FOG_UPDATE`.

### Dados
Fórmula enviada ao servidor; resultado calculado no backend (nunca no cliente);
visibilidade (pública/privada) decidida no servidor.

## 6. Segurança

- Autoridade no servidor para posição, visibilidade, resultados de dados e
  permissões.
- `helmet`, CORS restrito ao `WEB_ORIGIN` com credentials, `cookieParser`.
- `ValidationPipe` global com `whitelist` + `forbidNonWhitelisted` (bloqueia
  payloads não declarados → anti mass-assignment).
- Rate limiting global (ThrottlerModule) + limites específicos no auth.
- Upload com validação de mime/tamanho e proteção contra path traversal.
- Campos reservados ao GM (`isHidden`, `isLocked`, `ownerUserId`) são descartados
  quando a requisição vem de um jogador.

## 7. Performance

- **Code-splitting** (Vite `manualChunks`): `konva`, `socket`, `react-vendor` em
  chunks próprios; `ScenePage` em `React.lazy`. Bundle de entrada ~20 KB; o
  Konva (~292 KB) só carrega ao abrir o mapa.

## 8. Como rodar (dev)

```bash
# Pré-requisito: PostgreSQL 16 em localhost:5432, banco "tabletop".
# .env na RAIZ do monorepo com DATABASE_URL e segredos JWT.

npm install
npm run build -w @tabletop/shared        # compila os tipos compartilhados
npx prisma generate --schema apps/server/prisma/schema.prisma
npx prisma db push   --schema apps/server/prisma/schema.prisma   # sincroniza o schema
npm run seed -w @tabletop/server          # dados de demonstração

# dois terminais:
npm run dev:server    # API em http://localhost:3001/api
npm run dev:web       # SPA em http://localhost:5173
```

> O `.env` fica na **raiz** do monorepo; o servidor o carrega explicitamente em
> `apps/server/src/env.ts` (primeiro import), porque o processo roda em
> `apps/server` e o Prisma procuraria o `.env` no lugar errado.

## 9. Testes

Suíte em **vitest**. Cobertura atual (server + shared):

- `shared/dice` — motor de rolagem.
- `auth/token.service` — rotação/validação de refresh token.
- `campaigns/*` — serviço de campanhas e `CampaignRoleGuard`.
- `scenes/scenes.service` — CRUD e filtro de tokens ocultos por papel.
- `combat/combat.service` — iniciativa, turnos, dano/cura.
- `realtime/realtime.gateway` — integração socket (2 clientes).

```bash
npm run test -w @tabletop/server    # testes do backend
npm run test -w @tabletop/shared    # motor de dados
```

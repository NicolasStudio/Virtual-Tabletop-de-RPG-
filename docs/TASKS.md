# Tabletop VTT — Lista de Tarefas (retomável entre sessões)

Legenda: `[ ]` pendente · `[~]` em andamento · `[x]` concluído e validado ·
`[!]` bloqueado/depende de config externa.

Sempre que retomar o trabalho, leia este arquivo primeiro e continue do primeiro
item não concluído.

---

## Fase 0 — Fundação / scaffolding (SEM build pesado)
- [x] Criar pasta `Desktop/Tabletop` e estrutura de monorepo (apps/web, apps/server, packages/shared, docs)
- [x] `package.json` raiz com npm workspaces + `.gitignore`
- [x] `docs/ARQUITETURA.md`
- [x] `docs/TASKS.md` (este arquivo)
- [x] `apps/server/prisma/schema.prisma` (modelo de dados completo)
- [x] `packages/shared` — tipos, contratos REST e eventos Socket.IO
- [x] `docker-compose.yml` (Postgres + Redis opcional) + `.env.example`
- [x] `README.md` (instalação, execução, migrações, seed)
- [x] `apps/server` — package.json, tsconfig, NestJS bootstrap mínimo (health, Helmet, CORS, cookies, throttler, PrismaService) + seed
- [x] `apps/web` — package.json, tsconfig, Vite + React bootstrap (tema escuro medieval, health-check real)
- [x] Motor de dados puro (`packages/shared/src/dice.ts`) + teste vitest + **validado 12/12 via Node puro** (sem install, memória crítica)

> ⚠️ `npm install` (NestJS/Prisma/React/Vite/Konva/Socket.IO/Playwright) é pesado
> e NÃO deve rodar com o host em memória crítica. Fazer quando houver RAM, ou o
> usuário roda `npm install` localmente. Até lá, o código é escrito e revisado,
> mas build/testes ficam pendentes de instalação.

## Fase 1 — Fundação e autenticação
- [x] Prisma: User, RefreshToken, PasswordResetToken (já no schema; migração pendente de npm install)
- [x] Hash de senha (argon2), registro, login, logout, refresh rotativo
- [x] Recuperação de senha (token de uso único, 1h, devToken fora de prod)
- [x] Perfil e preferências (UsersController/Service)
- [x] Guards JwtAuth + rate limiting (ThrottlerGuard global + @Throttle nas rotas de auth)
- [x] Testes: TokenService.spec.ts (vitest) + validação de rotação **8/8 via Node puro**
- [x] Web: cadastro/login/esqueci/reset/perfil + store Zustand + client com refresh automático + rota protegida
- [x] **npm install (shared+server) OK**; shared compila + **vitest 12/12**; server **typecheck limpo** + **vitest 5/5** (TokenService); Prisma Client gerado; argon2 nativo OK
- [x] **Migração inicial gerada e versionada** (`migrations/00000000000000_init/migration.sql`: 17 tabelas, 3 enums, 20 FKs, 24 índices)
- [!] Aplicar a migração (`prisma migrate`) + seed + teste ponta a ponta: DEPENDE de um Postgres acessível (Docker não instalado, nada na 5432). Config externa documentada no README.
- [ ] `apps/web` npm install (adiado: RAM crítica; fazer sob demanda)

## Fase 2 — Campanhas, salas e permissões
- [x] Campaign, CampaignMember, InviteCode (schema já na migração inicial)
- [x] CRUD de campanha; convites por código (alfabeto legível, maxUses/expiração); papéis GM/PLAYER/SPECTATOR
- [x] CampaignRoleGuard (@RequireRole) + CurrentUser; lista de participantes; join idempotente; leave; dono protegido
- [x] Testes de autorização: CampaignRoleGuard 7/7 + CampaignsService.joinByCode 5/5 (nega não-membro, papel insuficiente, convite expirado/esgotado)
- [x] Web: dashboard (lista/criar/entrar por código) + página de campanha (participantes, convites GM, remover/sair)
- [x] VALIDADO: server typecheck limpo + vitest **17/17**; web typecheck limpo + **build Vite OK** (47 módulos)
- [!] Teste de integração REST real (negar acesso ponta a ponta) depende de Postgres aplicado — config externa no README

## Fase 3 — Mapas e tokens
- [x] Scene, Asset, Token (schema já na migração inicial)
- [x] StorageService configurável (local/S3 via @aws-sdk opcional), validação de mime/tamanho, anti path-traversal
- [x] REST cenas (CRUD GM) + tokens (criar/remover GM; mover com controle de propriedade) + upload de asset + servir local
- [x] Filtro de segredo no servidor: tokens ocultos removidos do payload para não-GM
- [x] Editor Konva: Stage com pan (arrasto do fundo) + zoom no cursor, GridLayer quadrada/hex, TokenShape arrastável/transformável (Transformer), snapping à grade
- [x] ScenePage: trocar cena, criar cena/token (GM), atualização otimista + reversão ao estado autoritativo em rejeição
- [x] VALIDADO: server typecheck limpo + vitest **24/24** (ScenesService 7: filtro de ocultos + propriedade); web typecheck limpo + **build Vite OK** (238 módulos, Konva)
- [!] Upload/persistência real ponta a ponta depende de Postgres aplicado
- Nota: sincronização ao vivo entre clientes é a Fase 4 (agora o save é REST otimista)

## Fase 4 — Sincronização em tempo real
- [x] RealtimeGateway Socket.IO: handshake autenticado por JWT, salas campaign:{id}, membership lida do banco
- [x] Contratos de evento compartilhados (shared); re-emissão AUTORITATIVA: token:move/update validados pelo ScenesService antes de re-emitir
- [x] Rolagem no servidor (motor do shared) com visibilidade PUBLIC/GM/PRIVATE decidida no servidor; chat persistido+re-emitido
- [x] Presença por sala; reconexão (cliente re-join + resync do estado via REST get)
- [x] Redis adapter OPCIONAL (REDIS_URL) para escala horizontal, sem quebrar instância única
- [x] Front: lib/socket + hook useRealtimeScene; ScenePage move via socket (preview otimista + confirmação autoritativa), indicador ao vivo + presença
- [x] VALIDADO: server typecheck limpo + vitest **26/26** incluindo **teste de integração socket real** (2 clientes: recusa sem token + re-emissão autoritativa de movimento); web typecheck limpo + build Vite OK
- [!] Teste multi-cliente ponta a ponta no navegador depende de Postgres aplicado
- Nota otimização (fase 8): bundle >500KB → code-splitting de Konva/socket.io

## Fase 5 — Fichas e dados
- [ ] Character (ficha JSON tipada, multi-sistema); PV/mana/defesa/inventário/condições — ADIADO a pedido do usuário
- [x] Motor de rolagem no servidor (d4..d100, mod, vantagem/desvantagem, fórmulas) — shared, 12/12 testes
- [x] Rolagem via socket dice:roll (resultado no servidor, visibilidade PUBLIC/GM/PRIVATE, histórico persistido) — gateway Fase 4
- [x] Front: DicePanel (botões d4-d100, fórmula livre, vantagem/desvantagem, visibilidade) + useDiceRolls (log ao vivo), integrado na ScenePage (layout mapa + painel lateral)
- [x] VALIDADO: web typecheck limpo + build Vite OK; backend de dados já coberto (motor 12/12 + integração socket Fase 4)
- Nota: fichas (Character) serão retomadas quando o usuário quiser

## Fase 6 — Combate e bestiário
- [x] CombatEncounter/Combatant: iniciativa (ordenação determinística), rodadas, turnos (advanceTurn), dano/cura com clamp 0..maxHp, condições
- [x] CombatService + Controller (mutações só GM via @RequireRole; leitura por membros) + broadcast ao vivo via gateway (COMBAT_UPDATE)
- [x] Front: CombatTracker (tracker de iniciativa, turno atual destacado, barra de HP, dano/cura, condições, add/remover, próximo turno, encerrar) em drawer ⚔ Combate; useCombat (ao vivo)
- [x] VALIDADO: server typecheck limpo + vitest **32/32** (+6 combate: sortByInitiative, advanceTurn, bordas); web typecheck limpo + build Vite OK (278 módulos)
- [ ] Bestiário/compêndio — ADIADO a pedido do usuário
- [!] Teste ao vivo no navegador do combate: pendente de validação manual pelo usuário

## Fase 7 — Ferramentas avançadas e conteúdo
- [ ] Fog of war autoritativo no servidor; revelação/ocultação pelo GM
- [ ] Desenho/medidas/régua/templates de área; notas, handouts, pistas
- [ ] Inventário e economia; áudio/ambientação por cena
- [ ] Múltiplas cenas, diário, objetivos, linha do tempo

## Fase 8 — Administração, segurança e otimização
- [ ] Admin: usuários, moderação, quotas, auditoria (AuditLog)
- [ ] Hardening: CSRF, XSS, injeção, rate limit global, headers de segurança
- [ ] Importação/exportação com validação e limites; otimização com muitas entidades

## Fase 9 — Testes completos e documentação
- [ ] E2E Playwright: cadastro → campanha → entrada → mapa → token → dado → combate → reconexão
- [ ] Acessibilidade, responsividade, concorrência, desempenho
- [ ] Lint, format, typecheck, CI
- [ ] Documentação final completa

---

- 2026-10-29: SETUP DO BANCO concluído. PostgreSQL 16 x64 nativo na 5432 (user postgres). .env com DATABASE_URL real. `prisma db push` criou as 17 tabelas (migrate deploy deu P3015 com a migração 0-timestamp; db push é o caminho de 1º setup). Seed OK: 2 users, 1 campanha, 2 membros, 1 cena, 2 tokens — tudo persistido e verificado.
- 2026-10-29: FIX de runtime do server. ts-node-dev (CommonJS) não resolvia imports '.js' → 'Cannot find module ./app.module.js'. CAUSA RAIZ: tsconfig commonjs/node incompatível com imports .js explícitos (afetaria dev E build). Corrigido: server tsconfig → module/moduleResolution NodeNext, package.json → "type":"module" + runner trocado de ts-node-dev para tsx (dev e seed). Validado: typecheck limpo, boot do Nest OK (todos os módulos carregam sem erro), vitest 26/26 intactos.

## Log de sessões
- 2026-10-29: Fase 0 CONCLUÍDA. [...] Motor de dados validado 12/12 via Node puro. `npm install` + build/migração adiados por memória CRÍTICA do host (~1.7GB).
- 2026-10-29: Fase 1 (AUTENTICAÇÃO) implementada. [...] TokenService 5/5. npm install shared+server OK, migração inicial gerada (17 tab/3 enum/20 FK/24 idx), Postgres pendente.
- 2026-10-29: Fase 2 (CAMPANHAS/SALAS/PERMISSÕES) implementada e validada. [...] server vitest 17/17; web build Vite OK.
- 2026-10-29: Fase 3 (MAPAS E TOKENS) implementada e validada. [...] server vitest 24/24; web build Vite OK (238 módulos).
- 2026-10-29: Fase 4 (TEMPO REAL — Socket.IO) implementada e validada. Backend: RealtimeGateway (handshake JWT, salas campaign:{id}, membership do banco, re-emissão autoritativa de token:move/update via ScenesService, rolagem no servidor com visibilidade PUBLIC/GM/PRIVATE, chat, presença), RedisIoAdapter opcional p/ escala. Frontend: lib/socket, hook useRealtimeScene, ScenePage com movimento ao vivo (preview otimista + confirmação autoritativa), indicador ao vivo + presença. VALIDADO: server typecheck limpo + vitest 26/26 incluindo TESTE DE INTEGRAÇÃO socket real com 2 clientes (recusa sem token + re-emissão autoritativa); web typecheck limpo + build Vite OK. Próximo: Fase 5 (fichas e dados).

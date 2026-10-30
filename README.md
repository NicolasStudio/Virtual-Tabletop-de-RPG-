# Tabletop VTT

Virtual Tabletop (VTT) de RPG online — mestres e jogadores criam campanhas,
entram em sessões em tempo real e manipulam mapas, tokens, fichas, dados e
combates com sincronização ao vivo.

> **Estado:** em construção por fases. Veja `docs/TASKS.md` para o que está
> pronto/validado e o que falta. Veja `docs/ARQUITETURA.md` para o desenho.

## Stack

- **Frontend:** React + TypeScript + Vite, Zustand, Konva (react-konva)
- **Backend:** NestJS + TypeScript, Socket.IO
- **Banco:** PostgreSQL + Prisma
- **Arquivos:** S3-compatível (driver local em dev)
- **Escala (opcional):** Redis como adapter do Socket.IO
- **Monorepo:** npm workspaces (`apps/web`, `apps/server`, `packages/shared`)

## Pré-requisitos

- Node.js **20+** (testado com v24)
- Docker + Docker Compose (para Postgres/Redis) — ou um Postgres próprio
- `npm` 10+

## Instalação

```bash
# na raiz do projeto
cp .env.example .env            # Windows: copy .env.example .env
#   edite .env e gere segredos JWT fortes

npm install                     # instala todos os workspaces
```

> ⚠️ A instalação baixa NestJS, Prisma, React, Vite, Konva, Socket.IO e
> (em dev) Playwright — é pesada. Rode em uma máquina com RAM livre.

## Subir o banco

```bash
docker compose up -d            # Postgres em localhost:5432
# escala opcional (Redis):  docker compose --profile scale up -d
```

## Migrações, geração do client e seed

A migração inicial já está versionada em
`apps/server/prisma/migrations/00000000000000_init/migration.sql`
(17 tabelas, 3 enums, 20 FKs, 24 índices). Para aplicá-la você precisa de um
**Postgres acessível** em `DATABASE_URL`.

```bash
# 1) suba um Postgres (Docker):
docker compose up -d
#    ...ou use um Postgres já instalado e ajuste DATABASE_URL no .env

# 2) aplique a migração e gere o client:
npm run prisma:generate
npm run prisma:migrate          # aplica a migração inicial
npm run seed                    # dados de demonstração
```

> Se não tiver Docker, instale o PostgreSQL 16 localmente e aponte
> `DATABASE_URL` para ele. O schema e a migração já estão validados; só falta um
> banco onde aplicá-los.

### Notas de setup (Windows, Postgres nativo)

- O `.env` fica na **raiz** do monorepo. Os comandos `npm run prisma:*` já são
  executados no workspace do server, mas se chamar o Prisma manualmente a partir
  de `apps/server`, exporte `DATABASE_URL` do `.env` da raiz antes (o Prisma
  procura o `.env` no diretório atual).
- No **primeiro setup** com banco vazio, `npx prisma db push` sincroniza o schema
  direto (mais simples que `migrate deploy`). Use `migrate deploy` em produção,
  onde o histórico de migrações importa.
- Usuário padrão da instalação EDB é `postgres` — o `DATABASE_URL` deve usá-lo
  (não o `tabletop` do exemplo), com a senha definida na instalação.

## Rodar em desenvolvimento

```bash
npm run build:shared            # compila @tabletop/shared uma vez
npm run dev:server              # API + Socket.IO em http://localhost:3001
npm run dev:web                 # SPA em http://localhost:5173
```

O app (5173) repassa `/api` e `/socket.io` para o servidor (3001): tudo fica
num endereço só. Abra sempre pelo endereço do app.

## Login pela Ficha Ordem Paranormal

O Tabletop não tem cadastro nem senha próprios: usa a conta da Ficha (Firebase).

1. Na Ficha, menu ☰ → **Tabletop** abre a página `tabletop.html` numa nova guia.
2. Ela consulta `/api/health`. Desligado → mostra "offline" e tenta de novo a
   cada 15 s (entra sozinha quando o mestre ligar). Ligado → envia o login do
   Firebase para `POST /api/auth/firebase`, que confere o token com as chaves
   públicas do Google e abre a sessão.
3. Na primeira vez cria a conta do Tabletop com o nome do cadastro da Ficha;
   o tema da Ficha (Clássico, Sangue, Morte, Conhecimento, Energia) vem junto.

Configuração (`.env`): `FIREBASE_PROJECT_ID` e `FICHA_ORIGINS` (ver
`.env.example`). O endereço do Tabletop fica na Ficha, em `Js/tabletopConfig.js`.

## Jogadores de fora (Cloudflare Tunnel)

Com o servidor e o app ligados, publique **só a porta do app**:

```bash
cloudflared tunnel --url http://localhost:5173
```

O endereço `https://….trycloudflare.com` gerado já é aceito pelo Vite. Para um
domínio próprio, coloque-o em `TABLETOP_HOSTS`. Depois, atualize
`Js/tabletopConfig.js` na Ficha com esse endereço. Com HTTPS, use
`COOKIE_SECURE=true` e segredos JWT fortes no `.env`.

## Testes

```bash
npm run test                    # unitários (shared, server)
# E2E (Playwright) — ver docs/TASKS.md (fase 9)
```

## Qualidade

```bash
npm run lint
npm run typecheck
```

## Estrutura

```
Tabletop/
├─ apps/
│  ├─ server/        # NestJS + Prisma + Socket.IO
│  └─ web/           # React + Vite + Zustand + Konva
├─ packages/
│  └─ shared/        # tipos, contratos de eventos, motor de dados (puro)
├─ docs/             # ARQUITETURA.md, TASKS.md
├─ docker-compose.yml
└─ .env.example
```

## Segurança (resumo)

O **servidor é a fonte da verdade**: permissões, fog of war, notas privadas e
validação de rolagens são decididas e reforçadas no backend. O cliente nunca
autoriza a si mesmo. Detalhes em `docs/ARQUITETURA.md`.

## Contribuição

Veja `docs/TASKS.md` para as fases. Convenções: TypeScript estrito, lint +
prettier, testes para regras/cálculos e para autorização. Não marque uma
funcionalidade como pronta só porque a tela existe — ela precisa funcionar e
persistir.

## Licença / conteúdo

Não inclua assets (imagens, mapas, regras) protegidos por direitos autorais sem
autorização. O seed usa apenas placeholders gerados.

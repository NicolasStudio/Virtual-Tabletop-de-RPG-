# O que foi projetado — Tabletop VTT

Documento das **decisões de design** e do raciocínio por trás delas — o "porquê",
não só o "o quê".

## Princípio central: servidor é a autoridade

Nenhuma decisão sensível acontece no cliente. Posição de token, resultado de
dado, visibilidade de névoa, quem pode mover o quê — tudo é validado e decidido
no backend, e só então re-emitido. Um cliente nunca confia no evento de outro
cliente. Isso garante que um jogador não consiga "ver" um token oculto, forjar
uma rolagem ou mover algo que não deveria, mesmo mexendo no navegador.

## Contratos compartilhados (`packages/shared`)

Tipos de domínio, nomes de eventos Socket.IO e o motor de dados vivem num pacote
puro, consumido pelos dois lados. Um só lugar define o contrato, então o cliente
e o servidor nunca divergem silenciosamente.

## Camadas da cena (z-order)

Projetado como uma pilha clara, do fundo ao topo:

```
Tokens / Itens      ← interagíveis, por cima de tudo
   ↑ Grade          ← alinha os tokens
   ↑ Mapa (overlay) ← imagem redimensionável pelo mestre
   ↑ Cena (cenário) ← ambiente/fundo fixo
```

O **cenário** é o ambiente ao redor (foto do local); o **mapa** é um overlay que
o mestre carrega e estica por cima; **tokens e itens** ficam na mesma camada, no
topo. Isso espelha como uma mesa física é montada.

## Organização em pastas, não categorias fixas

Optou-se por **pastas genéricas** (com subpastas) em vez de categorias rígidas,
porque o pedido era "poder criar pasta para organização". Assim o mestre cria
quantos agrupamentos quiser (Tokens → Monstros → Chefes, etc.) em vez de ficar
preso a uma lista fixa.

## "Mestre dirige, jogador segue"

A campanha tem uma **cena ativa** (`activeSceneId`). O jogador não escolhe o que
vê — ele acompanha a cena que o mestre ativa, e todas as mudanças (novo token,
mapa, movimento) chegam ao vivo. É o modelo mental de uma mesa real: o mestre
conduz, os jogadores observam o que ele apresenta.

## Névoa de guerra: modelo por máscara

Em vez de "a cena começa coberta e você fura", o modelo final é **"a tela começa
limpa e o mestre pinta onde esconder"** (mais intuitivo para o uso descrito). A
composição no canvas usa máscara: `brushHide` adiciona névoa, `revealedCells` e
`brushReveal` cortam (`destination-out`); "Ocultar tudo" (`coverAll`) cobre a
cena inteira. Pincel à mão livre para formas irregulares; por célula para a
grade. O GM vê a névoa translúcida (enxerga o oculto); o jogador, opaca.

Decisão de robustez: o pincel **acumula o traço e envia em um único lote ao
soltar o mouse** — enviar a cada movimento saturava o rate limiter
(`ThrottlerException`).

## Movimento e permissões

- Jogador pode **mover** qualquer token/item não bloqueado (não só os seus) —
  decisão de usabilidade pedida; **excluir** permanece só do mestre.
- O mestre tem um **cadeado** (`isLocked`) para travar um elemento específico, e
  **visível/invisível** (`isHidden`) para esconder do jogador. Campos de GM são
  descartados se vierem de um jogador.

## Decisões técnicas notáveis

- **Runner `ts-node/esm`** em vez de `tsx`: o esbuild não emite
  `design:paramtypes`, quebrando a injeção de dependência do NestJS. O `ts-node`
  preserva os metadados de decorator e resolve imports `.js` (NodeNext).
- **`.env` na raiz** carregado explicitamente em `env.ts` (primeiro import),
  porque o processo roda em `apps/server` e o Prisma procuraria no lugar errado.
- **`db push`** em vez de `migrate` no dev, por um problema de timestamp na
  migração inicial; o schema é sincronizado direto.
- **Código servido com `Content-Type` correto** em `/api/files` (inferido pela
  extensão) — sem isso o navegador não renderiza a imagem num `<img>`.
- **`forwardRef`** entre `ScenesModule` e `RealtimeModule` para quebrar a
  dependência circular (o controller de cenas emite via gateway; o gateway usa o
  serviço de cenas).
- **Code-splitting**: Konva e socket.io em chunks próprios; a página do mapa é
  `lazy`, então o peso do canvas só é baixado quando o jogador abre uma cena.

## O que ficou de fora, e por quê

Fichas e bestiário já existem em outro projeto do usuário. Desenho/régua,
handouts, inventário, áudio e diário foram avaliados e descartados por não
agregarem ao uso pretendido. CSP estrito e admin ficaram para um eventual deploy
em produção, porque o CSP agressivo quebrava o ambiente de desenvolvimento.

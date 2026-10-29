# Escopo do Projeto — Tabletop VTT

## Objetivo

Construir um **Virtual Tabletop (VTT) de RPG** onde mestres e jogadores jogam
online em tempo real: campanhas, mapas, tokens, dados e combate sincronizados,
com o mestre controlando o que os jogadores veem.

## Dentro do escopo (entregue)

- **Contas e autenticação** — registro, login, recuperação de senha, sessão
  persistente via refresh token.
- **Campanhas, salas e permissões** — criação de campanhas, convites por código,
  papéis GM / Jogador / Espectador.
- **Biblioteca organizada em pastas** — Cenas, Mapas, Tokens e Itens, com
  subpastas (ex.: Tokens → Personagens / Monstros / NPCs) e upload de imagens.
- **Camadas da cena** (profundidade): Cenário (fundo fixo) → Mapa (overlay
  redimensionável pelo mestre) → Tokens e Itens (por cima).
- **Mapa interativo** — grade, pan/zoom, snapping; tokens arrastáveis com imagem.
- **Tempo real** — "o mestre dirige, o jogador segue": trocar de cena, surgir/
  mover/remover token ou mapa aparece ao vivo para o jogador.
- **Movimento** — jogador move tokens/itens livremente (exceto bloqueados);
  mestre move tudo, inclusive os mapas.
- **Dados** — d4–d100, fórmula livre, visibilidade pública/privada decidida no
  servidor.
- **Combate** — iniciativa, turnos/rodadas, dano/cura, condições; combatentes
  vinculados a tokens do mapa com auto-complete.
- **Névoa de guerra** — o mestre esconde/revela por célula ou com pincel à mão
  livre; o jogador vê apenas o revelado, ao vivo.
- **Visibilidade e bloqueio por elemento** — tornar um token/mapa invisível ao
  jogador, ou travar seu movimento.
- **Otimização** — carregamento rápido via divisão de código (code-splitting).

## Fora do escopo (deste projeto)

- **Fichas de personagem** e **bestiário/compêndio** — já existem em outro
  projeto do usuário; não implementados aqui (embora o schema os preveja).
- **Ferramentas avançadas descartadas a pedido**: desenho/marcações/régua,
  notas e handouts do mestre, inventário/economia, áudio por cena, diário/
  objetivos/linha do tempo.
- **Administração/moderação** (gestão de usuários, quotas, auditoria): previsto
  no schema (`AuditLog`), não implementado.
- **Testes E2E, CI e hardening de produção (CSP estrito)**: adiados; apenas a
  execução da suíte de testes de funcionalidades foi solicitada.

## Papéis

| Papel | Pode |
|-------|------|
| **GM (Mestre)** | Tudo: biblioteca, cenas, mapas, tokens, combate, névoa, visibilidade/bloqueio. |
| **Jogador** | Entrar na campanha, seguir a cena ativa, mover tokens/itens não bloqueados, rolar dados, ver o combate. Não vê a biblioteca nem o que está oculto. |
| **Espectador** | Acompanhar sem interagir. |

## Critérios de aceitação (atendidos)

1. Dois usuários (GM + jogador) na mesma sessão veem alterações sincronizadas. ✔
2. Dados persistem no PostgreSQL. ✔
3. Permissões por papel reforçadas no servidor (não no cliente). ✔
4. Segredos (tokens ocultos, rolagem privada, névoa) nunca vazam ao cliente
   sem direito. ✔

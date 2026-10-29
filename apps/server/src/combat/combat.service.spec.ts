import { describe, it, expect } from 'vitest';
import { sortByInitiative, advanceTurn } from './combat.service.js';

describe('sortByInitiative', () => {
  it('ordena por iniciativa decrescente', () => {
    const r = sortByInitiative([
      { name: 'A', initiative: 5 },
      { name: 'B', initiative: 20 },
      { name: 'C', initiative: 12 },
    ]);
    expect(r.map((x) => x.name)).toEqual(['B', 'C', 'A']);
  });

  it('desempata por nome (determinístico)', () => {
    const r = sortByInitiative([
      { name: 'Zoe', initiative: 10 },
      { name: 'Ana', initiative: 10 },
    ]);
    expect(r.map((x) => x.name)).toEqual(['Ana', 'Zoe']);
  });
});

describe('advanceTurn', () => {
  it('avança o índice dentro da rodada', () => {
    expect(advanceTurn(0, 1, 3)).toEqual({ turnIndex: 1, round: 1 });
    expect(advanceTurn(1, 1, 3)).toEqual({ turnIndex: 2, round: 1 });
  });

  it('dá a volta e incrementa a rodada', () => {
    expect(advanceTurn(2, 1, 3)).toEqual({ turnIndex: 0, round: 2 });
  });

  it('lida com lista vazia sem quebrar', () => {
    expect(advanceTurn(0, 1, 0)).toEqual({ turnIndex: 0, round: 1 });
  });

  it('um único combatente fica no índice 0 e avança rodada', () => {
    expect(advanceTurn(0, 3, 1)).toEqual({ turnIndex: 0, round: 4 });
  });
});

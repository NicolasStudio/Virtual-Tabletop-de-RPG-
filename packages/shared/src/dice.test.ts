import { describe, it, expect } from 'vitest';
import { roll, normalizeFormula, DiceError, type RNG } from './dice.js';

// RNG determinístico: devolve valores de uma fila (em [0,1)).
function seq(values: number[]): RNG {
  let i = 0;
  return () => values[i++ % values.length];
}

describe('normalizeFormula', () => {
  it('converte vantagem em 2d20kh1', () => {
    expect(normalizeFormula('d20+5', { advantage: true })).toBe('2d20kh1+5');
  });
  it('converte desvantagem em 2d20kl1', () => {
    expect(normalizeFormula('d20', { disadvantage: true })).toBe('2d20kl1');
  });
  it('rejeita vantagem+desvantagem juntas', () => {
    expect(() => normalizeFormula('d20', { advantage: true, disadvantage: true })).toThrow(DiceError);
  });
});

describe('roll', () => {
  it('rola um d20 fixo', () => {
    // rng=0.5 -> floor(0.5*20)+1 = 11
    const r = roll('d20', { rng: () => 0.5 });
    expect(r.total).toBe(11);
    expect(r.dice[0]).toEqual({ sides: 20, rolls: [11], kept: [11] });
  });

  it('aplica modificador', () => {
    const r = roll('d20+5', { rng: () => 0 }); // d20 -> 1
    expect(r.total).toBe(6);
    expect(r.modifier).toBe(5);
  });

  it('soma vários dados', () => {
    // 2d6 com rng -> 0 e 0.99 => 1 e 6 => 7
    const r = roll('2d6', { rng: seq([0, 0.99]) });
    expect(r.total).toBe(7);
    expect(r.dice[0].rolls).toEqual([1, 6]);
  });

  it('keep-highest fica com o maior (vantagem)', () => {
    // 2d20 -> 1 (rng 0) e 20 (rng 0.99); kh1 => 20
    const r = roll('d20', { advantage: true, rng: seq([0, 0.99]) });
    expect(r.dice[0].kept).toEqual([20]);
    expect(r.total).toBe(20);
  });

  it('keep-lowest fica com o menor (desvantagem)', () => {
    const r = roll('d20', { disadvantage: true, rng: seq([0.99, 0]) });
    expect(r.dice[0].kept).toEqual([1]);
    expect(r.total).toBe(1);
  });

  it('subtrai termo de dado negativo', () => {
    // 1d4 (rng 0.99 -> 4) - 1d4 (rng 0 -> 1) = 3
    const r = roll('1d4-1d4', { rng: seq([0.99, 0]) });
    expect(r.total).toBe(3);
  });

  it('rejeita dado não suportado', () => {
    expect(() => roll('1d7')).toThrow(DiceError);
  });

  it('rejeita fórmula inválida', () => {
    expect(() => roll('abc')).toThrow(DiceError);
  });

  it('resultado nunca extrapola os limites do dado', () => {
    for (let i = 0; i < 200; i++) {
      const r = roll('d20');
      expect(r.total).toBeGreaterThanOrEqual(1);
      expect(r.total).toBeLessThanOrEqual(20);
    }
  });
});

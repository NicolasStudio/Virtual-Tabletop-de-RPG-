// Motor de rolagem de dados — LÓGICA PURA, determinística (RNG injetável).
// Usado pelo SERVIDOR como autoridade; o cliente nunca decide o resultado.
// Suporta: NdM, modificadores (+/-), keep-highest/lowest (kh/kl), vantagem/
// desvantagem (atalho para 2d20kh1 / 2d20kl1), d4 d6 d8 d10 d12 d20 d100.

import type { RollBreakdown } from './types.js';

export type RNG = () => number; // [0,1)

export const defaultRng: RNG = () => Math.random();

const DIE_SIDES = new Set([4, 6, 8, 10, 12, 20, 100]);

export class DiceError extends Error {}

function rollDie(sides: number, rng: RNG): number {
  return Math.floor(rng() * sides) + 1;
}

interface DiceTerm {
  count: number;
  sides: number;
  keep?: { mode: 'h' | 'l'; n: number };
}

// Normaliza vantagem/desvantagem para notação de dados.
export function normalizeFormula(
  formula: string,
  opts?: { advantage?: boolean; disadvantage?: boolean },
): string {
  let f = formula.trim().toLowerCase().replace(/\s+/g, '');
  if (opts?.advantage && opts?.disadvantage) {
    throw new DiceError('Vantagem e desvantagem não podem ser usadas juntas.');
  }
  if (opts?.advantage) f = f.replace(/\bd20\b/, '2d20kh1');
  if (opts?.disadvantage) f = f.replace(/\bd20\b/, '2d20kl1');
  return f;
}

// Faz o parse de uma fórmula tipo "2d20kh1+5-1d4".
function parse(formula: string): { terms: DiceTerm[]; modifier: number } {
  const f = formula.replace(/\s+/g, '');
  if (!/^[0-9dkhl+\-]+$/i.test(f)) {
    throw new DiceError(`Fórmula inválida: ${formula}`);
  }
  const terms: DiceTerm[] = [];
  let modifier = 0;
  // separa em tokens com sinal
  const parts = f.match(/[+\-]?[^+\-]+/g);
  if (!parts) throw new DiceError(`Fórmula vazia: ${formula}`);

  for (const raw of parts) {
    const sign = raw.startsWith('-') ? -1 : 1;
    const body = raw.replace(/^[+\-]/, '');
    const diceMatch = body.match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/i);
    if (diceMatch) {
      const count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
      const sides = parseInt(diceMatch[2], 10);
      if (!DIE_SIDES.has(sides)) {
        throw new DiceError(`Tipo de dado não suportado: d${sides}`);
      }
      if (count < 1 || count > 100) {
        throw new DiceError(`Quantidade de dados fora do intervalo: ${count}`);
      }
      const term: DiceTerm = { count: sign * count, sides };
      if (diceMatch[3]) {
        const mode = diceMatch[3].toLowerCase() === 'kh' ? 'h' : 'l';
        term.keep = { mode, n: parseInt(diceMatch[4], 10) };
      }
      terms.push(term);
    } else if (/^\d+$/.test(body)) {
      modifier += sign * parseInt(body, 10);
    } else {
      throw new DiceError(`Termo inválido: ${raw}`);
    }
  }
  return { terms, modifier };
}

export function roll(
  formula: string,
  opts?: { advantage?: boolean; disadvantage?: boolean; rng?: RNG },
): RollBreakdown {
  const rng = opts?.rng ?? defaultRng;
  const normalized = normalizeFormula(formula, opts);
  const { terms, modifier } = parse(normalized);

  const dice: RollBreakdown['dice'] = [];
  let total = modifier;

  for (const term of terms) {
    const sign = term.count < 0 ? -1 : 1;
    const absCount = Math.abs(term.count);
    const rolls: number[] = [];
    for (let i = 0; i < absCount; i++) rolls.push(rollDie(term.sides, rng));

    let kept = rolls;
    if (term.keep) {
      const sorted = [...rolls].sort((a, b) => b - a); // desc
      kept =
        term.keep.mode === 'h'
          ? sorted.slice(0, term.keep.n)
          : sorted.slice(-term.keep.n);
    }
    const sum = kept.reduce((a, b) => a + b, 0);
    total += sign * sum;
    dice.push({ sides: term.sides, rolls, kept });
  }

  return { dice, modifier, total, notation: normalized };
}

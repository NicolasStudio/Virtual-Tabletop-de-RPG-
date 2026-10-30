import type { RollBreakdown } from '@tabletop/shared';
import type DiceBox from '@3d-dice/dice-box-threejs';

// Dados 3D (@3d-dice/dice-box-threejs). O resultado continua vindo do servidor:
// a animação só recebe os valores já sorteados ("1d20@17") e faz os dados
// pararem neles. A biblioteca (~700 kB) só é baixada na primeira rolagem.

export const DICE_3D_CONTAINER_ID = 'dice-3d';
const MAX_DICE = 20; // rolagens maiores que isso não animam (ficaria poluído e pesado)

/**
 * Converte o resultado do servidor na notação da biblioteca. Cada tipo de dado
 * aparece uma vez só, porque a biblioteca junta grupos iguais e a ordem dos
 * valores depois do @ precisa bater com a ordem dos dados.
 * O d100 da biblioteca é só o dado das dezenas (10…100, onde 100 = "00"); o
 * valor vira dezenas + d10 das unidades (10 = "0"), como numa mesa de verdade.
 */
export function toDiceNotation(breakdown: RollBreakdown): string | null {
  const byType = new Map<string, number[]>();
  const push = (type: string, value: number) => {
    const list = byType.get(type) ?? [];
    list.push(value);
    byType.set(type, list);
  };

  for (const group of breakdown.dice) {
    for (const value of group.rolls) {
      if (group.sides === 100) {
        const tens = Math.floor(value / 10) * 10;
        const units = value % 10;
        push('d100', tens === 0 ? 100 : tens);
        push('d10', units === 0 ? 10 : units);
      } else {
        push(`d${group.sides}`, value);
      }
    }
  }

  const types = [...byType.entries()];
  const count = types.reduce((n, [, values]) => n + values.length, 0);
  if (count === 0 || count > MAX_DICE) return null;
  const dice = types.map(([type, values]) => `${values.length}${type}`).join('+');
  const results = types.flatMap(([, values]) => values).join(',');
  return `${dice}@${results}`;
}

// O histórico de rolagens espera o dado parar para não entregar o resultado antes.
const LANDED_EVENT = 'tabletop:dado-parou';
const landed = new Set<string>(); // ids que já pararam antes de alguém perguntar

/** A animação desta rolagem terminou (ou não vai acontecer). */
export function markLanded(rollId: string) {
  landed.add(rollId);
  window.dispatchEvent(new CustomEvent<string>(LANDED_EVENT, { detail: rollId }));
}

/** Resolve quando o dado da rolagem parar; com folga caso a animação trave. */
export function whenLanded(rollId: string, timeoutMs = 8000): Promise<void> {
  if (landed.delete(rollId)) return Promise.resolve();
  return new Promise((resolve) => {
    const done = () => {
      window.removeEventListener(LANDED_EVENT, onLanded);
      clearTimeout(timer);
      landed.delete(rollId);
      resolve();
    };
    const onLanded = (e: Event) => {
      if ((e as CustomEvent<string>).detail === rollId) done();
    };
    window.addEventListener(LANDED_EVENT, onLanded);
    const timer = setTimeout(done, timeoutMs);
  });
}

let box: Promise<DiceBox> | null = null;
let boxKey = ''; // tamanho da tela + tema com que a caixa foi criada

function themeColorset() {
  const css = getComputedStyle(document.documentElement);
  const accent = css.getPropertyValue('--accent').trim() || '#c9a24b';
  const ink = css.getPropertyValue('--accent-text').trim() || '#1a140b';
  return {
    name: `tabletop-${document.documentElement.dataset.tema ?? 'padrao'}`,
    foreground: ink,
    background: accent,
    outline: ink,
    texture: 'none',
    material: 'plastic' as const,
  };
}

/** Cria a caixa de dados (ou recria, se a janela mudou de tamanho ou o tema mudou). */
function getBox(container: HTMLElement): Promise<DiceBox> {
  const key = `${container.clientWidth}x${container.clientHeight}:${document.documentElement.dataset.tema ?? ''}`;
  if (box && key === boxKey) return box;

  container.replaceChildren(); // tira o canvas da caixa anterior
  boxKey = key;
  box = import('@3d-dice/dice-box-threejs').then(async ({ default: DiceBoxClass }) => {
    const b = new DiceBoxClass(`#${DICE_3D_CONTAINER_ID}`, {
      theme_customColorset: themeColorset(),
      baseScale: 90,
      strength: 1.4,
    });
    await b.initialize();
    return b;
  });
  box.catch(() => {
    box = null; // falhou (ex.: sem WebGL): tenta de novo na próxima rolagem
  });
  return box;
}

/** Anima a rolagem; resolve quando os dados param. */
export async function animateRoll(container: HTMLElement, breakdown: RollBreakdown) {
  const notation = toDiceNotation(breakdown);
  if (!notation) return;
  const b = await getBox(container);
  await b.roll(notation);
}

export async function clearDice() {
  if (box) (await box).clearDice();
}

// A biblioteca não traz tipos; só o que o Tabletop usa (ver lib/dice3d.ts).
declare module '@3d-dice/dice-box-threejs' {
  interface DiceColorset {
    name: string;
    foreground: string;
    background: string;
    outline: string;
    texture: string;
    material: 'none' | 'metal' | 'wood' | 'glass' | 'plastic';
  }

  interface DiceBoxConfig {
    sounds?: boolean;
    shadows?: boolean;
    theme_customColorset?: DiceColorset | null;
    theme_material?: DiceColorset['material'];
    gravity_multiplier?: number;
    light_intensity?: number;
    baseScale?: number;
    strength?: number;
  }

  export default class DiceBox {
    constructor(selector: string, config?: DiceBoxConfig);
    initialize(): Promise<void>;
    /** "1d20+2d6@17,3,5": os valores depois do @ são onde os dados param, na ordem. */
    roll(notation: string): Promise<unknown>;
    clearDice(): void;
  }
}

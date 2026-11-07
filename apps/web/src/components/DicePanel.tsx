import { useState } from 'react';
import type { DiceRollDTO } from '@tabletop/shared';
import type { useDiceRolls, RollRequest } from '../hooks/useDiceRolls.js';

const DICE = [4, 6, 8, 10, 12, 20, 100];

interface Props {
  // o histórico vem da cena (ScenePage): continua quando o painel fecha
  dice: ReturnType<typeof useDiceRolls>;
  canSeeGmVisibility?: boolean; // mantido por compat; visibilidade agora é só Pública/Privada
}

// Cada dado da rolagem com o próprio valor. Em kh/kl (ex.: vantagem), os que não
// contaram para o total ficam apagados e riscados.
function diceValues(roll: DiceRollDTO) {
  return roll.breakdown.dice.flatMap((group) => {
    const kept = [...group.kept];
    return group.rolls.map((value) => {
      const i = kept.indexOf(value);
      if (i >= 0) kept.splice(i, 1);
      return { sides: group.sides, value, dropped: i < 0 };
    });
  });
}

const visibilityIcon = (roll: DiceRollDTO) =>
  roll.visibility === 'PUBLIC' ? '' : roll.visibility === 'GM' ? ' 🛡️' : ' 🔒';

// "[d8 6] [d8 3] +3": cada dado com o valor (máximo em destaque, 1 em vermelho) e o modificador
function DiceChips({ roll }: { roll: DiceRollDTO }) {
  const mod = roll.breakdown.modifier;
  return (
    <span className="roll-dice">
      {diceValues(roll).map((d, i) => (
        <span
          key={i}
          className={['roll-die', d.dropped && 'dropped', d.value === d.sides && 'max', d.value === 1 && 'min']
            .filter(Boolean)
            .join(' ')}
          title={d.dropped ? `d${d.sides} (não contou)` : `d${d.sides}`}
        >
          <small>d{d.sides}</small>
          {d.value}
        </span>
      ))}
      {mod !== 0 && <span className="roll-mod">{mod > 0 ? `+${mod}` : mod}</span>}
    </span>
  );
}

// Cartão de cada rolagem: quem rolou (😈 criatura, 🎮 personagem ou jogador), o que foi
// rolado, a conta (com os atributos por nome, nas vindas da Ficha), os dados e o total
function RollCard({ roll }: { roll: DiceRollDTO }) {
  const player = roll.userDisplayName ?? 'Alguém';
  const creature = roll.characterKind === 'creature';
  return (
    <li className={`roll-card ${creature ? 'creature' : ''}`}>
      <strong className="roll-card-who">
        <span aria-hidden="true">{creature ? '😈' : '🎮'}</span> {roll.character || player}
      </strong>
      <span className="roll-card-what">
        {roll.label ?? 'Teste'}
        {roll.character && <span className="muted"> · {player}</span>}
        {visibilityIcon(roll)}
      </span>
      <span className="roll-card-box" title={roll.formula}>
        {roll.expression || roll.formula}
      </span>
      {roll.breakdown.dice.length > 0 && <DiceChips roll={roll} />}
      <span className="roll-card-box roll-card-total">{roll.result}</span>
    </li>
  );
}

export function DicePanel({ dice }: Props) {
  const { rolls, rollDice, clear } = dice;
  const [formula, setFormula] = useState('');
  const [visibility, setVisibility] = useState<RollRequest['visibility']>('PUBLIC');

  function send(f: string) {
    rollDice({ formula: f, visibility });
  }

  function onCustom(e: React.FormEvent) {
    e.preventDefault();
    const f = formula.trim();
    if (f) {
      send(f);
      setFormula('');
    }
  }

  return (
    <div className="dice-panel" aria-label="Painel de dados">
      <div className="dice-buttons">
        {DICE.map((d) => (
          <button key={d} className="btn ghost die-btn" onClick={() => send(`d${d}`)} title={`Rolar d${d}`}>
            d{d}
          </button>
        ))}
      </div>

      <form className="dice-form" onSubmit={onCustom}>
        <input
          aria-label="Fórmula de rolagem"
          placeholder="ex.: 2d6+3, 1d20+5"
          value={formula}
          onChange={(e) => setFormula(e.target.value)}
        />
        <button className="btn" type="submit">Rolar</button>
      </form>

      <div className="dice-opts">
        <select
          aria-label="Visibilidade da rolagem"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as RollRequest['visibility'])}
        >
          <option value="PUBLIC">Pública</option>
          <option value="PRIVATE">Privada</option>
        </select>
      </div>

      <div className="roll-log-head">
        <span className="muted" style={{ fontSize: 12 }}>Histórico</span>
        {rolls.length > 0 && (
          <button className="link-btn" style={{ color: 'var(--text-dim)' }} onClick={clear}>
            limpar
          </button>
        )}
      </div>
      <ul className="roll-log">
        {rolls.length === 0 ? (
          <li className="muted" style={{ listStyle: 'none', padding: '8px 0' }}>
            Nenhuma rolagem ainda.
          </li>
        ) : (
          rolls.map((r) => <RollCard key={r.id} roll={r} />)
        )}
      </ul>
    </div>
  );
}

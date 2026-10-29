import { useState } from 'react';
import type { DiceRollDTO } from '@tabletop/shared';
import { useDiceRolls, type RollRequest } from '../hooks/useDiceRolls.js';

const DICE = [4, 6, 8, 10, 12, 20, 100];

interface Props {
  campaignId: string;
  canSeeGmVisibility?: boolean; // mantido por compat; visibilidade agora é só Pública/Privada
}

function RollLine({ roll }: { roll: DiceRollDTO }) {
  const dice = roll.breakdown.dice
    .map((d) => `${d.rolls.length}d${d.sides}[${d.rolls.join(',')}]`)
    .join(' ');
  const vis =
    roll.visibility === 'PUBLIC' ? '' : roll.visibility === 'GM' ? ' 🛡️' : ' 🔒';
  return (
    <li className="roll-line">
      <span className="roll-total">{roll.result}</span>
      <span className="roll-meta">
        <strong>{roll.userDisplayName ?? 'Alguém'}</strong> · {roll.formula}
        {vis}
        <span className="muted roll-detail"> {dice} {roll.breakdown.modifier ? `(mod ${roll.breakdown.modifier >= 0 ? '+' : ''}${roll.breakdown.modifier})` : ''}</span>
      </span>
    </li>
  );
}

export function DicePanel({ campaignId }: Props) {
  const { rolls, rollDice, clear } = useDiceRolls(campaignId);
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
          rolls.map((r) => <RollLine key={r.id} roll={r} />)
        )}
      </ul>
    </div>
  );
}

import { useState } from 'react';
import { combatApi, type Combatant } from '../lib/combat.js';
import { useCombat } from '../hooks/useCombat.js';

interface Props {
  campaignId: string;
  isGm: boolean;
}

function CombatantRow({
  c,
  isCurrent,
  isGm,
  campaignId,
  onChanged,
}: {
  c: Combatant;
  isCurrent: boolean;
  isGm: boolean;
  campaignId: string;
  onChanged: () => void;
}) {
  const [delta, setDelta] = useState('');

  async function applyDamage(sign: 1 | -1) {
    const n = parseInt(delta, 10);
    if (!Number.isFinite(n) || n <= 0) return;
    await combatApi.damage(campaignId, c.id, sign * n); // +dano / -cura
    setDelta('');
    onChanged();
  }

  const hpPct = c.maxHp > 0 ? Math.round((c.hp / c.maxHp) * 100) : 0;
  const dead = c.maxHp > 0 && c.hp === 0;

  return (
    <li className={`combatant ${isCurrent ? 'current' : ''} ${dead ? 'dead' : ''}`}>
      <span className="init" title="iniciativa">{c.initiative}</span>
      <div className="combatant-main">
        <div className="combatant-name">
          {c.name} {c.isNpc && <span className="badge" style={{ fontSize: 10 }}>NPC</span>}
          {isCurrent && <span className="turn-arrow" aria-label="turno atual">▶</span>}
        </div>
        {c.maxHp > 0 && (
          <div className="hp-bar" title={`${c.hp}/${c.maxHp}`}>
            <div className="hp-fill" style={{ width: `${hpPct}%` }} />
            <span className="hp-text">{c.hp}/{c.maxHp}</span>
          </div>
        )}
        {c.conditions.length > 0 && (
          <div className="conditions">{c.conditions.map((cd) => (
            <span key={cd} className="cond">{cd}</span>
          ))}</div>
        )}
      </div>
      {isGm && (
        <div className="combatant-ctl">
          <input
            type="number"
            min={1}
            value={delta}
            onChange={(e) => setDelta(e.target.value)}
            placeholder="0"
            aria-label={`dano/cura em ${c.name}`}
          />
          <button className="btn ghost sm" onClick={() => applyDamage(1)} title="dano">−</button>
          <button className="btn ghost sm" onClick={() => applyDamage(-1)} title="cura">+</button>
          <button
            className="link-btn"
            onClick={async () => { await combatApi.remove(campaignId, c.id); onChanged(); }}
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

export function CombatTracker({ campaignId, isGm }: Props) {
  const { encounter, reload } = useCombat(campaignId);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const [newHp, setNewHp] = useState('');

  async function startCombat() {
    await combatApi.create(campaignId, { name: 'Combate' });
    reload();
  }

  async function addCombatant(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    await combatApi.addCombatant(campaignId, {
      name: newName.trim(),
      initiative: parseInt(newInit, 10) || 0,
      hp: parseInt(newHp, 10) || 0,
      maxHp: parseInt(newHp, 10) || 0,
    });
    setNewName(''); setNewInit(''); setNewHp('');
    reload();
  }

  // trata tanto null quanto objeto vazio/parcial como "sem combate"
  if (!encounter || !encounter.id || !Array.isArray(encounter.combatants)) {
    return (
      <div className="combat-tracker">
        <p className="muted">Nenhum combate em andamento.</p>
        {isGm && <button className="btn" onClick={startCombat}>Iniciar combate</button>}
      </div>
    );
  }

  return (
    <div className="combat-tracker">
      <div className="combat-head">
        <strong>{encounter.name}</strong>
        <span className="badge">Rodada {encounter.round}</span>
        {isGm && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn sm" onClick={async () => { await combatApi.nextTurn(campaignId); reload(); }}>
              Próximo turno ▶
            </button>
            <button className="btn ghost sm" onClick={async () => { await combatApi.end(campaignId); reload(); }}>
              Encerrar
            </button>
          </span>
        )}
      </div>

      <ol className="combat-list">
        {encounter.combatants.length === 0 ? (
          <li className="muted" style={{ listStyle: 'none' }}>Sem combatentes. Adicione abaixo.</li>
        ) : (
          encounter.combatants.map((c) => (
            <CombatantRow
              key={c.id}
              c={c}
              isCurrent={c.id === encounter.currentCombatantId}
              isGm={isGm}
              campaignId={campaignId}
              onChanged={reload}
            />
          ))
        )}
      </ol>

      {isGm && (
        <form className="combat-add" onSubmit={addCombatant}>
          <input placeholder="Nome" value={newName} onChange={(e) => setNewName(e.target.value)} />
          <input placeholder="Init" type="number" value={newInit} onChange={(e) => setNewInit(e.target.value)} style={{ width: 60 }} />
          <input placeholder="HP" type="number" value={newHp} onChange={(e) => setNewHp(e.target.value)} style={{ width: 60 }} />
          <button className="btn sm" type="submit">+ Adicionar</button>
        </form>
      )}
    </div>
  );
}

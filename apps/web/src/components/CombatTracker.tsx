import { useState } from 'react';
import type { TokenDTO } from '@tabletop/shared';
import { combatApi, type Combatant } from '../lib/combat.js';
import { useCombat } from '../hooks/useCombat.js';

interface Props {
  campaignId: string;
  isGm: boolean;
  tokens?: TokenDTO[]; // tokens do mapa atual, para o auto-complete de combatentes
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
            className="combatant-remove"
            title="remover da fila"
            aria-label="remover da fila"
            onClick={async () => { await combatApi.remove(campaignId, c.id); onChanged(); }}
          >
            ✕
          </button>
        </div>
      )}
    </li>
  );
}

export function CombatTracker({ campaignId, isGm, tokens = [] }: Props) {
  const { encounter, reload } = useCombat(campaignId);
  const [newName, setNewName] = useState('');
  const [newInit, setNewInit] = useState('');
  const [newHp, setNewHp] = useState('');

  async function startCombat() {
    await combatApi.create(campaignId, { name: 'Combate' });
    reload();
  }

  // #10: quando o nome digitado casa com um token do mapa, puxamos o HP dele
  // (se houver em stats) e vinculamos o tokenId.
  function matchToken(name: string): TokenDTO | undefined {
    const n = name.trim().toLowerCase();
    return tokens.find((t) => t.name.trim().toLowerCase() === n);
  }

  function onNameChange(value: string) {
    setNewName(value);
    const tok = matchToken(value);
    if (tok) {
      const hp = (tok.stats as any)?.hp?.max ?? (tok.stats as any)?.hp;
      if (hp && !newHp) setNewHp(String(hp));
    }
  }

  async function addCombatant(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    const tok = matchToken(newName);
    await combatApi.addCombatant(campaignId, {
      name: newName.trim(),
      initiative: parseInt(newInit, 10) || 0,
      hp: parseInt(newHp, 10) || 0,
      maxHp: parseInt(newHp, 10) || 0,
      ...(tok ? { tokenId: tok.id, isNpc: tok.kind === 'MONSTER' || tok.kind === 'NPC' } : {}),
    } as any);
    setNewName(''); setNewInit(''); setNewHp('');
    reload();
  }

  // atalho: joga todos os tokens do mapa na fila de combate de uma vez
  async function addAllTokens() {
    for (const t of tokens) {
      const hp = (t.stats as any)?.hp?.max ?? (t.stats as any)?.hp ?? 0;
      await combatApi.addCombatant(campaignId, {
        name: t.name,
        initiative: 0,
        hp: Number(hp) || 0,
        maxHp: Number(hp) || 0,
        tokenId: t.id,
        isNpc: t.kind === 'MONSTER' || t.kind === 'NPC',
      } as any);
    }
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
        <span className="round-badge" title="Rodada atual">Rodada&nbsp;{encounter.round}</span>
        {isGm && (
          <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn sm" onClick={async () => { await combatApi.nextTurn(campaignId); reload(); }}>
              Próximo turno ▶
            </button>
            <button className="btn ghost sm combat-end" onClick={async () => { await combatApi.end(campaignId); reload(); }}>
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
        <>
          <form className="combat-add" onSubmit={addCombatant}>
            <input
              placeholder="Nome (ou escolha um token)"
              list="combat-token-names"
              value={newName}
              onChange={(e) => onNameChange(e.target.value)}
            />
            <datalist id="combat-token-names">
              {tokens.map((t) => (
                <option key={t.id} value={t.name} />
              ))}
            </datalist>
            <input placeholder="Init" type="number" value={newInit} onChange={(e) => setNewInit(e.target.value)} style={{ width: 60 }} />
            <input placeholder="HP" type="number" value={newHp} onChange={(e) => setNewHp(e.target.value)} style={{ width: 60 }} />
            <button className="btn sm" type="submit">+ Adicionar</button>
          </form>
          {tokens.length > 0 && (
            <button className="btn ghost sm combat-add-all" onClick={addAllTokens}>
              + Adicionar todos os tokens do mapa ({tokens.length})
            </button>
          )}
        </>
      )}
    </div>
  );
}

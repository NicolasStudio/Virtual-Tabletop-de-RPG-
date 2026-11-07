import { useState } from 'react';
import type { PresenceUser } from '../hooks/useRealtimeScene.js';

const COLLAPSED_KEY = 'tabletop:jogadores-recolhido';

function savedCollapsed() {
  try {
    return localStorage.getItem(COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

/** Quem está na mesa agora: caixa no canto inferior esquerdo, que recolhe pelo título. */
export function PlayersBox({ online, myUserId }: { online: PresenceUser[]; myUserId?: string }) {
  const [collapsed, setCollapsed] = useState(savedCollapsed);

  function toggle() {
    setCollapsed((v) => {
      try {
        localStorage.setItem(COLLAPSED_KEY, v ? '0' : '1');
      } catch {
        /* sem localStorage: vale só nesta visita */
      }
      return !v;
    });
  }

  // mestre primeiro, depois os jogadores em ordem alfabética
  const sorted = [...online].sort(
    (a, b) => Number(b.role === 'GM') - Number(a.role === 'GM') || a.displayName.localeCompare(b.displayName),
  );

  return (
    <aside className={`players-box ${collapsed ? 'collapsed' : ''}`} aria-label="Jogadores na mesa">
      <button className="players-head" onClick={toggle} aria-expanded={!collapsed}>
        <span aria-hidden="true">👥</span> Jogadores
        <span className="players-count">{online.length}</span>
        <span className="players-caret" aria-hidden="true">
          {collapsed ? '▴' : '▾'}
        </span>
      </button>
      {!collapsed && (
        <ul className="players-list">
          {sorted.map((p) => (
            <li key={p.userId} className={p.role === 'GM' ? 'gm' : ''}>
              <span className="players-dot" aria-hidden="true" />
              {p.displayName}
              {p.role === 'GM' && <span className="players-role">[Mestre]</span>}
              {p.userId === myUserId && <span className="players-me">(você)</span>}
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}

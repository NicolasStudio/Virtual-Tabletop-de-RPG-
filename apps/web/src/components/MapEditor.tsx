import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Group, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { SceneDTO, TokenDTO } from '@tabletop/shared';
import { GridLayer } from './GridLayer.js';
import { TokenShape } from './TokenShape.js';
import { MapOverlayShape } from './MapOverlayShape.js';
import { assetUrl } from '../lib/assets.js';
import type { MapOverlayDTO, SceneFogDTO } from '@tabletop/shared';

// carrega um HTMLImageElement a partir de uma URL (ou null)
function useHtmlImage(url?: string | null): HTMLImageElement | null {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    if (!url) {
      setImg(null);
      return;
    }
    const image = new window.Image();
    image.crossOrigin = 'anonymous';
    image.src = url;
    image.onload = () => setImg(image);
    image.onerror = () => setImg(null);
    return () => {
      image.onload = null;
      image.onerror = null;
    };
  }, [url]);
  return img;
}

interface Props {
  scene: SceneDTO;
  tokens: TokenDTO[];
  overlays: MapOverlayDTO[];
  isGm: boolean;
  canEditToken: (t: TokenDTO) => boolean;
  snap: boolean;
  onTokenChange: (tokenId: string, data: Partial<TokenDTO>) => void;
  onOverlayChange: (overlayId: string, data: Partial<MapOverlayDTO>) => void;
  fog: SceneFogDTO;
  fogPaintMode: 'reveal' | 'hide' | null; // quando != null, o GM está pintando névoa
  fogBrush: boolean; // true = pincel à mão livre; false = por célula
  brushSize: number; // raio do pincel livre (px da cena)
  onFogPaint: (cells: string[], mode: 'reveal' | 'hide') => void;
  onFogBrush: (dots: { x: number; y: number; r: number }[], mode: 'reveal' | 'hide') => void;
}

export function MapEditor({ scene, tokens, overlays, isGm, canEditToken, snap, onTokenChange, onOverlayChange, fog, fogPaintMode, fogBrush, brushSize, onFogPaint, onFogBrush }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const background = useHtmlImage(scene.backgroundUrl ? assetUrl(scene.backgroundUrl) : null);
  const painting = useRef(false);
  const brushBuffer = useRef<{ x: number; y: number; r: number }[]>([]);
  const cellBuffer = useRef<Set<string>>(new Set());

  const gs = scene.gridSize > 0 ? scene.gridSize : 70;
  const cols = Math.ceil(scene.width / gs);
  const rows = Math.ceil(scene.height / gs);
  const revealed = new Set(fog.revealedCells);

  // converte um ponto do palco numa célula "col,row"
  function cellAtPointer(): string | null {
    const st = stageRef.current;
    const p = st?.getPointerPosition();
    if (!st || !p) return null;
    const scaleNow = st.scaleX();
    const x = (p.x - st.x()) / scaleNow;
    const y = (p.y - st.y()) / scaleNow;
    const col = Math.floor(x / gs);
    const row = Math.floor(y / gs);
    if (col < 0 || row < 0 || col >= cols || row >= rows) return null;
    return `${col},${row}`;
  }

  // ponto do palco em coords da cena (para o pincel livre)
  function pointInScene(): { x: number; y: number } | null {
    const st = stageRef.current;
    const p = st?.getPointerPosition();
    if (!st || !p) return null;
    const scaleNow = st.scaleX();
    return { x: (p.x - st.x()) / scaleNow, y: (p.y - st.y()) / scaleNow };
  }

  function paintAtPointer() {
    if (!fogPaintMode) return;
    if (fogBrush) {
      const pt = pointInScene();
      if (pt) brushBuffer.current.push({ x: pt.x, y: pt.y, r: brushSize });
    } else {
      const cell = cellAtPointer();
      if (cell) cellBuffer.current.add(cell);
    }
  }

  // envia o traço acumulado de uma vez (evita flood de requisições / rate-limit)
  function flushPaint() {
    if (!fogPaintMode) return;
    if (fogBrush) {
      const dots = brushBuffer.current;
      brushBuffer.current = [];
      if (dots.length) onFogBrush(dots, fogPaintMode);
    } else {
      const cells = [...cellBuffer.current];
      cellBuffer.current = new Set();
      if (cells.length) onFogPaint(cells, fogPaintMode);
    }
  }

  // zoom centrado no cursor
  function onWheel(e: Konva.KonvaEventObject<WheelEvent>) {
    e.evt.preventDefault();
    const stage = stageRef.current!;
    const oldScale = stage.scaleX();
    const pointer = stage.getPointerPosition()!;
    const mousePoint = {
      x: (pointer.x - stage.x()) / oldScale,
      y: (pointer.y - stage.y()) / oldScale,
    };
    const direction = e.evt.deltaY > 0 ? -1 : 1;
    const newScale = Math.min(4, Math.max(0.2, oldScale * (direction > 0 ? 1.1 : 1 / 1.1)));
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: pointer.x - mousePoint.x * newScale,
      y: pointer.y - mousePoint.y * newScale,
    });
    setScale(newScale);
  }

  const viewW = Math.min(scene.width, typeof window !== 'undefined' ? window.innerWidth - 40 : 960);
  const viewH = Math.min(scene.height, 640);

  return (
    <div className="map-editor" aria-label="Editor de mapa">
      <Stage
        ref={stageRef}
        width={viewW}
        height={viewH}
        draggable={!fogPaintMode} // sem pan enquanto pinta névoa
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (fogPaintMode) {
            painting.current = true;
            paintAtPointer();
            return;
          }
          // desseleciona só quando o clique cai no FUNDO (stage, cenário ou grade),
          // nunca quando cai num token/mapa. Fundo é marcado com name="background".
          const name = e.target?.name?.();
          if (e.target === e.target.getStage() || name === 'background') {
            setSelectedId(null);
            setSelectedOverlayId(null);
          }
        }}
        onMouseMove={() => {
          if (fogPaintMode && painting.current) paintAtPointer();
        }}
        onMouseUp={() => {
          if (painting.current) flushPaint();
          painting.current = false;
        }}
        style={{ background: '#0f0c08', borderRadius: 8, cursor: fogPaintMode ? 'crosshair' : 'grab' }}
      >
        <Layer>
          <Rect name="background" width={scene.width} height={scene.height} fill="#1b140c" />
          {/* CENÁRIO = ambiente ao redor / fundo fixo */}
          {background && (
            <KonvaImage name="background" image={background} width={scene.width} height={scene.height} />
          )}
          {/* MAPAS = overlays por cima da cena, redimensionáveis pelo GM */}
          {overlays.map((o) => (
            // fora da tela (Remover) não aparece; invisível só o GM vê
            o.isOnMap === false || (o.isHidden && !isGm) ? null : (
            <MapOverlayShape
              key={o.id}
              overlay={o}
              selected={selectedOverlayId === o.id}
              editable={isGm}
              onSelect={() => { setSelectedOverlayId(o.id); setSelectedId(null); }}
              onChange={(data) => onOverlayChange(o.id, data)}
            />
            )
          ))}
          {/* GRADE por cima do mapa, para alinhar tokens */}
          <GridLayer
            type={scene.gridType}
            size={scene.gridSize}
            width={scene.width}
            height={scene.height}
            color={scene.gridColor}
          />
        </Layer>
        <Layer>
          {tokens.map((t) => {
            if (t.isOnMap === false) return null; // tirado da tela (Remover): só na biblioteca
            if (t.isHidden && !isGm) return null; // jogador não vê token oculto
            const editable = canEditToken(t) && !t.isLocked;
            return (
              <TokenShape
                key={t.id}
                token={t}
                selected={selectedId === t.id}
                draggable={editable}
                gridSize={scene.gridSize}
                snap={snap && scene.gridType === 'SQUARE'}
                onSelect={() => setSelectedId(t.id)}
                onDragEnd={(x, y) => onTokenChange(t.id, { x, y })}
                onTransformEnd={(attrs) => onTokenChange(t.id, attrs)}
              />
            );
          })}
        </Layer>
        {fog.enabled && (
          <Layer listening={false}>
            <Group opacity={isGm ? 0.5 : 1}>
              {/* base: só cobre tudo quando 'Ocultar tudo' (coverAll) */}
              {fog.coverAll && <Rect width={scene.width} height={scene.height} fill="#05040a" />}
              {/* névoa desenhada à mão (brushHide): adiciona névoa onde o GM pintou */}
              {fog.brushHide.map((d, i) => (
                <Circle key={`bh-${i}`} x={d.x} y={d.y} radius={d.r} fill="#05040a" />
              ))}
              {/* FUROS (destination-out): células reveladas */}
              {[...revealed].map((key) => {
                const [col, row] = key.split(',').map(Number);
                return (
                  <Rect
                    key={`rv-${key}`}
                    x={col * gs}
                    y={row * gs}
                    width={gs}
                    height={gs}
                    fill="#000"
                    globalCompositeOperation="destination-out"
                  />
                );
              })}
              {/* FUROS: pincel revelar */}
              {fog.brushReveal.map((d, i) => (
                <Circle
                  key={`br-${i}`}
                  x={d.x}
                  y={d.y}
                  radius={d.r}
                  fill="#000"
                  globalCompositeOperation="destination-out"
                />
              ))}
            </Group>
          </Layer>
        )}
      </Stage>
      {isGm && (() => {
        const selToken = tokens.find((t) => t.id === selectedId && t.isOnMap !== false);
        const selOverlay = overlays.find((o) => o.id === selectedOverlayId && o.isOnMap !== false);
        const sel = selToken ?? selOverlay;
        if (!sel) return null;
        const isOverlay = !!selOverlay;
        const label = isOverlay ? 'Mapa' : (selToken as TokenDTO).name;
        const hidden = isOverlay ? !!(selOverlay as MapOverlayDTO).isHidden : !!(selToken as TokenDTO).isHidden;
        const locked = isOverlay ? !!(selOverlay as MapOverlayDTO).isLocked : !!(selToken as TokenDTO).isLocked;
        const apply = (patch: any) => {
          if (isOverlay) onOverlayChange(selOverlay!.id, patch);
          else onTokenChange(selToken!.id, patch);
        };
        return (
          <div className="sel-ctl">
            <span className="sel-name" title={label}>{isOverlay ? '🗺️' : '🎯'} {label}</span>
            <button
              className={`btn ghost sm ${hidden ? 'sel-active' : ''}`}
              onClick={() => apply({ isHidden: !hidden })}
              title={hidden ? 'Está invisível para o jogador — clique para mostrar' : 'Visível — clique para esconder do jogador'}
            >
              {hidden ? '🙈 Invisível' : '👁 Visível'}
            </button>
            <button
              className={`btn ghost sm ${locked ? 'sel-active' : ''}`}
              onClick={() => apply({ isLocked: !locked })}
              title={locked ? 'Travado — clique para liberar o movimento' : 'Livre — clique para travar o movimento'}
            >
              {locked ? '🔒 Travado' : '🔓 Livre'}
            </button>
            <button
              className="btn ghost sm"
              onClick={() => {
                apply({ isOnMap: false });
                setSelectedOverlayId(null);
                setSelectedId(null);
              }}
              title="Tira da tela; continua na biblioteca (clique nele lá para colocar de volta)"
            >
              🗑 Remover
            </button>
          </div>
        );
      })()}
      <div className="map-hud muted">
        zoom {(scale * 100).toFixed(0)}% · arraste o fundo para mover · roda do mouse para zoom{isGm ? ' · clique num mapa/token para ações' : ''}
      </div>
    </div>
  );
}

import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Group, Line, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { SceneDTO, TokenDTO } from '@tabletop/shared';
import { GridLayer } from './GridLayer.js';
import { TokenShape } from './TokenShape.js';
import { MapOverlayShape } from './MapOverlayShape.js';
import { assetUrl } from '../lib/assets.js';
import { MAP_DROP_KINDS, libraryDragType } from '../lib/libraryDrag.js';
import { isFogPolygon, type MapOverlayDTO, type SceneFogDTO } from '@tabletop/shared';

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
  fogTool: FogTool; // pincel à mão livre, por célula ou polígono
  brushSize: number; // raio do pincel livre (px da cena)
  onFogPaint: (cells: string[], mode: 'reveal' | 'hide') => void;
  onFogBrush: (dots: { x: number; y: number; r: number }[], mode: 'reveal' | 'hide') => void;
  /** polígono fechado [x1, y1, x2, y2, ...] em coordenadas da cena */
  onFogPolygon: (points: number[], mode: 'reveal' | 'hide') => void;
  /** token/item da biblioteca solto no mapa: (x, y) é o ponto da cena onde caiu */
  onDropToken?: (tokenId: string, x: number, y: number) => void;
  /** apagar de vez (o Remover das cópias, que não têm lugar na biblioteca) */
  onDeleteToken?: (tokenId: string) => void;
}

export type FogTool = 'brush' | 'cell' | 'polygon';

// Polígono: fecha clicando perto do primeiro ponto (raio em pixels de tela)
const CLOSE_RADIUS_PX = 12;

export function MapEditor({ scene, tokens, overlays, isGm, canEditToken, snap, onTokenChange, onOverlayChange, fog, fogPaintMode, fogTool, brushSize, onFogPaint, onFogBrush, onFogPolygon, onDropToken, onDeleteToken }: Props) {
  const fogBrush = fogTool === 'brush';
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(1);

  // O mapa ocupa todo o espaço da cena: o Stage acompanha o tamanho da área (e da janela)
  const areaRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const area = areaRef.current;
    if (!area) return;
    const observer = new ResizeObserver(([entry]) =>
      setView({ w: Math.floor(entry.contentRect.width), h: Math.floor(entry.contentRect.height) }),
    );
    observer.observe(area);
    return () => observer.disconnect();
  }, []);

  // Ao abrir uma cena: enquadra o mapa inteiro, centralizado (uma vez por cena)
  const framedScene = useRef<string | null>(null);
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !view.w || !view.h || framedScene.current === scene.id) return;
    framedScene.current = scene.id;
    const fit = Math.min(1, (view.w * 0.92) / scene.width, (view.h * 0.86) / scene.height);
    const next = Math.max(0.2, fit);
    stage.scale({ x: next, y: next });
    stage.position({ x: (view.w - scene.width * next) / 2, y: (view.h - scene.height * next) / 2 });
    setScale(next);
  }, [scene.id, scene.width, scene.height, view.w, view.h]);
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

  // ===== Polígono de névoa =====
  // Cada clique marca um ponto; fecha clicando no primeiro (ou duplo clique / Enter).
  // Esc cancela, Backspace desfaz o último ponto.
  const [polygon, setPolygon] = useState<{ x: number; y: number }[]>([]);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const polygonOn = !!fogPaintMode && fogTool === 'polygon';
  const nearFirst = (p: { x: number; y: number }) =>
    polygon.length >= 3 && Math.hypot(p.x - polygon[0].x, p.y - polygon[0].y) <= CLOSE_RADIUS_PX / scale;

  // trocar de ferramenta (ou de esconder/revelar) descarta o polígono pela metade
  useEffect(() => {
    setPolygon([]);
    setHover(null);
  }, [fogPaintMode, fogTool]);

  function finishPolygon(points = polygon) {
    // o duplo clique também marca pontos: tira os repetidos no mesmo lugar
    const clean = points.filter((p, i) => i === 0 || Math.hypot(p.x - points[i - 1].x, p.y - points[i - 1].y) > 1 / scale);
    if (fogPaintMode && clean.length >= 3) onFogPolygon(clean.flatMap((p) => [p.x, p.y]), fogPaintMode);
    setPolygon([]);
  }

  function polygonClick() {
    const p = pointInScene();
    if (!p) return;
    if (nearFirst(p)) finishPolygon();
    else setPolygon((pts) => [...pts, p]);
  }

  useEffect(() => {
    if (!polygonOn) return;
    function onKey(e: KeyboardEvent) {
      if (!polygon.length) return;
      if (e.key === 'Escape') {
        setPolygon([]);
        e.stopImmediatePropagation(); // o primeiro Esc só cancela o polígono, não a ferramenta
      } else if (e.key === 'Enter') {
        finishPolygon();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setPolygon((pts) => pts.slice(0, -1));
      }
    }
    window.addEventListener('keydown', onKey, true); // antes do Esc da cena
    return () => window.removeEventListener('keydown', onKey, true);
  });

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

  // Soltar um token/item arrastado da biblioteca: converte o ponto da tela para o da
  // cena (descontando zoom e arraste do mapa)
  const dropTypes = MAP_DROP_KINDS.map(libraryDragType);
  const accepts = (e: React.DragEvent) => !!onDropToken && dropTypes.some((t) => e.dataTransfer.types.includes(t));
  function onDragOver(e: React.DragEvent) {
    if (!accepts(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  }
  function onDrop(e: React.DragEvent) {
    const stage = stageRef.current;
    if (!stage || !accepts(e)) return;
    const id = dropTypes.map((t) => e.dataTransfer.getData(t)).find(Boolean);
    if (!id) return;
    e.preventDefault();
    stage.setPointersPositions(e.nativeEvent);
    const point = stage.getRelativePointerPosition();
    if (point) onDropToken!(id, point.x, point.y);
  }

  return (
    <div className="map-editor" aria-label="Editor de mapa" ref={areaRef} onDragOver={onDragOver} onDrop={onDrop}>
      <Stage
        ref={stageRef}
        width={view.w || 1}
        height={view.h || 1}
        draggable={!fogPaintMode} // sem pan enquanto pinta névoa
        onWheel={onWheel}
        onMouseDown={(e) => {
          if (polygonOn) {
            polygonClick();
            return;
          }
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
          if (polygonOn) {
            if (polygon.length) setHover(pointInScene());
            return;
          }
          if (fogPaintMode && painting.current) paintAtPointer();
        }}
        onDblClick={() => {
          if (polygonOn) finishPolygon();
        }}
        onMouseUp={() => {
          if (painting.current) flushPaint();
          painting.current = false;
        }}
        style={{ cursor: fogPaintMode ? 'crosshair' : 'grab' }}
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
                zoom={scale}
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
              {fog.brushHide.map((d, i) =>
                isFogPolygon(d) ? (
                  <Line key={`bh-${i}`} points={d.points} closed fill="#05040a" />
                ) : (
                  <Circle key={`bh-${i}`} x={d.x} y={d.y} radius={d.r} fill="#05040a" />
                ),
              )}
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
              {/* FUROS: pincel e polígonos de revelar */}
              {fog.brushReveal.map((d, i) =>
                isFogPolygon(d) ? (
                  <Line key={`br-${i}`} points={d.points} closed fill="#000" globalCompositeOperation="destination-out" />
                ) : (
                  <Circle
                    key={`br-${i}`}
                    x={d.x}
                    y={d.y}
                    radius={d.r}
                    fill="#000"
                    globalCompositeOperation="destination-out"
                  />
                ),
              )}
            </Group>
          </Layer>
        )}
        {/* polígono em andamento: linhas até o mouse, pontos e o primeiro ponto (fecha) */}
        {polygonOn && polygon.length > 0 && (
          <Layer listening={false}>
            <Line
              points={[...polygon, ...(hover ? [hover] : [])].flatMap((p) => [p.x, p.y])}
              closed={polygon.length >= 2}
              fill={fogPaintMode === 'hide' ? 'rgba(5, 4, 10, 0.35)' : 'rgba(255, 255, 255, 0.12)'}
              stroke="#e4bf63"
              strokeWidth={2 / scale}
              dash={[8 / scale, 6 / scale]}
            />
            {polygon.map((p, i) => {
              const closing = i === 0 && hover !== null && nearFirst(hover);
              return (
                <Circle
                  key={i}
                  x={p.x}
                  y={p.y}
                  radius={(i === 0 ? (closing ? 9 : 6) : 4) / scale}
                  fill={i === 0 ? '#e4bf63' : '#ffffff'}
                  stroke="#000000"
                  strokeWidth={1 / scale}
                />
              );
            })}
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
              {hidden ? '🙈 Invisível' : '🙊 Visível'}
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
                // cópia (groupId) não tem lugar na biblioteca: some de vez
                if (selToken?.groupId && onDeleteToken) onDeleteToken(selToken.id);
                else apply({ isOnMap: false });
                setSelectedOverlayId(null);
                setSelectedId(null);
              }}
              title={
                selToken?.groupId
                  ? 'Apaga esta cópia (o original continua na biblioteca)'
                  : 'Tira da tela; continua na biblioteca (clique nele lá para colocar de volta)'
              }
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

import { useRef, useState, useEffect } from 'react';
import { Stage, Layer, Rect, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { SceneDTO, TokenDTO } from '@tabletop/shared';
import { GridLayer } from './GridLayer.js';
import { TokenShape } from './TokenShape.js';
import { MapOverlayShape } from './MapOverlayShape.js';
import { assetUrl } from '../lib/assets.js';
import type { MapOverlayDTO } from '@tabletop/shared';

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
  onOverlayDelete: (overlayId: string) => void;
}

export function MapEditor({ scene, tokens, overlays, isGm, canEditToken, snap, onTokenChange, onOverlayChange, onOverlayDelete }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedOverlayId, setSelectedOverlayId] = useState<string | null>(null);
  const background = useHtmlImage(scene.backgroundUrl ? assetUrl(scene.backgroundUrl) : null);

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
        draggable // pan ao arrastar o fundo
        onWheel={onWheel}
        onMouseDown={(e) => {
          // clicar no fundo (stage) deseleciona
          if (e.target === e.target.getStage()) {
            setSelectedId(null);
            setSelectedOverlayId(null);
          }
        }}
        style={{ background: '#0f0c08', borderRadius: 8, cursor: 'grab' }}
      >
        <Layer>
          <Rect width={scene.width} height={scene.height} fill="#1b140c" />
          {/* CENÁRIO = ambiente ao redor / fundo fixo */}
          {background && (
            <KonvaImage image={background} width={scene.width} height={scene.height} listening={false} />
          )}
          {/* MAPAS = overlays por cima da cena, redimensionáveis pelo GM */}
          {overlays.map((o) => (
            <MapOverlayShape
              key={o.id}
              overlay={o}
              selected={selectedOverlayId === o.id}
              editable={isGm}
              onSelect={() => { setSelectedOverlayId(o.id); setSelectedId(null); }}
              onChange={(data) => onOverlayChange(o.id, data)}
            />
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
      </Stage>
      {isGm && selectedOverlayId && (
        <div className="map-overlay-ctl">
          <span className="muted">Mapa selecionado</span>
          <button
            className="btn ghost sm"
            onClick={() => {
              onOverlayDelete(selectedOverlayId);
              setSelectedOverlayId(null);
            }}
          >
            🗑 Remover mapa
          </button>
        </div>
      )}
      <div className="map-hud muted">
        zoom {(scale * 100).toFixed(0)}% · arraste o fundo para mover · roda do mouse para zoom{isGm ? ' · clique num mapa para esticá-lo' : ''}
      </div>
    </div>
  );
}

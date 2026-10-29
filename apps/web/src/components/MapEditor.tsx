import { useRef, useState } from 'react';
import { Stage, Layer, Rect } from 'react-konva';
import type Konva from 'konva';
import type { SceneDTO, TokenDTO } from '@tabletop/shared';
import { GridLayer } from './GridLayer.js';
import { TokenShape } from './TokenShape.js';
import { snapToGrid } from '../lib/scenes.js';

interface Props {
  scene: SceneDTO;
  tokens: TokenDTO[];
  canEditToken: (t: TokenDTO) => boolean;
  snap: boolean;
  onTokenChange: (tokenId: string, data: Partial<TokenDTO>) => void;
}

export function MapEditor({ scene, tokens, canEditToken, snap, onTokenChange }: Props) {
  const stageRef = useRef<Konva.Stage>(null);
  const [scale, setScale] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
          if (e.target === e.target.getStage()) setSelectedId(null);
        }}
        style={{ background: '#0f0c08', borderRadius: 8, cursor: 'grab' }}
      >
        <Layer>
          <Rect width={scene.width} height={scene.height} fill="#1b140c" />
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
                onSelect={() => setSelectedId(t.id)}
                onDragEnd={(x, y) => {
                  const p = snapToGrid(x, y, scene.gridSize, snap && scene.gridType === 'SQUARE');
                  onTokenChange(t.id, p);
                }}
                onTransformEnd={(attrs) => onTokenChange(t.id, attrs)}
              />
            );
          })}
        </Layer>
      </Stage>
      <div className="map-hud muted">
        zoom {(scale * 100).toFixed(0)}% · arraste o fundo para mover · roda do mouse para zoom
      </div>
    </div>
  );
}

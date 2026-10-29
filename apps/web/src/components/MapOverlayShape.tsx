import { useRef, useEffect, useState } from 'react';
import { Group, Rect, Image as KonvaImage, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { MapOverlayDTO } from '@tabletop/shared';
import { assetUrl } from '../lib/assets.js';

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
  overlay: MapOverlayDTO;
  selected: boolean;
  editable: boolean; // só GM edita
  onSelect: () => void;
  onChange: (attrs: Partial<MapOverlayDTO>) => void;
}

// Mapa posicionado sobre a cena. O GM pode arrastar e esticar (Transformer);
// o jogador apenas vê. Fica entre o fundo (cena) e os tokens no z-order.
export function MapOverlayShape({ overlay, selected, editable, onSelect, onChange }: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const image = useHtmlImage(overlay.imageUrl ? assetUrl(overlay.imageUrl) : null);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selected && editable && groupRef.current) {
      tr.nodes([groupRef.current]);
    } else {
      tr.nodes([]);
    }
    tr.getLayer()?.batchDraw();
  }, [selected, editable]);

  return (
    <>
      <Group
        ref={groupRef}
        x={overlay.x}
        y={overlay.y}
        rotation={overlay.rotation}
        opacity={overlay.opacity}
        draggable={editable && !overlay.isLocked}
        onClick={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          onChange({ x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = groupRef.current!;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            x: node.x(),
            y: node.y(),
            width: Math.max(20, overlay.width * scaleX),
            height: Math.max(20, overlay.height * scaleY),
            rotation: node.rotation(),
          });
        }}
      >
        {image ? (
          <KonvaImage image={image} width={overlay.width} height={overlay.height} />
        ) : (
          <Rect
            width={overlay.width}
            height={overlay.height}
            fill="rgba(80,110,160,0.18)"
            stroke="#6a8cc0"
            dash={[8, 6]}
          />
        )}
        {selected && editable && (
          <Rect width={overlay.width} height={overlay.height} stroke="#6db1e4" strokeWidth={2} listening={false} />
        )}
      </Group>
      {selected && editable && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 20 || newBox.height < 20 ? oldBox : newBox)}
        />
      )}
    </>
  );
}

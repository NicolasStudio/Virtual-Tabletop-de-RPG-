import { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text, Transformer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { TokenDTO } from '@tabletop/shared';

// hook simples: carrega um HTMLImageElement a partir de uma URL (ou null)
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
  token: TokenDTO;
  selected: boolean;
  draggable: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (attrs: { x: number; y: number; width: number; height: number; rotation: number }) => void;
}

export function TokenShape({ token, selected, draggable, onSelect, onDragEnd, onTransformEnd }: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const image = useHtmlImage(token.imageUrl);

  useEffect(() => {
    if (selected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [selected]);

  return (
    <>
      <Group
        ref={groupRef}
        x={token.x}
        y={token.y}
        rotation={token.rotation}
        draggable={draggable}
        opacity={token.isHidden ? 0.5 : 1}
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => onDragEnd(e.target.x(), e.target.y())}
        onTransformEnd={() => {
          const node = groupRef.current!;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onTransformEnd({
            x: node.x(),
            y: node.y(),
            width: Math.max(10, token.width * scaleX),
            height: Math.max(10, token.height * scaleY),
            rotation: node.rotation(),
          });
        }}
      >
        {image ? (
          <>
            <KonvaImage image={image} width={token.width} height={token.height} cornerRadius={6} />
            <Rect
              width={token.width}
              height={token.height}
              cornerRadius={6}
              stroke={selected ? '#e4bf63' : '#c9a24b'}
              strokeWidth={selected ? 3 : 1.5}
              listening={false}
            />
          </>
        ) : (
          <>
            <Rect
              width={token.width}
              height={token.height}
              cornerRadius={6}
              fill="#3a2d1a"
              stroke={selected ? '#e4bf63' : '#c9a24b'}
              strokeWidth={selected ? 3 : 1.5}
            />
            <Text
              text={token.name}
              width={token.width}
              align="center"
              y={token.height / 2 - 7}
              fill="#ece3d2"
              fontSize={13}
              listening={false}
            />
          </>
        )}
        {token.isLocked && (
          <Text text="🔒" x={token.width - 16} y={2} fontSize={12} listening={false} />
        )}
      </Group>
      {selected && draggable && (
        <Transformer
          ref={trRef}
          rotateEnabled
          keepRatio={false}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
        />
      )}
    </>
  );
}

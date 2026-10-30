import { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text, Transformer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { TokenDTO } from '@tabletop/shared';
import { selectionGlow, transformerStyle } from './selectionStyle.js';

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
  gridSize: number;
  snap: boolean;
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (attrs: { x: number; y: number; width: number; height: number; rotation: number }) => void;
}

// arredonda para o canto da célula mais próxima
function snapValue(v: number, grid: number, enabled: boolean): number {
  if (!enabled || grid <= 0) return v;
  return Math.round(v / grid) * grid;
}

export function TokenShape({
  token,
  selected,
  draggable,
  gridSize,
  snap,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const image = useHtmlImage(token.imageUrl);

  useEffect(() => {
    const tr = trRef.current;
    if (!tr) return;
    if (selected && groupRef.current) {
      tr.nodes([groupRef.current]);
    } else {
      tr.nodes([]); // desanexa de nó antigo — evita erro ao soltar sobre outro token
    }
    tr.getLayer()?.batchDraw();
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
        onClick={(e) => {
          e.cancelBubble = true; // não deixa o clique vazar para o stage/token de baixo
          onSelect();
        }}
        onTap={(e) => {
          e.cancelBubble = true;
          onSelect();
        }}
        onDragStart={(e) => {
          e.cancelBubble = true;
        }}
        onDragEnd={(e) => {
          e.cancelBubble = true;
          // snap autoritativo no próprio nó: a posição visual já encaixa na grade
          const sx = snapValue(e.target.x(), gridSize, snap);
          const sy = snapValue(e.target.y(), gridSize, snap);
          e.target.position({ x: sx, y: sy });
          onDragEnd(sx, sy);
        }}
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
            {/* sem moldura: selecionado, ganha um brilho em volta da silhueta */}
            <KonvaImage
              image={image}
              width={token.width}
              height={token.height}
              cornerRadius={6}
              {...(selected ? selectionGlow : {})}
            />
          </>
        ) : (
          <>
            <Rect
              width={token.width}
              height={token.height}
              cornerRadius={6}
              fill="#3a2d1a"
              {...(selected ? selectionGlow : {})}
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
          {...transformerStyle}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
        />
      )}
    </>
  );
}

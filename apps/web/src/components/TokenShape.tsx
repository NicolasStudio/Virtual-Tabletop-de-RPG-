import { useRef, useEffect, useState } from 'react';
import { Group, Rect, Text, Transformer, Image as KonvaImage } from 'react-konva';
import type Konva from 'konva';
import type { TokenDTO } from '@tabletop/shared';
import { GLOW_COLOR, selectionGlow, transformerStyle } from './selectionStyle.js';

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
  zoom: number; // zoom do mapa: o nome do selecionado fica do mesmo tamanho na tela
  onSelect: () => void;
  onDragEnd: (x: number, y: number) => void;
  onTransformEnd: (attrs: { x: number; y: number; width: number; height: number; rotation: number }) => void;
}

// Nome em cima do token selecionado (em pixels de tela, já descontando o zoom)
const NAME_SIZE = 14;
const NAME_GAP = 6; // entre o token e o nome
const NAME_MAX_WIDTH = 320;
// o botão de girar sobe para ficar acima do nome, e não por cima dele
const ROTATE_OFFSET_WITH_NAME = transformerStyle.rotateAnchorOffset + NAME_SIZE + NAME_GAP;

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
  zoom,
  onSelect,
  onDragEnd,
  onTransformEnd,
}: Props) {
  // metade da altura que o token ocupa na tela, já girado: o nome fica logo acima
  const angle = (token.rotation * Math.PI) / 180;
  const halfHeight =
    (Math.abs(token.width * Math.sin(angle)) + Math.abs(token.height * Math.cos(angle))) / 2;
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
        {selected && (
          // nome na cor do brilho; o grupo no centro desfaz o giro do token (fica na horizontal)
          <Group x={token.width / 2} y={token.height / 2} rotation={-token.rotation} listening={false}>
            <Text
              text={token.name}
              width={NAME_MAX_WIDTH / zoom}
              offsetX={NAME_MAX_WIDTH / zoom / 2}
              y={-halfHeight - (NAME_GAP + NAME_SIZE) / zoom}
              align="center"
              wrap="none"
              ellipsis
              fontSize={NAME_SIZE / zoom}
              fontStyle="bold"
              fontFamily="'Segoe UI', system-ui, sans-serif"
              fill={GLOW_COLOR}
              shadowColor="#000000"
              shadowBlur={4 / zoom}
              shadowOpacity={0.9}
            />
          </Group>
        )}
      </Group>
      {selected && draggable && (
        <Transformer
          ref={trRef}
          rotateEnabled
          {...transformerStyle}
          rotateAnchorOffset={ROTATE_OFFSET_WITH_NAME}
          boundBoxFunc={(oldBox, newBox) => (newBox.width < 10 || newBox.height < 10 ? oldBox : newBox)}
        />
      )}
    </>
  );
}

import { Line, RegularPolygon } from 'react-konva';
import type { GridType } from '@tabletop/shared';

interface Props {
  type: GridType;
  size: number;
  width: number;
  height: number;
  color: string;
}

/** Desenha a grade da cena: quadrada (linhas) ou hexagonal (polígonos). */
export function GridLayer({ type, size, width, height, color }: Props) {
  if (type === 'NONE' || size <= 0) return null;

  if (type === 'SQUARE') {
    const lines: JSX.Element[] = [];
    for (let x = 0; x <= width; x += size) {
      lines.push(<Line key={`v${x}`} points={[x, 0, x, height]} stroke={color} strokeWidth={1} opacity={0.35} />);
    }
    for (let y = 0; y <= height; y += size) {
      lines.push(<Line key={`h${y}`} points={[0, y, width, y]} stroke={color} strokeWidth={1} opacity={0.35} />);
    }
    return <>{lines}</>;
  }

  // HEX (flat-top). Aproximação por espaçamento de colunas/linhas.
  const hexes: JSX.Element[] = [];
  const r = size / 2;
  const horiz = r * 1.5;
  const vert = Math.sqrt(3) * r;
  let col = 0;
  for (let cx = r; cx <= width + r; cx += horiz, col++) {
    const offset = col % 2 ? vert / 2 : 0;
    for (let cy = r + offset; cy <= height + r; cy += vert) {
      hexes.push(
        <RegularPolygon
          key={`hex-${cx}-${cy}`}
          x={cx}
          y={cy}
          sides={6}
          radius={r}
          rotation={90}
          stroke={color}
          strokeWidth={1}
          opacity={0.3}
        />,
      );
    }
  }
  return <>{hexes}</>;
}

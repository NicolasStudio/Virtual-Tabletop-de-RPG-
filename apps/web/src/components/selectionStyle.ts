import type Konva from 'konva';

// Visual da seleção de tokens e mapas: em vez do retângulo com quadradinhos do
// Konva, um brilho dourado em volta da silhueta da imagem (sombra sem
// deslocamento: segue a transparência do PNG) e pontos de controle redondos
// com ícone — girar em cima, esticar nas laterais, redimensionar no canto.

const GLOW_COLOR = '#e4bf63';

/** Props da imagem selecionada (KonvaImage / Rect). */
export const selectionGlow = {
  shadowColor: GLOW_COLOR,
  shadowBlur: 8,
  shadowOpacity: 1,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
} as const;

type Icon = 'rotate' | 'left' | 'right' | 'down' | 'corner';

const ICON_BY_ANCHOR: Record<string, Icon> = {
  rotater: 'rotate',
  'middle-left': 'left',
  'middle-right': 'right',
  'bottom-center': 'down',
  'bottom-right': 'corner',
};

function drawIcon(ctx: CanvasRenderingContext2D, icon: Icon, c: number, r: number) {
  const s = r * 0.42; // metade do tamanho do ícone
  ctx.beginPath();
  if (icon === 'rotate') {
    // seta circular: arco quase completo com a ponta no fim
    const a0 = -Math.PI / 2 + 0.5;
    const a1 = a0 + Math.PI * 1.55;
    ctx.arc(c, c, s, a0, a1);
    const ex = c + s * Math.cos(a1);
    const ey = c + s * Math.sin(a1);
    ctx.moveTo(ex - s * 0.55, ey - s * 0.15);
    ctx.lineTo(ex, ey);
    ctx.lineTo(ex + s * 0.1, ey - s * 0.6);
  } else if (icon === 'left' || icon === 'right') {
    // |←  ou  →|
    const d = icon === 'left' ? -1 : 1;
    const bar = c + d * s;
    ctx.moveTo(bar, c - s);
    ctx.lineTo(bar, c + s);
    ctx.moveTo(c - d * s, c);
    ctx.lineTo(bar - d * s * 0.35, c);
    ctx.moveTo(bar - d * s * 0.8, c - s * 0.45);
    ctx.lineTo(bar - d * s * 0.35, c);
    ctx.lineTo(bar - d * s * 0.8, c + s * 0.45);
  } else if (icon === 'down') {
    // seta para baixo até a barra
    const bar = c + s;
    ctx.moveTo(c - s, bar);
    ctx.lineTo(c + s, bar);
    ctx.moveTo(c, c - s);
    ctx.lineTo(c, bar - s * 0.35);
    ctx.moveTo(c - s * 0.45, bar - s * 0.8);
    ctx.lineTo(c, bar - s * 0.35);
    ctx.lineTo(c + s * 0.45, bar - s * 0.8);
  } else {
    // ↖↘ na diagonal
    ctx.moveTo(c - s, c - s);
    ctx.lineTo(c + s, c + s);
    ctx.moveTo(c - s, c - s * 0.2);
    ctx.lineTo(c - s, c - s);
    ctx.lineTo(c - s * 0.2, c - s);
    ctx.moveTo(c + s, c + s * 0.2);
    ctx.lineTo(c + s, c + s);
    ctx.lineTo(c + s * 0.2, c + s);
  }
  ctx.stroke();
}

function styleAnchor(anchor: Konva.Rect) {
  const icon = Object.entries(ICON_BY_ANCHOR).find(([name]) => anchor.hasName(name))?.[1];
  if (!icon) return;
  anchor.cornerRadius(anchor.width() / 2);
  anchor.sceneFunc((konvaCtx, shape) => {
    const ctx = konvaCtx._context;
    const size = shape.width();
    const c = size / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(c, c, c - 1, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(28, 28, 32, 0.88)';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 6;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.stroke();
    ctx.lineWidth = 1.8;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#ffffff';
    drawIcon(ctx, icon, c, c);
    ctx.restore();
  });
  // área de clique = o círculo inteiro
  anchor.hitFunc((ctx, shape) => {
    const c = shape.width() / 2;
    ctx.beginPath();
    ctx.arc(c, c, c, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStrokeShape(shape);
  });
}

/** Props do <Transformer> de tokens e mapas. */
export const transformerStyle = {
  borderEnabled: false, // a borda é o brilho em volta da imagem
  enabledAnchors: ['middle-left', 'middle-right', 'bottom-center', 'bottom-right'],
  keepRatio: true, // o canto mantém a proporção; laterais e base esticam um lado só
  anchorSize: 26,
  anchorFill: '#1c1c20',
  anchorStroke: 'transparent',
  rotateAnchorOffset: 34,
  anchorStyleFunc: styleAnchor,
} satisfies Partial<Konva.TransformerConfig>;

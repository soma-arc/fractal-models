import type { Fractal2D, FractalParams, ColorParams } from '../types/fractal.ts';

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

type Vec2 = [number, number];

interface KochTri {
  top: Vec2;
  bottomLeft: Vec2;
  bottomRight: Vec2;
}

function add2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] + b[0], a[1] + b[1]];
}

function sub2(a: Vec2, b: Vec2): Vec2 {
  return [a[0] - b[0], a[1] - b[1]];
}

function scale2(a: Vec2, s: number): Vec2 {
  return [a[0] * s, a[1] * s];
}

function drawTriangle(
  ctx: CanvasRenderingContext2D,
  tri: KochTri,
  color: string,
): void {
  ctx.beginPath();
  ctx.moveTo(tri.top[0], tri.top[1]);
  ctx.lineTo(tri.bottomLeft[0], tri.bottomLeft[1]);
  ctx.lineTo(tri.bottomRight[0], tri.bottomRight[1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function drawTriangleTexture(
  ctx: CanvasRenderingContext2D,
  tri: KochTri,
  img: HTMLImageElement,
): void {
  const [ax, ay] = tri.top;
  const [bx, by] = tri.bottomLeft;
  const [cx, cy] = tri.bottomRight;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.clip();

  const iw = img.width;
  const ih = img.height;
  // src: top=(0,0), bottomLeft=(0,ih), bottomRight=(iw,ih)
  const e = ax, f = ay;
  const c = (bx - ax) / ih;
  const d = (by - ay) / ih;
  const a = (cx - ax - c * ih) / iw;
  const b = (cy - ay - d * ih) / iw;

  ctx.transform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);
  ctx.restore();
}

function getColor(
  color: ColorParams,
  depth: number,
  maxDepth: number,
  tri: KochTri,
  size: number,
): string {
  if (color.mode === 'solid') return color.solidColor;
  if (color.mode === 'gradient') {
    let t: number;
    if (color.gradDir === 'depth') {
      t = maxDepth === 0 ? 0 : depth / maxDepth;
    } else if (color.gradDir === 'vertical') {
      const cy = (tri.top[1] + tri.bottomLeft[1] + tri.bottomRight[1]) / 3;
      t = cy / size;
    } else {
      const cx = (tri.top[0] + tri.bottomLeft[0] + tri.bottomRight[0]) / 3;
      t = cx / size;
    }
    return lerpColor(color.gradStart, color.gradEnd, Math.max(0, Math.min(1, t)));
  }
  return color.solidColor;
}

function split(
  ctx: CanvasRenderingContext2D,
  top: Vec2,
  bottomLeft: Vec2,
  bottomRight: Vec2,
  depth: number,
  maxDepth: number,
  color: ColorParams,
  size: number,
): void {
  if (depth === maxDepth) {
    const tri: KochTri = { top, bottomLeft, bottomRight };
    if (color.mode === 'texture' && color.textureImage) {
      drawTriangleTexture(ctx, tri, color.textureImage);
    } else {
      const c = getColor(color, depth, maxDepth, tri, size);
      drawTriangle(ctx, tri, c);
    }
    return;
  }

  // 底辺を3等分
  const v = scale2(sub2(bottomRight, bottomLeft), 1 / 3);
  const bottomMidLeft: Vec2 = add2(bottomLeft, v);
  const bottomMidRight: Vec2 = add2(bottomMidLeft, v);

  split(ctx, bottomMidLeft, top, bottomLeft, depth + 1, maxDepth, color, size);
  split(ctx, bottomMidRight, top, bottomRight, depth + 1, maxDepth, color, size);
}

export const koch2d: Fractal2D = {
  id: 'koch2d',
  label: 'コッホ曲線（2D）',
  maxDepth: 20,
  warnDepth: 16,

  render(ctx: CanvasRenderingContext2D, size: number, params: FractalParams): void {
    // 参考実装 renderKoch.pde と同じ初期三角形設定
    const topX = size / 2;
    const topY = size / 2;
    const baseY = topY + size / (2 * Math.sqrt(3));

    const top: Vec2 = [topX, topY];
    const bottomLeft: Vec2 = [0, baseY];
    const bottomRight: Vec2 = [size, baseY];

    split(ctx, top, bottomLeft, bottomRight, 0, params.depth, params.color, size);
  },
};

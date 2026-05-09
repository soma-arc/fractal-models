import type { Fractal2D, FractalParams, ColorParams } from '../types/fractal.ts';

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return [r, g, b];
}

function lerpColor(c1: string, c2: string, t: number): string {
  const [r1, g1, b1] = hexToRgb(c1);
  const [r2, g2, b2] = hexToRgb(c2);
  const r = Math.round(r1 + (r2 - r1) * t);
  const g = Math.round(g1 + (g2 - g1) * t);
  const b = Math.round(b1 + (b2 - b1) * t);
  return `rgb(${r},${g},${b})`;
}

interface Triangle {
  top: [number, number];
  left: [number, number];
  right: [number, number];
}

function midpoint(a: [number, number], b: [number, number]): [number, number] {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

function fillTriangle(
  ctx: CanvasRenderingContext2D,
  tri: Triangle,
  color: string,
): void {
  ctx.beginPath();
  ctx.moveTo(tri.top[0], tri.top[1]);
  ctx.lineTo(tri.left[0], tri.left[1]);
  ctx.lineTo(tri.right[0], tri.right[1]);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

function fillTriangleTexture(
  ctx: CanvasRenderingContext2D,
  tri: Triangle,
  img: HTMLImageElement,
): void {
  const [ax, ay] = tri.top;
  const [bx, by] = tri.left;
  const [cx, cy] = tri.right;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(ax, ay);
  ctx.lineTo(bx, by);
  ctx.lineTo(cx, cy);
  ctx.closePath();
  ctx.clip();

  // アフィン変換でテクスチャを三角形全体にマッピング
  // src: top=(0,0), bottomLeft=(0,ih), bottomRight=(iw,ih)
  const iw = img.width;
  const ih = img.height;
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
  tri: Triangle,
  size: number,
): string {
  if (color.mode === 'solid') return color.solidColor;

  if (color.mode === 'gradient') {
    let t: number;
    if (color.gradDir === 'depth') {
      t = maxDepth === 0 ? 0 : depth / maxDepth;
    } else if (color.gradDir === 'vertical') {
      const cy = (tri.top[1] + tri.left[1] + tri.right[1]) / 3;
      t = cy / size;
    } else {
      const cx = (tri.top[0] + tri.left[0] + tri.right[0]) / 3;
      t = cx / size;
    }
    return lerpColor(color.gradStart, color.gradEnd, Math.max(0, Math.min(1, t)));
  }

  return color.solidColor;
}

function recurse(
  ctx: CanvasRenderingContext2D,
  tri: Triangle,
  currentDepth: number,
  maxDepth: number,
  color: ColorParams,
  size: number,
): void {
  if (currentDepth === maxDepth) {
    if (color.mode === 'texture' && color.textureImage) {
      fillTriangleTexture(ctx, tri, color.textureImage);
    } else {
      const c = getColor(color, currentDepth, maxDepth, tri, size);
      fillTriangle(ctx, tri, c);
    }
    return;
  }

  // 3辺の中点を求める
  const topLeft = midpoint(tri.top, tri.left);
  const topRight = midpoint(tri.top, tri.right);
  const leftRight = midpoint(tri.left, tri.right);

  // 4分割のうち中央（ホール）を除く3つを再帰
  recurse(ctx, { top: tri.top, left: topLeft, right: topRight }, currentDepth + 1, maxDepth, color, size);
  recurse(ctx, { top: topLeft, left: tri.left, right: leftRight }, currentDepth + 1, maxDepth, color, size);
  recurse(ctx, { top: topRight, left: leftRight, right: tri.right }, currentDepth + 1, maxDepth, color, size);
}

export const sierpinski2d: Fractal2D = {
  id: 'sierpinski2d',
  label: 'シェルピンスキーのギャスケット（2D）',
  maxDepth: 10,
  warnDepth: 999,

  render(ctx: CanvasRenderingContext2D, size: number, params: FractalParams): void {
    const margin = size * 0.05;
    const h = (size - margin * 2) * (Math.sqrt(3) / 2);
    const cx = size / 2;
    const topY = (size - h) / 2;
    const bottomY = topY + h;

    const tri: Triangle = {
      top: [cx, topY],
      left: [cx - (size - margin * 2) / 2, bottomY],
      right: [cx + (size - margin * 2) / 2, bottomY],
    };

    recurse(ctx, tri, 0, params.depth, params.color, size);
  },
};

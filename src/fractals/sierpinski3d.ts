import type { Fractal3D, Fractal3DGeometry, FractalParams, ColorParams } from '../types/fractal.ts';

type Vec3 = [number, number, number];

function midVec3(a: Vec3, b: Vec3): Vec3 {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
}

function hexToRgb(hex: string): Vec3 {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}

function lerpColor3(c1: Vec3, c2: Vec3, t: number): Vec3 {
  return [
    c1[0] + (c2[0] - c1[0]) * t,
    c1[1] + (c2[1] - c1[1]) * t,
    c1[2] + (c2[2] - c1[2]) * t,
  ];
}

interface Tetra {
  top: Vec3;
  bl: Vec3;  // bottomLeft
  br: Vec3;  // bottomRight
  bb: Vec3;  // bottomBack
}

function getVertexColor(
  v: Vec3,
  depth: number,
  maxDepth: number,
  color: ColorParams,
  bounds: { minY: number; maxY: number; minX: number; maxX: number },
): Vec3 {
  if (color.mode === 'solid') return hexToRgb(color.solidColor);
  const c1 = hexToRgb(color.gradStart);
  const c2 = hexToRgb(color.gradEnd);
  let t: number;
  if (color.gradDir === 'depth') {
    t = maxDepth === 0 ? 0 : depth / maxDepth;
  } else if (color.gradDir === 'vertical') {
    const span = bounds.maxY - bounds.minY;
    t = span === 0 ? 0 : (v[1] - bounds.minY) / span;
  } else {
    const span = bounds.maxX - bounds.minX;
    t = span === 0 ? 0 : (v[0] - bounds.minX) / span;
  }
  return lerpColor3(c1, c2, Math.max(0, Math.min(1, t)));
}

function pushFace(
  positions: number[],
  colors: number[],
  a: Vec3, b: Vec3, c: Vec3,
  depth: number,
  maxDepth: number,
  color: ColorParams,
  bounds: { minY: number; maxY: number; minX: number; maxX: number },
): void {
  for (const v of [a, b, c]) {
    positions.push(v[0], v[1], v[2]);
    const col = getVertexColor(v, depth, maxDepth, color, bounds);
    colors.push(col[0], col[1], col[2]);
  }
}

function recurse(
  tetra: Tetra,
  depth: number,
  maxDepth: number,
  color: ColorParams,
  bounds: { minY: number; maxY: number; minX: number; maxX: number },
  positions: number[],
  colors: number[],
): void {
  if (depth === maxDepth) {
    const { top, bl, br, bb } = tetra;
    // 4面の三角形を追加（CCW ワインディング＝外向き法線）
    pushFace(positions, colors, top, bl, br, depth, maxDepth, color, bounds); // 底面: N=-y ✓
    pushFace(positions, colors, top, br, bb, depth, maxDepth, color, bounds); // 右面: N=(-9,2√3,-3√3) ✓
    pushFace(positions, colors, top, bb, bl, depth, maxDepth, color, bounds); // 左面: N=(9,2√3,-3√3) ✓
    pushFace(positions, colors, bl, bb, br, depth, maxDepth, color, bounds); // 背面: N=(0,2√3,6√3) ✓
    return;
  }

  const { top, bl, br, bb } = tetra;
  const topBl = midVec3(top, bl);
  const topBr = midVec3(top, br);
  const topBb = midVec3(top, bb);
  const blBr = midVec3(bl, br);
  const blBb = midVec3(bl, bb);
  const brBb = midVec3(br, bb);

  recurse({ top, bl: topBl, br: topBr, bb: topBb }, depth + 1, maxDepth, color, bounds, positions, colors);
  recurse({ top: topBl, bl, br: blBr, bb: blBb }, depth + 1, maxDepth, color, bounds, positions, colors);
  recurse({ top: topBr, bl: blBr, br, bb: brBb }, depth + 1, maxDepth, color, bounds, positions, colors);
  recurse({ top: topBb, bl: blBb, br: brBb, bb }, depth + 1, maxDepth, color, bounds, positions, colors);
}

export const sierpinski3d: Fractal3D = {
  id: 'sierpinski3d',
  label: 'シェルピンスキーの四面体（3D）',
  maxDepth: 8,

  build(params: FractalParams): Fractal3DGeometry {
    const s = Math.sqrt(3);
    const tetra: Tetra = {
      top:  [0, -1, -2],
      bl:   [s, -1,  1],
      br:   [-s, -1, 1],
      bb:   [0,  2,  0],
    };

    const bounds = {
      minY: -1, maxY: 2,
      minX: -s, maxX: s,
    };

    const positions: number[] = [];
    const colors: number[] = [];

    recurse(tetra, 0, params.depth, params.color, bounds, positions, colors);

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
    };
  },
};

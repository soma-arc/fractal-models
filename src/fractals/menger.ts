import type { Fractal3D, Fractal3DGeometry, FractalParams, ColorParams } from '../types/fractal.ts';

type Vec3 = [number, number, number];

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

// 立方体の6面×2三角形＝12三角形の頂点オフセット (単位キューブ)
const CUBE_TRIS: Array<[Vec3, Vec3, Vec3]> = [
  // +X
  [[1,0,0],[1,1,0],[1,1,1]], [[1,0,0],[1,1,1],[1,0,1]],
  // -X
  [[0,0,0],[0,1,1],[0,1,0]], [[0,0,0],[0,0,1],[0,1,1]],
  // +Y
  [[0,1,0],[0,1,1],[1,1,1]], [[0,1,0],[1,1,1],[1,1,0]],
  // -Y
  [[0,0,0],[1,0,0],[1,0,1]], [[0,0,0],[1,0,1],[0,0,1]],
  // +Z
  [[0,0,1],[1,0,1],[1,1,1]], [[0,0,1],[1,1,1],[0,1,1]],
  // -Z
  [[0,0,0],[0,1,0],[1,1,0]], [[0,0,0],[1,1,0],[1,0,0]],
];

function getColor(
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

function pushCube(
  positions: number[],
  colors: number[],
  cx: number, cy: number, cz: number,
  size: number,
  depth: number,
  maxDepth: number,
  color: ColorParams,
  bounds: { minY: number; maxY: number; minX: number; maxX: number },
): void {
  for (const [a, b, c] of CUBE_TRIS) {
    for (const v of [a, b, c]) {
      const wx = cx + v[0] * size;
      const wy = cy + v[1] * size;
      const wz = cz + v[2] * size;
      positions.push(wx, wy, wz);
      const col = getColor([wx, wy, wz], depth, maxDepth, color, bounds);
      colors.push(col[0], col[1], col[2]);
    }
  }
}

function recurse(
  cx: number, cy: number, cz: number,
  size: number,
  depth: number,
  maxDepth: number,
  color: ColorParams,
  bounds: { minY: number; maxY: number; minX: number; maxX: number },
  positions: number[],
  colors: number[],
): void {
  if (depth === maxDepth) {
    pushCube(positions, colors, cx, cy, cz, size, depth, maxDepth, color, bounds);
    return;
  }

  const s = size / 3;
  // 27マスのうち、各軸で中央になる7マスを除去（メンガースポンジ）
  for (let ix = 0; ix < 3; ix++) {
    for (let iy = 0; iy < 3; iy++) {
      for (let iz = 0; iz < 3; iz++) {
        // 2軸以上が中央(=1)になるセルは穴
        const mid = (ix === 1 ? 1 : 0) + (iy === 1 ? 1 : 0) + (iz === 1 ? 1 : 0);
        if (mid >= 2) continue;
        recurse(
          cx + ix * s,
          cy + iy * s,
          cz + iz * s,
          s,
          depth + 1,
          maxDepth,
          color,
          bounds,
          positions,
          colors,
        );
      }
    }
  }
}

export const menger: Fractal3D = {
  id: 'menger',
  label: 'メンガースポンジ（3D）',
  maxDepth: 4,

  build(params: FractalParams): Fractal3DGeometry {
    const SIZE = 2;
    const OFFSET = -SIZE / 2;
    const bounds = {
      minY: OFFSET, maxY: OFFSET + SIZE,
      minX: OFFSET, maxX: OFFSET + SIZE,
    };

    const positions: number[] = [];
    const colors: number[] = [];

    recurse(OFFSET, OFFSET, OFFSET, SIZE, 0, params.depth, params.color, bounds, positions, colors);

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
    };
  },
};

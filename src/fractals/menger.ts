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

// 各リーフキューブ: CUBE_TRIS.length(12) × 3頂点 × 3値 = 108 floats
const FLOATS_PER_CUBE = CUBE_TRIS.length * 3 * 3;

function pushCube(
  positions: Float32Array,
  colors: Float32Array,
  cur: { i: number },
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
      positions[cur.i] = wx;
      positions[cur.i + 1] = wy;
      positions[cur.i + 2] = wz;
      const col = getColor([wx, wy, wz], depth, maxDepth, color, bounds);
      colors[cur.i] = col[0];
      colors[cur.i + 1] = col[1];
      colors[cur.i + 2] = col[2];
      cur.i += 3;
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
  positions: Float32Array,
  colors: Float32Array,
  cur: { i: number },
): void {
  if (depth === maxDepth) {
    pushCube(positions, colors, cur, cx, cy, cz, size, depth, maxDepth, color, bounds);
    return;
  }

  const s = size / 3;
  // 27マスのうち、2軸以上が中央(=1)になる7マスを除去（メンガースポンジ）
  for (let ix = 0; ix < 3; ix++) {
    for (let iy = 0; iy < 3; iy++) {
      for (let iz = 0; iz < 3; iz++) {
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
          cur,
        );
      }
    }
  }
}

export const menger: Fractal3D = {
  id: 'menger',
  label: 'メンガースポンジ（3D）',
  maxDepth: 10,

  build(params: FractalParams): Fractal3DGeometry {
    const SIZE = 2;
    const OFFSET = -SIZE / 2;
    const bounds = {
      minY: OFFSET, maxY: OFFSET + SIZE,
      minX: OFFSET, maxX: OFFSET + SIZE,
    };

    // リーフキューブ数 = 20^depth（中間配列を経由しない事前確保）
    const leafCount = Math.pow(20, params.depth);
    const totalFloats = leafCount * FLOATS_PER_CUBE;
    const positions = new Float32Array(totalFloats);
    const colors = new Float32Array(totalFloats);
    const cur = { i: 0 };

    recurse(OFFSET, OFFSET, OFFSET, SIZE, 0, params.depth, params.color, bounds, positions, colors, cur);

    return { positions, colors };
  },
};

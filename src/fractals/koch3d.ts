import type { Fractal3D, Fractal3DGeometry, FractalParams, ColorParams } from '../types/fractal.ts';

type Vec3 = [number, number, number];

// ---- ベクトル演算 ----
function add3(a: Vec3, b: Vec3): Vec3 { return [a[0]+b[0], a[1]+b[1], a[2]+b[2]]; }
function sub3(a: Vec3, b: Vec3): Vec3 { return [a[0]-b[0], a[1]-b[1], a[2]-b[2]]; }
function scale3(a: Vec3, s: number): Vec3 { return [a[0]*s, a[1]*s, a[2]*s]; }
function normalize3(u: Vec3): Vec3 {
  const m = Math.sqrt(u[0]*u[0]+u[1]*u[1]+u[2]*u[2]);
  return m === 0 ? [0,0,0] : [u[0]/m, u[1]/m, u[2]/m];
}
function center3(pts: Vec3[]): Vec3 {
  const n = pts.length;
  let x=0, y=0, z=0;
  for (const p of pts) { x+=p[0]; y+=p[1]; z+=p[2]; }
  return [x/n, y/n, z/n];
}
function rot3(a: Vec3, u: Vec3, t: number): Vec3 {
  const [x,y,z] = a;
  const ct = Math.cos(t), st = Math.sin(t);
  const [ux,uy,uz] = normalize3(u);
  return [
    (ct+ux*ux*(1-ct))*x + (ux*uy*(1-ct)-uz*st)*y + (ux*uz*(1-ct)+uy*st)*z,
    (uy*ux*(1-ct)+uz*st)*x + (ct+uy*uy*(1-ct))*y + (uy*uz*(1-ct)-ux*st)*z,
    (uz*ux*(1-ct)-uy*st)*x + (uz*uy*(1-ct)+ux*st)*y + (ct+uz*uz*(1-ct))*z,
  ];
}

// 参考実装 koch3d.js の trans 関数と同等
function trans(base: Vec3, centert: Vec3, coordt: Vec3[]): Vec3[] {
  const axis = sub3(centert, base);
  return coordt.map(v => {
    const pos = sub3(v, base);
    return add3(base, scale3(rot3(pos, axis, Math.PI/2), 2/3));
  });
}

// 正三角形ベースの二重四面体の頂点 (参考実装 coord0 に対応)
const s3 = Math.sqrt(3) / 2;
const t3 = 1 / Math.sqrt(3);
const COORD0: Vec3[] = [
  [0, 0, -t3],
  [0, 1, 0],
  [s3, -0.5, 0],
  [-s3, -0.5, 0],
  [0, 0, t3],
];

// 面インデックス (参考実装 coordIndex0 に対応)
const FACE0: Array<[number, number, number]> = [
  [0,1,2], [0,2,3], [0,3,1],
  [4,2,1], [4,3,2], [4,1,3],
];

function hexToRgb(hex: string): Vec3 {
  return [
    parseInt(hex.slice(1, 3), 16) / 255,
    parseInt(hex.slice(3, 5), 16) / 255,
    parseInt(hex.slice(5, 7), 16) / 255,
  ];
}
function lerpColor3(c1: Vec3, c2: Vec3, t: number): Vec3 {
  return [c1[0]+(c2[0]-c1[0])*t, c1[1]+(c2[1]-c1[1])*t, c1[2]+(c2[2]-c1[2])*t];
}

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

function recurse(
  coordt: Vec3[],
  depth: number,
  maxDepth: number,
  color: ColorParams,
  bounds: { minY: number; maxY: number; minX: number; maxX: number },
  positions: number[],
  colors: number[],
): void {
  if (depth === 0) {
    for (const [i0, i1, i2] of FACE0) {
      for (const v of [coordt[i0], coordt[i1], coordt[i2]]) {
        positions.push(v[0], v[1], v[2]);
        const col = getColor(v, maxDepth - depth, maxDepth, color, bounds);
        colors.push(col[0], col[1], col[2]);
      }
    }
    return;
  }

  const ct = center3(coordt);
  recurse(trans(coordt[1], ct, coordt), depth-1, maxDepth, color, bounds, positions, colors);
  recurse(trans(coordt[2], ct, coordt), depth-1, maxDepth, color, bounds, positions, colors);
  recurse(trans(coordt[3], ct, coordt), depth-1, maxDepth, color, bounds, positions, colors);
}

export const koch3d: Fractal3D = {
  id: 'koch3d',
  label: 'コッホ曲線 三次元版（3D）',
  maxDepth: 8,

  build(params: FractalParams): Fractal3DGeometry {
    const bounds = { minY: -0.5, maxY: 1, minX: -s3, maxX: s3 };
    const positions: number[] = [];
    const colors: number[] = [];

    recurse(COORD0, params.depth, params.depth, params.color, bounds, positions, colors);

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
    };
  },
};

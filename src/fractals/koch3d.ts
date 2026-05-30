import type {
  Fractal3D,
  Fractal3DGeometry,
  FractalParams,
  ColorParams,
  Koch3DMode,
} from '../types/fractal.ts';

type Vec3 = [number, number, number];

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

const SKEW_COORD0: Vec3[] = [
  [0.12, -0.06, -t3 * 0.72],
  [0, 1, 0],
  [s3, -0.5, 0],
  [-s3, -0.5, 0],
  [-0.08, 0.04, t3 * 1.22],
];

const FACE0: Array<[number, number, number]> = [
  [0,1,2], [0,2,3], [0,3,1],
  [4,2,1], [4,3,2], [4,1,3],
];

const ASYMMETRIC_FACE0: Array<[number, number, number]> = [
  [0,1,2], [0,2,3], [0,3,1],
  [4,2,1], [4,1,3],
];

const VALID_MODES = new Set<Koch3DMode>([
  'classic',
  'skew-bipyramid',
  'skew-mirror',
  'asymmetric-faces',
]);

function getKoch3DMode(params: FractalParams): Koch3DMode {
  const mode = params.koch3d?.mode;
  return mode && VALID_MODES.has(mode) ? mode : 'classic';
}

function trans(base: Vec3, centert: Vec3, coordt: Vec3[], angle: number): Vec3[] {
  const axis = sub3(centert, base);
  return coordt.map(v => {
    const pos = sub3(v, base);
    return add3(base, scale3(rot3(pos, axis, angle), 2/3));
  });
}

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

interface Replacement {
  anchorIndex: number;
  angle: number;
}

interface KochRule {
  coord: Vec3[];
  face: Array<[number, number, number]>;
  replacements: Replacement[];
  bounds: { minY: number; maxY: number; minX: number; maxX: number };
}

function getKochRule(mode: Koch3DMode): KochRule {
  const right = Math.PI / 2;
  const left = -Math.PI / 2;
  const classicReplacements = [
    { anchorIndex: 1, angle: right },
    { anchorIndex: 2, angle: right },
    { anchorIndex: 3, angle: right },
  ];
  const bounds = { minY: -0.5, maxY: 1, minX: -s3, maxX: s3 };

  if (mode === 'skew-bipyramid') {
    return {
      coord: SKEW_COORD0,
      face: FACE0,
      replacements: classicReplacements,
      bounds,
    };
  }

  if (mode === 'skew-mirror') {
    return {
      coord: SKEW_COORD0,
      face: FACE0,
      replacements: [
        { anchorIndex: 1, angle: right },
        { anchorIndex: 2, angle: left },
        { anchorIndex: 3, angle: right },
      ],
      bounds,
    };
  }

  if (mode === 'asymmetric-faces') {
    return {
      coord: COORD0,
      face: ASYMMETRIC_FACE0,
      replacements: classicReplacements,
      bounds,
    };
  }

  return {
    coord: COORD0,
    face: FACE0,
    replacements: classicReplacements,
    bounds,
  };
}

function emitShape(
  coordt: Vec3[],
  face: Array<[number, number, number]>,
  emittedDepth: number,
  maxDepth: number,
  color: ColorParams,
  bounds: { minY: number; maxY: number; minX: number; maxX: number },
  positions: number[],
  colors: number[],
): void {
  for (const [i0, i1, i2] of face) {
    for (const v of [coordt[i0], coordt[i1], coordt[i2]]) {
      positions.push(v[0], v[1], v[2]);
      const col = getColor(v, emittedDepth, maxDepth, color, bounds);
      colors.push(col[0], col[1], col[2]);
    }
  }
}

function recurse(
  coordt: Vec3[],
  rule: KochRule,
  depth: number,
  maxDepth: number,
  color: ColorParams,
  positions: number[],
  colors: number[],
): void {
  if (depth === 0) {
    emitShape(coordt, rule.face, maxDepth - depth, maxDepth, color, rule.bounds, positions, colors);
    return;
  }

  const ct = center3(coordt);
  for (const replacement of rule.replacements) {
    recurse(
      trans(coordt[replacement.anchorIndex], ct, coordt, replacement.angle),
      rule,
      depth-1,
      maxDepth,
      color,
      positions,
      colors,
    );
  }
}

export const koch3d: Fractal3D = {
  id: 'koch3d',
  label: 'コッホ曲線 三次元版（3D）',
  maxDepth: 10,

  build(params: FractalParams): Fractal3DGeometry {
    const rule = getKochRule(getKoch3DMode(params));
    const positions: number[] = [];
    const colors: number[] = [];

    recurse(rule.coord, rule, params.depth, params.depth, params.color, positions, colors);

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
    };
  },
};

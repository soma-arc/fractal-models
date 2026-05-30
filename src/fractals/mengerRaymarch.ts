import type { Fractal3D, Fractal3DGeometry } from '../types/fractal.ts';

export const mengerRaymarch: Fractal3D = {
  id: 'menger-raymarch',
  label: 'メンガースポンジ（レイマーチ）',
  maxDepth: 10,

  build(): Fractal3DGeometry {
    return {
      positions: new Float32Array(0),
      colors: new Float32Array(0),
    };
  },
};

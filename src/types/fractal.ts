export type ColorMode = 'solid' | 'gradient' | 'texture';
export type GradientDirection = 'depth' | 'vertical' | 'horizontal';

export interface ColorParams {
  mode: ColorMode;
  solidColor: string;
  gradStart: string;
  gradEnd: string;
  gradDir: GradientDirection;
  textureImage: HTMLImageElement | null;
}

export interface PbrParams {
  metalness: number;
  roughness: number;
  clearcoat: number;
  clearcoatRoughness: number;
  iridescence: number;
  wireframe: boolean;
  lightIntensity: number;
}

export interface FractalParams {
  depth: number;
  color: ColorParams;
  pbr: PbrParams;
}

export interface Fractal2D {
  readonly id: string;
  readonly label: string;
  readonly maxDepth: number;
  readonly warnDepth: number;
  render(ctx: CanvasRenderingContext2D, size: number, params: FractalParams): void;
}

export interface Fractal3DGeometry {
  positions: Float32Array;
  colors: Float32Array;
}

export interface Fractal3D {
  readonly id: string;
  readonly label: string;
  readonly maxDepth: number;
  build(params: FractalParams): Fractal3DGeometry;
}

export type FractalEntry =
  | { kind: '2d'; fractal: Fractal2D }
  | { kind: '3d'; fractal: Fractal3D };

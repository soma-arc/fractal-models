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
  lightAzimuth: number;
  lightElevation: number;
  envIntensity: number;
  fov: number;
  orthographic: boolean;
  verticalCorrection: boolean;
  cameraHeight: number;
  lensShiftY: number;
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

// ---------- プリセット ----------

export interface PresetColorParams {
  mode: Exclude<ColorMode, 'texture'>; // texture は保存対象外
  solidColor: string;
  gradStart: string;
  gradEnd: string;
  gradDir: GradientDirection;
}

export interface PresetCameraParams {
  position: [number, number, number];
  target: [number, number, number];
  fov: number;
  orthographic?: boolean; // 省略時は透視投影
}

export interface PresetV1 {
  version: 1;
  fractalId: string;
  depth: number;
  color: PresetColorParams;
  pbr?: PbrParams;          // 3D のみ
  camera?: PresetCameraParams; // 3D のみ
}

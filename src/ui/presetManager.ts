import type { Koch3DMode, Koch3DParams, PbrParams, PresetV1, PresetColorParams } from '../types/fractal.ts';
import type { UIState } from './controls.ts';
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import type { PerspectiveCamera } from 'three';

const CURRENT_VERSION = 1 as const;

const DEFAULT_PBR: PbrParams = {
  metalness: 0.3,
  roughness: 0.5,
  clearcoat: 0,
  clearcoatRoughness: 0.1,
  iridescence: 0,
  wireframe: false,
  lightIntensity: 1.2,
  lightAzimuth: 45,
  lightElevation: 45,
  envIntensity: 1,
  fov: 45,
  orthographic: false,
  verticalCorrection: false,
  cameraHeight: 2,
  lensShiftY: 0,
};

const DEFAULT_TETRA_COLORS = {
  tetraTop: '#f94144',
  tetraLeft: '#43aa8b',
  tetraRight: '#577590',
  tetraBack: '#f9c74f',
};

const DEFAULT_KOCH3D: Koch3DParams = {
  mode: 'classic',
};

const KOCH3D_MODES = new Set<Koch3DMode>(['classic', 'skew-bipyramid', 'skew-mirror', 'asymmetric-faces']);

function normalizeKoch3DParams(params: Koch3DParams | undefined): Koch3DParams {
  const mode = params?.mode;
  return {
    mode: mode && KOCH3D_MODES.has(mode) ? mode : DEFAULT_KOCH3D.mode,
  };
}

// ---------- 書き出し ----------

export function exportPreset(
  state: UIState,
  camera: PerspectiveCamera | null,
  controls: OrbitControls | null,
): void {
  const { fractalId, params } = state;
  const is3D = !['sierpinski2d', 'koch2d'].includes(fractalId);

  // テクスチャは保存不可 → solid にフォールバック
  const colorMode = params.color.mode === 'texture' ? 'solid' : params.color.mode;
  const presetColor: PresetColorParams = {
    mode: colorMode as PresetColorParams['mode'],
    solidColor: params.color.solidColor,
    gradStart: params.color.gradStart,
    gradEnd: params.color.gradEnd,
    gradDir: params.color.gradDir,
    tetraTop: params.color.tetraTop,
    tetraLeft: params.color.tetraLeft,
    tetraRight: params.color.tetraRight,
    tetraBack: params.color.tetraBack,
  };

  const preset: PresetV1 = {
    version: CURRENT_VERSION,
    fractalId,
    depth: params.depth,
    color: presetColor,
  };

  if (is3D) {
    preset.pbr = { ...params.pbr };
    if (fractalId === 'koch3d') {
      preset.koch3d = normalizeKoch3DParams(params.koch3d);
    }
    if (camera && controls) {
      preset.camera = {
        position: camera.position.toArray() as [number, number, number],
        target: controls.target.toArray() as [number, number, number],
        fov: camera.fov,
        orthographic: params.pbr.orthographic,
      };
    }
  }

  const json = JSON.stringify(preset, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fractalId}-preset.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ---------- 読み込み ----------

export type ImportResult =
  | { ok: true; preset: PresetV1; textureWarning: boolean }
  | { ok: false; error: string };

export function parsePreset(json: string): ImportResult {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return { ok: false, error: 'JSON のパースに失敗しました。' };
  }

  if (typeof data !== 'object' || data === null) {
    return { ok: false, error: '不正なフォーマットです。' };
  }

  const obj = data as Record<string, unknown>;

  if (obj['version'] !== CURRENT_VERSION) {
    return {
      ok: false,
      error: `バージョンが一致しません（expected: ${CURRENT_VERSION}, got: ${obj['version']}）。`,
    };
  }

  // 最低限のフィールド検証
  if (typeof obj['fractalId'] !== 'string') {
    return { ok: false, error: 'fractalId が不正です。' };
  }
  if (typeof obj['depth'] !== 'number') {
    return { ok: false, error: 'depth が不正です。' };
  }
  if (typeof obj['color'] !== 'object' || obj['color'] === null) {
    return { ok: false, error: 'color が不正です。' };
  }

  const preset = data as PresetV1;

  // テクスチャモードが含まれていた場合は solid にフォールバック
  const textureWarning = (preset.color.mode as string) === 'texture';
  if (textureWarning) {
    preset.color.mode = 'solid';
  }
  preset.color = {
    ...DEFAULT_TETRA_COLORS,
    ...preset.color,
  };
  if (preset.pbr) {
    preset.pbr = {
      ...DEFAULT_PBR,
      ...preset.pbr,
      verticalCorrection: preset.pbr.verticalCorrection ?? false,
      cameraHeight: preset.pbr.cameraHeight ?? DEFAULT_PBR.cameraHeight,
      lensShiftY: preset.pbr.lensShiftY ?? DEFAULT_PBR.lensShiftY,
    };
  }
  if (preset.fractalId === 'koch3d') {
    preset.koch3d = normalizeKoch3DParams(preset.koch3d);
  }

  return { ok: true, preset, textureWarning };
}

import { Controls } from './ui/controls.ts';
import { Renderer2D } from './renderer/renderer2d.ts';
import { Renderer3D } from './renderer/renderer3d.ts';
import { sierpinski2d } from './fractals/sierpinski2d.ts';
import { koch2d } from './fractals/koch2d.ts';
import { sierpinski3d } from './fractals/sierpinski3d.ts';
import { menger } from './fractals/menger.ts';
import { koch3d } from './fractals/koch3d.ts';
import type { FractalEntry } from './types/fractal.ts';
import { exportPreset, parsePreset } from './ui/presetManager.ts';

const FRACTALS: Record<string, FractalEntry> = {
  sierpinski2d: { kind: '2d', fractal: sierpinski2d },
  koch2d:       { kind: '2d', fractal: koch2d },
  sierpinski3d: { kind: '3d', fractal: sierpinski3d },
  menger:       { kind: '3d', fractal: menger },
  koch3d:       { kind: '3d', fractal: koch3d },
};

const canvas2d = document.getElementById('canvas2d') as HTMLCanvasElement;
const canvas3d = document.getElementById('canvas3d') as HTMLCanvasElement;

const renderer2d = new Renderer2D(canvas2d);
const renderer3d = new Renderer3D(canvas3d);

let currentIs3D = false;

function showCanvas(is3D: boolean): void {
  if (is3D) {
    canvas2d.style.display = 'none';
    canvas3d.style.display = 'block'; // '' では CSS の display:none が残るため明示的に指定
  } else {
    canvas3d.style.display = 'none';
    canvas2d.style.display = 'block';
    renderer3d.hide();
  }
}

const controls = new Controls({
  onChange(state) {
    const entry = FRACTALS[state.fractalId];
    if (!entry) return;

    const is3D = entry.kind === '3d';

    if (is3D !== currentIs3D) {
      currentIs3D = is3D;
      showCanvas(is3D);
    }

    try {
      if (entry.kind === '2d') {
        renderer2d.render(entry.fractal, state.params);
      } else {
        renderer3d.render(entry.fractal, state.params);
      }
      this.hideError();
    } catch (e) {
      this.showError(
        e instanceof RangeError
          ? 'メモリ不足です。深さを下げてください。'
          : 'レンダリングエラー: ' + String(e),
      );
    }
  },

  async onExport() {
    controls.setExporting(true);
    try {
      const state = controls.getState();
      const entry = FRACTALS[state.fractalId];
      if (!entry) return;

      if (entry.kind === '2d') {
        await renderer2d.exportPng(state.fractalId, state.params.depth);
      } else {
        await renderer3d.exportPng(state.fractalId, state.params.depth);
      }
    } catch (e) {
      controls.showError('書き出しに失敗しました: ' + String(e));
    } finally {
      controls.setExporting(false);
    }
  },

  onPresetSave() {
    const state = controls.getState();
    const is3D = !['sierpinski2d', 'koch2d'].includes(state.fractalId);
    exportPreset(
      state,
      is3D ? renderer3d.getCamera() : null,
      is3D ? renderer3d.getControls() : null,
    );
  },

  getCameraHeight() {
    return renderer3d.getCameraHeight();
  },
});

// ---------- プリセット読み込み共通処理 ----------

function loadPresetFile(file: File): void {
  const reader = new FileReader();
  reader.onload = () => {
    const result = parsePreset(reader.result as string);
    if (!result.ok) {
      controls.showError('プリセットの読み込みに失敗しました: ' + result.error);
      return;
    }
    if (result.textureWarning) {
      controls.showError('テクスチャモードは保存できないため、単色（Solid）に切り替えました。');
    } else {
      controls.hideError();
    }
    const { preset } = result;
    controls.loadPreset(preset);
    if (preset.camera) {
      renderer3d.applyCamera(preset.camera.position, preset.camera.target, preset.camera.fov, preset.camera.orthographic);
    }
  };
  reader.readAsText(file);
}

// ファイル選択ボタン
const presetLoadInput = document.getElementById('preset-load-input') as HTMLInputElement;
presetLoadInput.addEventListener('change', () => {
  const file = presetLoadInput.files?.[0];
  if (file) {
    loadPresetFile(file);
    presetLoadInput.value = ''; // 同一ファイルを再選択できるようにリセット
  }
});

// ---------- プリセットドロップ読み込み ----------

const dropZone = document.getElementById('app') ?? document.body;

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (!file || !file.name.endsWith('.json')) {
    controls.showError('JSON ファイルをドロップしてください。');
    return;
  }
  loadPresetFile(file);
});

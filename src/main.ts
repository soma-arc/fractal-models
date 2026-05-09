import { Controls } from './ui/controls.ts';
import { Renderer2D } from './renderer/renderer2d.ts';
import { Renderer3D } from './renderer/renderer3d.ts';
import { sierpinski2d } from './fractals/sierpinski2d.ts';
import { koch2d } from './fractals/koch2d.ts';
import { sierpinski3d } from './fractals/sierpinski3d.ts';
import { menger } from './fractals/menger.ts';
import { koch3d } from './fractals/koch3d.ts';
import type { FractalEntry } from './types/fractal.ts';

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

    if (entry.kind === '2d') {
      renderer2d.render(entry.fractal, state.params);
    } else {
      renderer3d.render(entry.fractal, state.params);
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
});

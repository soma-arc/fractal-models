import type { Fractal2D, FractalParams } from '../types/fractal.ts';

export const PREVIEW_SIZE = 800;
export const EXPORT_SIZE = 3508;

export class Renderer2D {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private currentFractal: Fractal2D | null = null;
  private currentParams: FractalParams | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context not available');
    this.ctx = ctx;
  }

  render(fractal: Fractal2D, params: FractalParams): void {
    this.currentFractal = fractal;
    this.currentParams = params;
    this.drawAt(PREVIEW_SIZE);
  }

  private drawAt(size: number): void {
    if (!this.currentFractal || !this.currentParams) return;

    this.canvas.width = size;
    this.canvas.height = size;

    this.ctx.clearRect(0, 0, size, size);
    this.currentFractal.render(this.ctx, size, this.currentParams);
  }

  async exportPng(fractalId: string, depth: number): Promise<void> {
    if (!this.currentFractal || !this.currentParams) return;

    // 書き出し解像度で再描画
    this.drawAt(EXPORT_SIZE);

    const url = this.canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fractalId}-depth${depth}.png`;
    a.click();

    // プレビュー解像度に戻す
    this.drawAt(PREVIEW_SIZE);
  }

  clear(): void {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.currentFractal = null;
    this.currentParams = null;
  }
}

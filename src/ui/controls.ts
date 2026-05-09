import type { ColorMode, ColorParams, FractalParams, GradientDirection, PbrParams } from '../types/fractal.ts';

export interface UIState {
  fractalId: string;
  params: FractalParams;
}

export interface UICallbacks {
  onChange: (state: UIState) => void;
  onExport: () => void;
}

const FRACTAL_MAX_DEPTHS: Record<string, number> = {
  sierpinski2d: 10,
  koch2d: 20,
  sierpinski3d: 8,
  menger: 4,
  koch3d: 8,
};

const FRACTAL_WARN_DEPTHS: Record<string, number> = {
  sierpinski2d: 999,
  koch2d: 16,
  sierpinski3d: 999,
  menger: 999,
  koch3d: 999,
};

const IS_2D_FRACTAL: Record<string, boolean> = {
  sierpinski2d: true,
  koch2d: true,
  sierpinski3d: false,
  menger: false,
  koch3d: false,
};

export class Controls {
  private fractalSelect: HTMLSelectElement;
  private depthSlider: HTMLInputElement;
  private depthValue: HTMLSpanElement;
  private warningMsg: HTMLDivElement;
  private colorModeRadios: NodeListOf<HTMLInputElement>;
  private solidRow: HTMLDivElement;
  private gradientRow: HTMLDivElement;
  private textureRow: HTMLDivElement;
  private textureRadioLabel: HTMLLabelElement;
  private solidColor: HTMLInputElement;
  private gradStart: HTMLInputElement;
  private gradEnd: HTMLInputElement;
  private gradDir: HTMLSelectElement;
  private textureFile: HTMLInputElement;
  private errorMsg: HTMLDivElement;
  private exportBtn: HTMLButtonElement;

  // PBR
  private pbrSection: HTMLDivElement;
  private pbrMetalness: HTMLInputElement;
  private pbrMetalnessVal: HTMLSpanElement;
  private pbrRoughness: HTMLInputElement;
  private pbrRoughnessVal: HTMLSpanElement;
  private pbrClearcoat: HTMLInputElement;
  private pbrClearcoatVal: HTMLSpanElement;
  private pbrClearcoatRough: HTMLInputElement;
  private pbrClearcoatRoughVal: HTMLSpanElement;
  private pbrIridescence: HTMLInputElement;
  private pbrIridescenceVal: HTMLSpanElement;
  private pbrLight: HTMLInputElement;
  private pbrLightVal: HTMLSpanElement;
  private pbrWireframe: HTMLInputElement;

  private currentTextureImage: HTMLImageElement | null = null;
  private callbacks: UICallbacks;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;

    this.fractalSelect = document.getElementById('fractal-select') as HTMLSelectElement;
    this.depthSlider = document.getElementById('depth-slider') as HTMLInputElement;
    this.depthValue = document.getElementById('depth-value') as HTMLSpanElement;
    this.warningMsg = document.getElementById('warning-msg') as HTMLDivElement;
    this.colorModeRadios = document.querySelectorAll<HTMLInputElement>('input[name="color-mode"]');
    this.solidRow = document.getElementById('solid-row') as HTMLDivElement;
    this.gradientRow = document.getElementById('gradient-row') as HTMLDivElement;
    this.textureRow = document.getElementById('texture-row') as HTMLDivElement;
    this.textureRadioLabel = document.getElementById('texture-radio-label') as HTMLLabelElement;
    this.solidColor = document.getElementById('solid-color') as HTMLInputElement;
    this.gradStart = document.getElementById('grad-start') as HTMLInputElement;
    this.gradEnd = document.getElementById('grad-end') as HTMLInputElement;
    this.gradDir = document.getElementById('grad-dir') as HTMLSelectElement;
    this.textureFile = document.getElementById('texture-file') as HTMLInputElement;
    this.errorMsg = document.getElementById('error-msg') as HTMLDivElement;
    this.exportBtn = document.getElementById('export-btn') as HTMLButtonElement;

    this.pbrSection = document.getElementById('pbr-section') as HTMLDivElement;
    this.pbrMetalness = document.getElementById('pbr-metalness') as HTMLInputElement;
    this.pbrMetalnessVal = document.getElementById('pbr-metalness-val') as HTMLSpanElement;
    this.pbrRoughness = document.getElementById('pbr-roughness') as HTMLInputElement;
    this.pbrRoughnessVal = document.getElementById('pbr-roughness-val') as HTMLSpanElement;
    this.pbrClearcoat = document.getElementById('pbr-clearcoat') as HTMLInputElement;
    this.pbrClearcoatVal = document.getElementById('pbr-clearcoat-val') as HTMLSpanElement;
    this.pbrClearcoatRough = document.getElementById('pbr-clearcoat-rough') as HTMLInputElement;
    this.pbrClearcoatRoughVal = document.getElementById('pbr-clearcoat-rough-val') as HTMLSpanElement;
    this.pbrIridescence = document.getElementById('pbr-iridescence') as HTMLInputElement;
    this.pbrIridescenceVal = document.getElementById('pbr-iridescence-val') as HTMLSpanElement;
    this.pbrLight = document.getElementById('pbr-light') as HTMLInputElement;
    this.pbrLightVal = document.getElementById('pbr-light-val') as HTMLSpanElement;
    this.pbrWireframe = document.getElementById('pbr-wireframe') as HTMLInputElement;

    this.bindEvents();
    this.onFractalChange();
  }

  private bindEvents(): void {
    this.fractalSelect.addEventListener('change', () => this.onFractalChange());
    this.depthSlider.addEventListener('input', () => this.onDepthChange());
    this.colorModeRadios.forEach(r => r.addEventListener('change', () => this.onColorModeChange()));
    this.solidColor.addEventListener('input', () => this.notify());
    this.gradStart.addEventListener('input', () => this.notify());
    this.gradEnd.addEventListener('input', () => this.notify());
    this.gradDir.addEventListener('change', () => this.notify());
    this.textureFile.addEventListener('change', () => this.onTextureChange());
    this.exportBtn.addEventListener('click', () => this.callbacks.onExport());

    // PBR スライダー
    const pbrSliders: Array<[HTMLInputElement, HTMLSpanElement]> = [
      [this.pbrMetalness, this.pbrMetalnessVal],
      [this.pbrRoughness, this.pbrRoughnessVal],
      [this.pbrClearcoat, this.pbrClearcoatVal],
      [this.pbrClearcoatRough, this.pbrClearcoatRoughVal],
      [this.pbrIridescence, this.pbrIridescenceVal],
      [this.pbrLight, this.pbrLightVal],
    ];
    for (const [slider, display] of pbrSliders) {
      slider.addEventListener('input', () => {
        display.textContent = Number(slider.value).toFixed(2);
        this.notify();
      });
    }
    this.pbrWireframe.addEventListener('change', () => this.notify());
  }

  private onFractalChange(): void {
    const id = this.fractalSelect.value;
    const maxDepth = FRACTAL_MAX_DEPTHS[id] ?? 8;
    const is2D = IS_2D_FRACTAL[id] ?? true;

    this.depthSlider.max = String(maxDepth);
    if (Number(this.depthSlider.value) > maxDepth) {
      this.depthSlider.value = String(maxDepth);
    }

    // テクスチャはら2Dのみ
    this.textureRadioLabel.style.display = is2D ? '' : 'none';
    const currentMode = this.getColorMode();
    if (!is2D && currentMode === 'texture') {
      (document.querySelector<HTMLInputElement>('input[name="color-mode"][value="solid"]'))!.checked = true;
    }

    // PBR は 3D のみ
    this.pbrSection.style.display = is2D ? 'none' : 'block';

    this.onDepthChange();
    this.onColorModeChange();
  }

  private onDepthChange(): void {
    const depth = Number(this.depthSlider.value);
    this.depthValue.textContent = String(depth);
    const id = this.fractalSelect.value;
    const warnDepth = FRACTAL_WARN_DEPTHS[id] ?? 999;
    this.warningMsg.style.display = depth >= warnDepth ? '' : 'none';
    this.notify();
  }

  private onColorModeChange(): void {
    const mode = this.getColorMode();
    this.solidRow.style.display = mode === 'solid' ? '' : 'none';
    this.gradientRow.style.display = mode === 'gradient' ? '' : 'none';
    this.textureRow.style.display = mode === 'texture' ? '' : 'none';
    this.notify();
  }

  private onTextureChange(): void {
    const file = this.textureFile.files?.[0];
    if (!file) return;

    if (!file.type.match(/^image\/(png|jpeg)$/)) {
      this.showError('PNG または JPEG ファイルを選択してください');
      this.textureFile.value = '';
      this.currentTextureImage = null;
      this.notify();
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      this.currentTextureImage = img;
      this.hideError();
      this.notify();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      this.showError('画像の読み込みに失敗しました。別のファイルを選択してください。');
      this.textureFile.value = '';
      this.currentTextureImage = null;
      (document.querySelector<HTMLInputElement>('input[name="color-mode"][value="solid"]'))!.checked = true;
      this.onColorModeChange();
    };
    img.src = url;
  }

  showError(msg: string): void {
    this.errorMsg.textContent = msg;
    this.errorMsg.style.display = '';
  }

  hideError(): void {
    this.errorMsg.style.display = 'none';
  }

  setExporting(exporting: boolean): void {
    this.exportBtn.disabled = exporting;
    this.exportBtn.textContent = exporting ? '書き出し中...' : 'PNG 書き出し ↓';
  }

  private getColorMode(): ColorMode {
    for (const r of this.colorModeRadios) {
      if (r.checked) return r.value as ColorMode;
    }
    return 'solid';
  }

  getState(): UIState {
    const colorParams: ColorParams = {
      mode: this.getColorMode(),
      solidColor: this.solidColor.value,
      gradStart: this.gradStart.value,
      gradEnd: this.gradEnd.value,
      gradDir: this.gradDir.value as GradientDirection,
      textureImage: this.currentTextureImage,
    };
    const pbrParams: PbrParams = {
      metalness: Number(this.pbrMetalness.value),
      roughness: Number(this.pbrRoughness.value),
      clearcoat: Number(this.pbrClearcoat.value),
      clearcoatRoughness: Number(this.pbrClearcoatRough.value),
      iridescence: Number(this.pbrIridescence.value),
      lightIntensity: Number(this.pbrLight.value),
      wireframe: this.pbrWireframe.checked,
    };
    return {
      fractalId: this.fractalSelect.value,
      params: {
        depth: Number(this.depthSlider.value),
        color: colorParams,
        pbr: pbrParams,
      },
    };
  }

  private notify(): void {
    this.callbacks.onChange(this.getState());
  }
}

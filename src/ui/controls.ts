import type {
  ColorMode,
  ColorParams,
  FractalParams,
  GradientDirection,
  Koch3DMode,
  Koch3DParams,
  PbrParams,
  PresetV1,
} from '../types/fractal.ts';

export interface UIState {
  fractalId: string;
  params: FractalParams;
}

export interface UICallbacks {
  onChange: (this: Controls, state: UIState) => void;
  onExport: () => void;
  onPresetSave: () => void;
  getCameraHeight: () => number;
}

const FRACTAL_MAX_DEPTHS: Record<string, number> = {
  sierpinski2d: 10,
  koch2d: 20,
  sierpinski3d: 10,
  menger: 10,
  'menger-raymarch': 10,
  koch3d: 10,
};

const FRACTAL_WARN_DEPTHS: Record<string, number> = {
  sierpinski2d: 999,
  koch2d: 16,
  sierpinski3d: 999,
  menger: 999,
  'menger-raymarch': 999,
  koch3d: 999,
};

const IS_2D_FRACTAL: Record<string, boolean> = {
  sierpinski2d: true,
  koch2d: true,
  sierpinski3d: false,
  menger: false,
  'menger-raymarch': false,
  koch3d: false,
};

const KOCH3D_MODES = new Set<Koch3DMode>(['classic', 'skew-bipyramid', 'skew-mirror', 'asymmetric-faces']);

export class Controls {
  private fractalSelect: HTMLSelectElement;
  private depthSlider: HTMLInputElement;
  private depthValue: HTMLSpanElement;
  private warningMsg: HTMLDivElement;
  private koch3dSection: HTMLDivElement;
  private koch3dMode: HTMLSelectElement;
  private colorModeRadios: NodeListOf<HTMLInputElement>;
  private solidRow: HTMLDivElement;
  private gradientRow: HTMLDivElement;
  private textureRow: HTMLDivElement;
  private textureRadioLabel: HTMLLabelElement;
  private tetra4Row: HTMLDivElement;
  private tetra4RadioLabel: HTMLLabelElement;
  private solidColor: HTMLInputElement;
  private gradStart: HTMLInputElement;
  private gradEnd: HTMLInputElement;
  private gradDir: HTMLSelectElement;
  private tetraTop: HTMLInputElement;
  private tetraLeft: HTMLInputElement;
  private tetraRight: HTMLInputElement;
  private tetraBack: HTMLInputElement;
  private textureFile: HTMLInputElement;
  private errorMsg: HTMLDivElement;
  private exportBtn: HTMLButtonElement;
  private presetBtn: HTMLButtonElement;

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
  private pbrLightAz: HTMLInputElement;
  private pbrLightAzVal: HTMLSpanElement;
  private pbrLightEl: HTMLInputElement;
  private pbrLightElVal: HTMLSpanElement;
  private pbrEnv: HTMLInputElement;
  private pbrEnvVal: HTMLSpanElement;
  private pbrFov: HTMLInputElement;
  private pbrFovVal: HTMLSpanElement;
  private pbrWireframe: HTMLInputElement;
  private pbrOrtho: HTMLInputElement;
  private pbrVerticalCorrection: HTMLInputElement;
  private pbrCameraHeight: HTMLInputElement;
  private pbrCameraHeightVal: HTMLSpanElement;
  private pbrLensShiftY: HTMLInputElement;
  private pbrLensShiftYVal: HTMLSpanElement;

  private currentTextureImage: HTMLImageElement | null = null;
  private callbacks: UICallbacks;

  constructor(callbacks: UICallbacks) {
    this.callbacks = callbacks;

    this.fractalSelect = document.getElementById('fractal-select') as HTMLSelectElement;
    this.depthSlider = document.getElementById('depth-slider') as HTMLInputElement;
    this.depthValue = document.getElementById('depth-value') as HTMLSpanElement;
    this.warningMsg = document.getElementById('warning-msg') as HTMLDivElement;
    this.koch3dSection = document.getElementById('koch3d-section') as HTMLDivElement;
    this.koch3dMode = document.getElementById('koch3d-mode') as HTMLSelectElement;
    this.colorModeRadios = document.querySelectorAll<HTMLInputElement>('input[name="color-mode"]');
    this.solidRow = document.getElementById('solid-row') as HTMLDivElement;
    this.gradientRow = document.getElementById('gradient-row') as HTMLDivElement;
    this.textureRow = document.getElementById('texture-row') as HTMLDivElement;
    this.textureRadioLabel = document.getElementById('texture-radio-label') as HTMLLabelElement;
    this.tetra4Row = document.getElementById('tetra4-row') as HTMLDivElement;
    this.tetra4RadioLabel = document.getElementById('tetra4-radio-label') as HTMLLabelElement;
    this.solidColor = document.getElementById('solid-color') as HTMLInputElement;
    this.gradStart = document.getElementById('grad-start') as HTMLInputElement;
    this.gradEnd = document.getElementById('grad-end') as HTMLInputElement;
    this.gradDir = document.getElementById('grad-dir') as HTMLSelectElement;
    this.tetraTop = document.getElementById('tetra-top') as HTMLInputElement;
    this.tetraLeft = document.getElementById('tetra-left') as HTMLInputElement;
    this.tetraRight = document.getElementById('tetra-right') as HTMLInputElement;
    this.tetraBack = document.getElementById('tetra-back') as HTMLInputElement;
    this.textureFile = document.getElementById('texture-file') as HTMLInputElement;
    this.errorMsg = document.getElementById('error-msg') as HTMLDivElement;
    this.exportBtn = document.getElementById('export-btn') as HTMLButtonElement;
    this.presetBtn = document.getElementById('preset-btn') as HTMLButtonElement;

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
    this.pbrLightAz = document.getElementById('pbr-light-az') as HTMLInputElement;
    this.pbrLightAzVal = document.getElementById('pbr-light-az-val') as HTMLSpanElement;
    this.pbrLightEl = document.getElementById('pbr-light-el') as HTMLInputElement;
    this.pbrLightElVal = document.getElementById('pbr-light-el-val') as HTMLSpanElement;
    this.pbrEnv = document.getElementById('pbr-env') as HTMLInputElement;
    this.pbrEnvVal = document.getElementById('pbr-env-val') as HTMLSpanElement;
    this.pbrFov = document.getElementById('pbr-fov') as HTMLInputElement;
    this.pbrFovVal = document.getElementById('pbr-fov-val') as HTMLSpanElement;
    this.pbrWireframe = document.getElementById('pbr-wireframe') as HTMLInputElement;
    this.pbrOrtho = document.getElementById('pbr-ortho') as HTMLInputElement;
    this.pbrVerticalCorrection = document.getElementById('pbr-vertical-correction') as HTMLInputElement;
    this.pbrCameraHeight = document.getElementById('pbr-camera-height') as HTMLInputElement;
    this.pbrCameraHeightVal = document.getElementById('pbr-camera-height-val') as HTMLSpanElement;
    this.pbrLensShiftY = document.getElementById('pbr-lens-shift-y') as HTMLInputElement;
    this.pbrLensShiftYVal = document.getElementById('pbr-lens-shift-y-val') as HTMLSpanElement;

    this.bindEvents();
    this.onFractalChange();
  }

  private bindEvents(): void {
    this.fractalSelect.addEventListener('change', () => this.onFractalChange());
    this.depthSlider.addEventListener('input', () => this.onDepthChange());
    this.koch3dMode.addEventListener('change', () => this.notify());
    this.colorModeRadios.forEach(r => r.addEventListener('change', () => this.onColorModeChange()));
    this.solidColor.addEventListener('input', () => this.notify());
    this.gradStart.addEventListener('input', () => this.notify());
    this.gradEnd.addEventListener('input', () => this.notify());
    this.gradDir.addEventListener('change', () => this.notify());
    this.tetraTop.addEventListener('input', () => this.notify());
    this.tetraLeft.addEventListener('input', () => this.notify());
    this.tetraRight.addEventListener('input', () => this.notify());
    this.tetraBack.addEventListener('input', () => this.notify());
    this.textureFile.addEventListener('change', () => this.onTextureChange());
    this.exportBtn.addEventListener('click', () => this.callbacks.onExport());
    this.presetBtn.addEventListener('click', () => this.callbacks.onPresetSave());

    // PBR スライダー
    const pbrSliders: Array<[HTMLInputElement, HTMLSpanElement]> = [
      [this.pbrMetalness, this.pbrMetalnessVal],
      [this.pbrRoughness, this.pbrRoughnessVal],
      [this.pbrClearcoat, this.pbrClearcoatVal],
      [this.pbrClearcoatRough, this.pbrClearcoatRoughVal],
      [this.pbrIridescence, this.pbrIridescenceVal],
      [this.pbrLight, this.pbrLightVal],
      [this.pbrEnv, this.pbrEnvVal],
    ];
    for (const [slider, display] of pbrSliders) {
      slider.addEventListener('input', () => {
        display.textContent = Number(slider.value).toFixed(2);
        this.notify();
      });
    }
    // 角度スライダー（整数 + °表示）
    const pbrDegreeSliders: Array<[HTMLInputElement, HTMLSpanElement]> = [
      [this.pbrLightAz, this.pbrLightAzVal],
      [this.pbrLightEl, this.pbrLightElVal],
      [this.pbrFov, this.pbrFovVal],
    ];
    for (const [slider, display] of pbrDegreeSliders) {
      slider.addEventListener('input', () => {
        display.textContent = `${Math.round(Number(slider.value))}°`;
        this.notify();
      });
    }
    this.pbrLensShiftY.addEventListener('input', () => {
      this.pbrLensShiftYVal.textContent = Number(this.pbrLensShiftY.value).toFixed(2);
      this.notify();
    });
    this.pbrCameraHeight.addEventListener('input', () => {
      this.pbrCameraHeightVal.textContent = Number(this.pbrCameraHeight.value).toFixed(2);
      this.notify();
    });
    this.pbrWireframe.addEventListener('change', () => this.notify());
    this.pbrOrtho.addEventListener('change', () => this.notify());
    this.pbrVerticalCorrection.addEventListener('change', () => {
      if (this.pbrVerticalCorrection.checked) {
        this.setCameraHeight(this.callbacks.getCameraHeight());
      }
      this.notify();
    });
  }

  private onFractalChange(): void {
    const id = this.fractalSelect.value;
    const maxDepth = FRACTAL_MAX_DEPTHS[id] ?? 8;
    const is2D = IS_2D_FRACTAL[id] ?? true;
    const supportsTetra4 = id === 'sierpinski3d';

    this.depthSlider.max = String(maxDepth);
    if (Number(this.depthSlider.value) > maxDepth) {
      this.depthSlider.value = String(maxDepth);
    }

    // テクスチャはら2Dのみ
    this.textureRadioLabel.style.display = is2D ? '' : 'none';
    this.tetra4RadioLabel.style.display = supportsTetra4 ? '' : 'none';
    const currentMode = this.getColorMode();
    if (!is2D && currentMode === 'texture') {
      (document.querySelector<HTMLInputElement>('input[name="color-mode"][value="solid"]'))!.checked = true;
    }
    if (!supportsTetra4 && currentMode === 'tetra4') {
      (document.querySelector<HTMLInputElement>('input[name="color-mode"][value="solid"]'))!.checked = true;
    }

    // PBR は 3D のみ
    this.pbrSection.style.display = is2D ? 'none' : 'block';
    this.koch3dSection.style.display = id === 'koch3d' ? '' : 'none';

    this.onDepthChange();
    this.onColorModeChange();
  }

  private setKoch3DParams(params: Koch3DParams | undefined): void {
    const rawMode = params?.mode;
    const mode: Koch3DMode = rawMode && KOCH3D_MODES.has(rawMode) ? rawMode : 'classic';
    this.koch3dMode.value = mode;
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
    this.tetra4Row.style.display = mode === 'tetra4' ? '' : 'none';
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

  /** プリセット JSON を UI に反映する */
  loadPreset(preset: PresetV1): void {
    // fractalId
    this.fractalSelect.value = preset.fractalId;
    this.onFractalChange();

    // depth
    this.depthSlider.value = String(preset.depth);
    this.depthValue.textContent = String(preset.depth);

    // color
    const modeRadio = document.querySelector<HTMLInputElement>(
      `input[name="color-mode"][value="${preset.color.mode}"]`
    );
    if (modeRadio) modeRadio.checked = true;
    if (preset.color.mode === 'tetra4' && preset.fractalId !== 'sierpinski3d') {
      (document.querySelector<HTMLInputElement>('input[name="color-mode"][value="solid"]'))!.checked = true;
    }
    this.solidColor.value = preset.color.solidColor;
    this.gradStart.value = preset.color.gradStart;
    this.gradEnd.value = preset.color.gradEnd;
    this.gradDir.value = preset.color.gradDir;
    this.tetraTop.value = preset.color.tetraTop ?? '#f94144';
    this.tetraLeft.value = preset.color.tetraLeft ?? '#43aa8b';
    this.tetraRight.value = preset.color.tetraRight ?? '#577590';
    this.tetraBack.value = preset.color.tetraBack ?? '#f9c74f';
    this.onColorModeChange();

    // PBR
    if (preset.pbr) {
      this.pbrMetalness.value = String(preset.pbr.metalness);
      this.pbrMetalnessVal.textContent = preset.pbr.metalness.toFixed(2);
      this.pbrRoughness.value = String(preset.pbr.roughness);
      this.pbrRoughnessVal.textContent = preset.pbr.roughness.toFixed(2);
      this.pbrClearcoat.value = String(preset.pbr.clearcoat);
      this.pbrClearcoatVal.textContent = preset.pbr.clearcoat.toFixed(2);
      this.pbrClearcoatRough.value = String(preset.pbr.clearcoatRoughness);
      this.pbrClearcoatRoughVal.textContent = preset.pbr.clearcoatRoughness.toFixed(2);
      this.pbrIridescence.value = String(preset.pbr.iridescence);
      this.pbrIridescenceVal.textContent = preset.pbr.iridescence.toFixed(2);
      this.pbrLight.value = String(preset.pbr.lightIntensity);
      this.pbrLightVal.textContent = preset.pbr.lightIntensity.toFixed(2);
      this.pbrLightAz.value = String(preset.pbr.lightAzimuth);
      this.pbrLightAzVal.textContent = `${Math.round(preset.pbr.lightAzimuth)}°`;
      this.pbrLightEl.value = String(preset.pbr.lightElevation);
      this.pbrLightElVal.textContent = `${Math.round(preset.pbr.lightElevation)}°`;
      this.pbrEnv.value = String(preset.pbr.envIntensity);
      this.pbrEnvVal.textContent = preset.pbr.envIntensity.toFixed(2);
      this.pbrFov.value = String(preset.pbr.fov);
      this.pbrFovVal.textContent = `${Math.round(preset.pbr.fov)}°`;
      this.pbrWireframe.checked = preset.pbr.wireframe;
      this.pbrOrtho.checked = preset.pbr.orthographic ?? false;
      this.pbrVerticalCorrection.checked = preset.pbr.verticalCorrection ?? false;
      this.setCameraHeight(preset.pbr.cameraHeight ?? 2);
      this.pbrLensShiftY.value = String(preset.pbr.lensShiftY ?? 0);
      this.pbrLensShiftYVal.textContent = (preset.pbr.lensShiftY ?? 0).toFixed(2);
    }
    this.setKoch3DParams(preset.koch3d);

    this.notify();
  }

  private getColorMode(): ColorMode {
    for (const r of this.colorModeRadios) {
      if (r.checked) return r.value as ColorMode;
    }
    return 'solid';
  }

  private setCameraHeight(value: number): void {
    this.pbrCameraHeight.value = String(value);
    this.pbrCameraHeightVal.textContent = value.toFixed(2);
  }

  private getKoch3DParams(): Koch3DParams {
    const rawMode = this.koch3dMode.value as Koch3DMode;
    const mode: Koch3DMode = rawMode && KOCH3D_MODES.has(rawMode) ? rawMode : 'classic';
    return {
      mode,
    };
  }

  getState(): UIState {
    const colorParams: ColorParams = {
      mode: this.getColorMode(),
      solidColor: this.solidColor.value,
      gradStart: this.gradStart.value,
      gradEnd: this.gradEnd.value,
      gradDir: this.gradDir.value as GradientDirection,
      tetraTop: this.tetraTop.value,
      tetraLeft: this.tetraLeft.value,
      tetraRight: this.tetraRight.value,
      tetraBack: this.tetraBack.value,
      textureImage: this.currentTextureImage,
    };
    const pbrParams: PbrParams = {
      metalness: Number(this.pbrMetalness.value),
      roughness: Number(this.pbrRoughness.value),
      clearcoat: Number(this.pbrClearcoat.value),
      clearcoatRoughness: Number(this.pbrClearcoatRough.value),
      iridescence: Number(this.pbrIridescence.value),
      lightIntensity: Number(this.pbrLight.value),
      lightAzimuth: Number(this.pbrLightAz.value),
      lightElevation: Number(this.pbrLightEl.value),
      envIntensity: Number(this.pbrEnv.value),
      fov: Number(this.pbrFov.value),
      wireframe: this.pbrWireframe.checked,
      orthographic: this.pbrOrtho.checked,
      verticalCorrection: this.pbrVerticalCorrection.checked,
      cameraHeight: Number(this.pbrCameraHeight.value),
      lensShiftY: Number(this.pbrLensShiftY.value),
    };
    return {
      fractalId: this.fractalSelect.value,
      params: {
        depth: Number(this.depthSlider.value),
        color: colorParams,
        pbr: pbrParams,
        koch3d: this.getKoch3DParams(),
      },
    };
  }

  private notify(): void {
    this.callbacks.onChange.call(this, this.getState());
  }
}

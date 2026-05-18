import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  AmbientLight,
  DirectionalLight,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PCFSoftShadowMap,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Fractal3D, FractalParams } from '../types/fractal.ts';
import { EXPORT_SIZE } from './renderer2d.ts';

const PREVIEW_SIZE = 800;
const FPS_CAP = 1000 / 60;
const MIN_HORIZONTAL_DISTANCE = 0.01;

export class Renderer3D {
  private canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private correctedCamera: PerspectiveCamera;
  private orthoCamera: OrthographicCamera;
  private controls: OrbitControls;
  private animFrameId: number | null = null;
  private lastTime = 0;
  private currentMesh: Mesh | null = null;
  private material: MeshPhysicalMaterial;
  private dirLight: DirectionalLight;
  private active = false;
  private isOrtho = false;
  private verticalCorrection = false;
  private cameraHeight = 2;
  private lensShiftY = 0;
  private horizontalTarget = new Vector3();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;

    this.renderer = new WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE, false);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = PCFSoftShadowMap;

    this.scene = new Scene();

    // IBL: PMREMGenerator + RoomEnvironment
    const pmremGenerator = new PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment()).texture;
    pmremGenerator.dispose();

    this.camera = new PerspectiveCamera(45, 1, 0.01, 1000);
    this.camera.position.set(2, 2, 3);
    this.correctedCamera = new PerspectiveCamera(45, 1, 0.01, 1000);
    this.correctedCamera.position.copy(this.camera.position);

    // 平行投影カメラ（透視投影と同じ位置から使用）
    // frustum サイズは OrbitControls のズームに応じ render() で更新
    this.orthoCamera = new OrthographicCamera(-2, 2, 2, -2, 0.01, 1000);
    this.orthoCamera.position.set(2, 2, 3);

    // IBL があるので AmbientLight / DirectionalLight は補助程度に抑える
    const ambient = new AmbientLight(0xffffff, 0.2);
    this.scene.add(ambient);
    const dir = new DirectionalLight(0xffffff, 1.2);
    // 初期位置：方位角45° 仰角45°
    dir.position.set(4, 5.66, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(4096, 4096);
    dir.shadow.camera.near = 1;
    dir.shadow.camera.far = 20;
    dir.shadow.camera.left = -3;
    dir.shadow.camera.right = 3;
    dir.shadow.camera.top = 3;
    dir.shadow.camera.bottom = -3;
    dir.shadow.bias = -0.0005;
    dir.shadow.normalBias = 0.02;
    this.scene.add(dir);
    this.dirLight = dir;

    // 共有マテリアル（geometry のみ差し替えるので dispose 不要）
    this.material = new MeshPhysicalMaterial({
      vertexColors: true,
      metalness: 0.3,
      roughness: 0.5,
      clearcoat: 0.0,
      clearcoatRoughness: 0.1,
      iridescence: 0.0,
    });

    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    // WebGL コンテキストロスト対応
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.stopLoop();
      const msg = document.getElementById('webgl-lost-msg') as HTMLDivElement | null;
      if (msg) {
        msg.style.display = 'flex';
      }
    });
    canvas.addEventListener('webglcontextrestored', () => {
      const msg = document.getElementById('webgl-lost-msg') as HTMLDivElement | null;
      if (msg) msg.style.display = 'none';
    });
  }

  render(fractal: Fractal3D, params: FractalParams): void {
    // 既存メッシュの geometry のみ破棄（material は使い回す）
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
      this.currentMesh.geometry.dispose();
      this.currentMesh = null;
    }

    const geomData = fractal.build(params);

    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(geomData.positions, 3));
    geometry.setAttribute('color', new BufferAttribute(geomData.colors, 3));
    geometry.computeVertexNormals();

    // PBR パラメータを適用
    const { pbr } = params;
    this.material.metalness = pbr.metalness;
    this.material.roughness = pbr.roughness;
    this.material.clearcoat = pbr.clearcoat;
    this.material.clearcoatRoughness = pbr.clearcoatRoughness;
    this.material.iridescence = pbr.iridescence;
    this.material.wireframe = pbr.wireframe;
    this.dirLight.intensity = pbr.lightIntensity;
    // 方位角・仰角から DirectionalLight 位置を計算
    const az = (pbr.lightAzimuth * Math.PI) / 180;
    const el = (pbr.lightElevation * Math.PI) / 180;
    const r = 8;
    this.dirLight.position.set(
      r * Math.cos(el) * Math.sin(az),
      r * Math.sin(el),
      r * Math.cos(el) * Math.cos(az),
    );
    // IBL 強度
    this.scene.environmentIntensity = pbr.envIntensity;
    // Camera FOV / 投影モード切り替え
    this.isOrtho = pbr.orthographic;
    this.verticalCorrection = pbr.verticalCorrection;
    this.cameraHeight = pbr.cameraHeight;
    this.lensShiftY = pbr.lensShiftY;
    this.camera.fov = pbr.fov;
    this.camera.updateProjectionMatrix();
    this.updateVerticalCorrectionControls();

    const mesh = new Mesh(geometry, this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.currentMesh = mesh;
    this.scene.add(mesh);

    this.active = true;
    if (this.animFrameId === null) {
      this.startLoop();
    }
  }

  show(): void {
    this.canvas.style.display = 'block';
    if (this.active && this.animFrameId === null) {
      this.startLoop();
    }
  }

  getCamera(): PerspectiveCamera { return this.camera; }
  getControls(): OrbitControls { return this.controls; }
  getCameraHeight(): number {
    return this.camera.position.y - this.controls.target.y;
  }

  /** プリセットからカメラ・コントロールを復元する */
  applyCamera(position: [number, number, number], target: [number, number, number], fov: number, orthographic?: boolean): void {
    this.camera.position.set(...position);
    this.controls.target.set(...target);
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
    if (orthographic !== undefined) this.isOrtho = orthographic;
    this.controls.update();
  }

  hide(): void {
    this.canvas.style.display = 'none';
    this.stopLoop();
  }

  private startLoop(): void {
    const loop = (time: number) => {
      this.animFrameId = requestAnimationFrame(loop);
      const delta = time - this.lastTime;
      if (delta < FPS_CAP) return;
      this.lastTime = time;
      this.updateVerticalCorrectionControls();
      this.controls.update();
      if (this.verticalCorrection && !this.isOrtho) {
        this.applyCameraHeight();
        this.updateVerticalCorrectionControls();
      }

      let activeCamera: PerspectiveCamera | OrthographicCamera;
      if (this.isOrtho) {
        // perspectiveCamera の位置・回転を orthoCamera に同期
        // frustum サイズ = ターゲットまでの距離 × tan(fov/2) で透視投影と同じ画角に揃える
        const dist = this.camera.position.distanceTo(this.controls.target);
        const halfH = dist * Math.tan((this.camera.fov * Math.PI) / 360);
        this.orthoCamera.left = -halfH;
        this.orthoCamera.right = halfH;
        this.orthoCamera.top = halfH;
        this.orthoCamera.bottom = -halfH;
        this.orthoCamera.position.copy(this.camera.position);
        this.orthoCamera.quaternion.copy(this.camera.quaternion);
        this.orthoCamera.updateProjectionMatrix();
        activeCamera = this.orthoCamera;
      } else {
        activeCamera = this.verticalCorrection
          ? this.prepareVerticalCorrectedCamera()
          : this.camera;
      }

      this.renderer.render(this.scene, activeCamera);
    };
    this.animFrameId = requestAnimationFrame(loop);
  }

  private stopLoop(): void {
    if (this.animFrameId !== null) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
  }

  private disposeMesh(): void {
    if (this.currentMesh) {
      this.scene.remove(this.currentMesh);
      this.currentMesh.geometry.dispose();
      // material は使い回すので dispose しない
      this.currentMesh = null;
    }
  }

  private prepareVerticalCorrectedCamera(): PerspectiveCamera {
    this.applyCameraHeight();
    this.correctedCamera.position.copy(this.camera.position);
    this.correctedCamera.aspect = this.camera.aspect;
    this.correctedCamera.fov = this.camera.fov;
    this.correctedCamera.near = this.camera.near;
    this.correctedCamera.far = this.camera.far;
    this.correctedCamera.zoom = this.camera.zoom;
    this.correctedCamera.up.copy(this.camera.up);

    this.horizontalTarget.set(
      this.controls.target.x,
      this.correctedCamera.position.y,
      this.controls.target.z,
    );
    if (this.horizontalTarget.distanceToSquared(this.correctedCamera.position) < 1e-8) {
      this.horizontalTarget.copy(this.controls.target);
    }

    this.correctedCamera.lookAt(this.horizontalTarget);
    this.correctedCamera.updateProjectionMatrix();
    this.correctedCamera.projectionMatrix.elements[9] += this.lensShiftY;
    return this.correctedCamera;
  }

  private updateVerticalCorrectionControls(): void {
    if (!this.verticalCorrection || this.isOrtho) {
      this.controls.minPolarAngle = 0;
      this.controls.maxPolarAngle = Math.PI;
      return;
    }

    const offset = this.camera.position.clone().sub(this.controls.target);
    const horizontalDistance = Math.max(
      Math.hypot(offset.x, offset.z),
      MIN_HORIZONTAL_DISTANCE,
    );
    const polar = Math.atan2(horizontalDistance, this.cameraHeight);
    this.controls.minPolarAngle = polar;
    this.controls.maxPolarAngle = polar;
  }

  private applyCameraHeight(): void {
    const offset = this.camera.position.clone().sub(this.controls.target);
    let horizontalDistance = Math.hypot(offset.x, offset.z);
    if (horizontalDistance < MIN_HORIZONTAL_DISTANCE) {
      offset.set(0, 0, MIN_HORIZONTAL_DISTANCE);
      horizontalDistance = MIN_HORIZONTAL_DISTANCE;
    }

    const scale = horizontalDistance / Math.hypot(offset.x, offset.z);
    this.camera.position.set(
      this.controls.target.x + offset.x * scale,
      this.controls.target.y + this.cameraHeight,
      this.controls.target.z + offset.z * scale,
    );
  }

  async exportPng(fractalId: string, depth: number): Promise<void> {
    // 解像度を書き出しサイズに変更
    this.renderer.setSize(EXPORT_SIZE, EXPORT_SIZE, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();

    let activeCamera: PerspectiveCamera | OrthographicCamera;
    if (this.isOrtho) {
      const dist = this.camera.position.distanceTo(this.controls.target);
      const halfH = dist * Math.tan((this.camera.fov * Math.PI) / 360);
      this.orthoCamera.left = -halfH;
      this.orthoCamera.right = halfH;
      this.orthoCamera.top = halfH;
      this.orthoCamera.bottom = -halfH;
      this.orthoCamera.position.copy(this.camera.position);
      this.orthoCamera.quaternion.copy(this.camera.quaternion);
      this.orthoCamera.updateProjectionMatrix();
      activeCamera = this.orthoCamera;
    } else {
      activeCamera = this.verticalCorrection
        ? this.prepareVerticalCorrectedCamera()
        : this.camera;
    }

    this.renderer.render(this.scene, activeCamera);
    const url = this.canvas.toDataURL('image/png');

    // プレビューサイズへ戻す
    this.renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();

    const a = document.createElement('a');
    a.href = url;
    a.download = `${fractalId}-depth${depth}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  clear(): void {
    this.stopLoop();
    this.disposeMesh();
    this.active = false;
  }
}

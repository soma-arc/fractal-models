import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  AmbientLight,
  DirectionalLight,
  BufferGeometry,
  BufferAttribute,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PCFSoftShadowMap,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Fractal3D, FractalParams } from '../types/fractal.ts';
import { EXPORT_SIZE } from './renderer2d.ts';

const PREVIEW_SIZE = 800;
const FPS_CAP = 1000 / 60;

export class Renderer3D {
  private canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private controls: OrbitControls;
  private animFrameId: number | null = null;
  private lastTime = 0;
  private currentMesh: Mesh | null = null;
  private material: MeshPhysicalMaterial;
  private dirLight: DirectionalLight;
  private active = false;

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

    // IBL があるので AmbientLight / DirectionalLight は補助程度に抑える
    const ambient = new AmbientLight(0xffffff, 0.2);
    this.scene.add(ambient);
    const dir = new DirectionalLight(0xffffff, 1.2);
    dir.position.set(3, 5, 4);
    dir.castShadow = true;
    dir.shadow.mapSize.set(2048, 2048);
    dir.shadow.camera.near = 0.5;
    dir.shadow.camera.far = 30;
    dir.shadow.camera.left = -6;
    dir.shadow.camera.right = 6;
    dir.shadow.camera.top = 6;
    dir.shadow.camera.bottom = -6;
    dir.shadow.bias = -0.001;
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
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
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

  async exportPng(fractalId: string, depth: number): Promise<void> {
    // 解像度を書き出しサイズに変更
    this.renderer.setSize(EXPORT_SIZE, EXPORT_SIZE, false);
    this.camera.aspect = 1;
    this.camera.updateProjectionMatrix();

    this.renderer.render(this.scene, this.camera);
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

import {
  WebGLRenderer,
  Scene,
  PerspectiveCamera,
  OrthographicCamera,
  AmbientLight,
  DirectionalLight,
  BoxGeometry,
  BufferGeometry,
  BufferAttribute,
  Color,
  Mesh,
  MeshPhysicalMaterial,
  PMREMGenerator,
  PCFSoftShadowMap,
  ShaderMaterial,
  Vector3,
} from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { Fractal3D, FractalParams } from '../types/fractal.ts';
import { EXPORT_SIZE } from './renderer2d.ts';

const PREVIEW_SIZE = 800;
const FPS_CAP = 1000 / 60;
const MIN_HORIZONTAL_DISTANCE = 0.01;
const PREVIEW_SHADOW_SIZE = 4096;
const EXPORT_SHADOW_SIZE = 8192;

const MENGER_RAYMARCH_VERTEX = /* glsl */`
varying vec3 vWorldPosition;

void main() {
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`;

const MENGER_RAYMARCH_FRAGMENT = /* glsl */`
uniform vec3 uSolidColor;
uniform vec3 uGradStart;
uniform vec3 uGradEnd;
uniform vec3 uLightDir;
uniform int uColorMode;
uniform int uGradDir;
uniform int uMengerDepth;
uniform float uLightIntensity;
uniform float uEnvIntensity;
uniform float uMetalness;
uniform float uRoughness;
varying vec3 vWorldPosition;

const float PI = 3.14159265359;

bool rayBox(vec3 origin, vec3 rayDir, out float tNear, out float tFar, out vec3 enterNormal) {
  vec3 invDir = 1.0 / rayDir;
  vec3 t0 = (vec3(-1.0) - origin) * invDir;
  vec3 t1 = (vec3(1.0) - origin) * invDir;
  vec3 tMin = min(t0, t1);
  vec3 tMax = max(t0, t1);
  tNear = max(max(tMin.x, tMin.y), tMin.z);
  tFar = min(min(tMax.x, tMax.y), tMax.z);

  if (tNear == tMin.x) {
    enterNormal = vec3(-sign(rayDir.x), 0.0, 0.0);
  } else if (tNear == tMin.y) {
    enterNormal = vec3(0.0, -sign(rayDir.y), 0.0);
  } else {
    enterNormal = vec3(0.0, 0.0, -sign(rayDir.z));
  }

  return tFar > max(tNear, 0.0);
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
}

float sdMenger(vec3 p) {
  float d = sdBox(p, vec3(1.0));
  float scale = 1.0;

  for (int i = 0; i < 10; i++) {
    if (i >= uMengerDepth) {
      break;
    }

    vec3 a = mod(p * scale, 2.0) - 1.0;
    scale *= 3.0;
    vec3 r = abs(1.0 - 3.0 * abs(a));
    float da = max(r.x, r.y);
    float db = max(r.y, r.z);
    float dc = max(r.z, r.x);
    float crossDistance = (min(da, min(db, dc)) - 1.0) / scale;
    d = max(d, crossDistance);
  }

  return d;
}

float mengerCellSize() {
  float scale = 1.0;
  for (int i = 0; i < 10; i++) {
    if (i >= uMengerDepth) {
      break;
    }
    scale *= 3.0;
  }
  return 2.0 / scale;
}

vec3 mengerNormal(vec3 p) {
  float eps = clamp(mengerCellSize() * 0.12, 0.00045, 0.003);
  vec2 e = vec2(eps, 0.0);
  return normalize(vec3(
    sdMenger(p + e.xyy) - sdMenger(p - e.xyy),
    sdMenger(p + e.yxy) - sdMenger(p - e.yxy),
    sdMenger(p + e.yyx) - sdMenger(p - e.yyx)
  ));
}

bool traceMenger(vec3 origin, vec3 rayDir, out vec3 hitPosition, out float hitDistance) {
  vec3 safeRayDir = normalize(rayDir);
  safeRayDir.x = abs(safeRayDir.x) < 0.000001 ? (safeRayDir.x < 0.0 ? -0.000001 : 0.000001) : safeRayDir.x;
  safeRayDir.y = abs(safeRayDir.y) < 0.000001 ? (safeRayDir.y < 0.0 ? -0.000001 : 0.000001) : safeRayDir.y;
  safeRayDir.z = abs(safeRayDir.z) < 0.000001 ? (safeRayDir.z < 0.0 ? -0.000001 : 0.000001) : safeRayDir.z;

  float tNear;
  float tFar;
  vec3 enterNormal;
  if (!rayBox(origin, safeRayDir, tNear, tFar, enterNormal)) {
    return false;
  }

  float t = max(tNear, 0.0);
  float hitEps = clamp(mengerCellSize() * 0.018, 0.00018, 0.0012);

  for (int i = 0; i < 256; i++) {
    if (t > tFar) {
      break;
    }

    vec3 p = origin + safeRayDir * t;
    float d = sdMenger(p);
    if (d < hitEps) {
      hitDistance = t;
      hitPosition = p;
      return true;
    }

    t += max(d * 0.82, hitEps * 0.65);
  }

  return false;
}

float mengerShadow(vec3 origin, vec3 rayDir) {
  vec3 safeRayDir = normalize(rayDir);
  safeRayDir.x = abs(safeRayDir.x) < 0.000001 ? (safeRayDir.x < 0.0 ? -0.000001 : 0.000001) : safeRayDir.x;
  safeRayDir.y = abs(safeRayDir.y) < 0.000001 ? (safeRayDir.y < 0.0 ? -0.000001 : 0.000001) : safeRayDir.y;
  safeRayDir.z = abs(safeRayDir.z) < 0.000001 ? (safeRayDir.z < 0.0 ? -0.000001 : 0.000001) : safeRayDir.z;

  float tNear;
  float tFar;
  vec3 enterNormal;
  if (!rayBox(origin, safeRayDir, tNear, tFar, enterNormal)) {
    return 1.0;
  }

  float t = max(tNear, 0.0);
  float shadowEps = clamp(mengerCellSize() * 0.025, 0.00028, 0.0018);
  float shadow = 1.0;

  for (int i = 0; i < 128; i++) {
    if (t > tFar) {
      break;
    }

    float d = sdMenger(origin + safeRayDir * t);
    if (d < shadowEps) {
      return 0.34;
    }

    shadow = min(shadow, 12.0 * d / max(t, shadowEps));
    t += clamp(d * 0.9, shadowEps * 1.5, 0.08);
  }

  return clamp(shadow, 0.34, 1.0);
}

vec3 mengerColor(vec3 p) {
  if (uColorMode == 0) {
    return uSolidColor;
  }

  float t = 0.0;
  if (uGradDir == 1) {
    t = (p.y + 1.0) * 0.5;
  } else {
    t = (p.x + 1.0) * 0.5;
  }

  return mix(uGradStart, uGradEnd, clamp(t, 0.0, 1.0));
}

float distributionGGX(vec3 normal, vec3 halfVector, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float nDotH = max(dot(normal, halfVector), 0.0);
  float nDotH2 = nDotH * nDotH;
  float denom = nDotH2 * (a2 - 1.0) + 1.0;
  return a2 / max(PI * denom * denom, 0.000001);
}

float geometrySchlickGGX(float nDotV, float roughness) {
  float r = roughness + 1.0;
  float k = (r * r) / 8.0;
  return nDotV / max(nDotV * (1.0 - k) + k, 0.000001);
}

float geometrySmith(vec3 normal, vec3 viewDir, vec3 lightDir, float roughness) {
  float nDotV = max(dot(normal, viewDir), 0.0);
  float nDotL = max(dot(normal, lightDir), 0.0);
  return geometrySchlickGGX(nDotV, roughness) * geometrySchlickGGX(nDotL, roughness);
}

vec3 fresnelSchlick(float cosTheta, vec3 f0) {
  return f0 + (1.0 - f0) * pow(clamp(1.0 - cosTheta, 0.0, 1.0), 5.0);
}

vec3 shadePbr(vec3 baseColor, vec3 normal, vec3 viewDir, vec3 lightDir, float shadow) {
  float roughness = clamp(uRoughness, 0.045, 1.0);
  float metalness = clamp(uMetalness, 0.0, 1.0);
  vec3 halfVector = normalize(viewDir + lightDir);
  float nDotL = max(dot(normal, lightDir), 0.0);
  float nDotV = max(dot(normal, viewDir), 0.0);
  float hDotV = max(dot(halfVector, viewDir), 0.0);

  vec3 f0 = mix(vec3(0.04), baseColor, metalness);
  vec3 fresnel = fresnelSchlick(hDotV, f0);
  float distribution = distributionGGX(normal, halfVector, roughness);
  float geometry = geometrySmith(normal, viewDir, lightDir, roughness);
  vec3 specular = (distribution * geometry * fresnel) / max(4.0 * nDotV * nDotL, 0.000001);

  vec3 diffuse = (1.0 - fresnel) * (1.0 - metalness) * baseColor / PI;
  vec3 direct = (diffuse + specular) * nDotL * shadow * uLightIntensity;

  vec3 reflected = reflect(-viewDir, normal);
  float sky = 0.45 + 0.55 * max(reflected.y, 0.0);
  vec3 envColor = mix(vec3(0.05, 0.06, 0.075), vec3(0.78, 0.86, 1.0), sky);
  vec3 envSpecular = envColor * fresnel * mix(1.0, 0.28, roughness);
  vec3 envDiffuse = baseColor * (1.0 - metalness) * 0.24;
  vec3 ambient = (envDiffuse + envSpecular) * uEnvIntensity;

  return direct + ambient;
}

bool shadeMenger(vec3 rayTarget, out vec3 color) {
  vec3 rayDir = normalize(rayTarget - cameraPosition);
  vec3 hitPosition;
  float hitDistance;

  if (!traceMenger(cameraPosition, rayDir, hitPosition, hitDistance)) {
    return false;
  }

  vec3 hitNormal = mengerNormal(hitPosition);
  vec3 viewDir = normalize(cameraPosition - hitPosition);
  vec3 lightDir = normalize(uLightDir);
  float diffuse = max(dot(hitNormal, lightDir), 0.0);
  float shadow = 1.0;

  if (diffuse > 0.0) {
    vec3 shadowOrigin = hitPosition + hitNormal * 0.003 + lightDir * 0.002;
    shadow = mengerShadow(shadowOrigin, lightDir);
  }

  vec3 baseColor = mengerColor(hitPosition);
  color = shadePbr(baseColor, hitNormal, viewDir, lightDir, shadow);
  return true;
}

void main() {
  vec3 dx = dFdx(vWorldPosition);
  vec3 dy = dFdy(vWorldPosition);
  vec3 color = vec3(0.0);
  float coverage = 0.0;
  vec3 sampleColor;

  vec2 offsets[4];
  offsets[0] = vec2(-0.375, -0.125);
  offsets[1] = vec2( 0.125, -0.375);
  offsets[2] = vec2(-0.125,  0.375);
  offsets[3] = vec2( 0.375,  0.125);

  for (int i = 0; i < 4; i++) {
    vec3 target = vWorldPosition + dx * offsets[i].x + dy * offsets[i].y;
    if (shadeMenger(target, sampleColor)) {
      color += sampleColor;
      coverage += 1.0;
    }
  }

  if (coverage <= 0.0) {
    discard;
  }

  gl_FragColor = vec4(color / coverage, coverage * 0.25);
}
`;

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
  private raymarchMaterial: ShaderMaterial;
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
    dir.shadow.mapSize.set(PREVIEW_SHADOW_SIZE, PREVIEW_SHADOW_SIZE);
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

    this.raymarchMaterial = new ShaderMaterial({
      vertexShader: MENGER_RAYMARCH_VERTEX,
      fragmentShader: MENGER_RAYMARCH_FRAGMENT,
      transparent: true,
      uniforms: {
        uSolidColor: { value: new Color('#3a7bd5') },
        uGradStart: { value: new Color('#3a7bd5') },
        uGradEnd: { value: new Color('#f7971e') },
        uLightDir: { value: new Vector3(1, 1, 1).normalize() },
        uColorMode: { value: 0 },
        uGradDir: { value: 1 },
        uMengerDepth: { value: 1 },
        uLightIntensity: { value: 1.2 },
        uEnvIntensity: { value: 1 },
        uMetalness: { value: 0.3 },
        uRoughness: { value: 0.5 },
      },
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

    let mesh: Mesh;
    if (fractal.id === 'menger-raymarch') {
      this.updateMengerRaymarchMaterial(params);
      mesh = new Mesh(new BoxGeometry(2, 2, 2), this.raymarchMaterial);
      mesh.castShadow = false;
      mesh.receiveShadow = false;
    } else {
      const geomData = fractal.build(params);
      const geometry = new BufferGeometry();
      geometry.setAttribute('position', new BufferAttribute(geomData.positions, 3));
      geometry.setAttribute('color', new BufferAttribute(geomData.colors, 3));
      geometry.computeVertexNormals();
      this.fitDirectionalShadowCamera(geometry);
      mesh = new Mesh(geometry, this.material);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    }

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

  private fitDirectionalShadowCamera(geometry: BufferGeometry): void {
    geometry.computeBoundingSphere();
    const radius = (geometry.boundingSphere?.radius ?? 2) * 1.15;
    const shadowCamera = this.dirLight.shadow.camera;
    shadowCamera.left = -radius;
    shadowCamera.right = radius;
    shadowCamera.top = radius;
    shadowCamera.bottom = -radius;
    shadowCamera.near = 0.5;
    shadowCamera.far = 20;
    shadowCamera.updateProjectionMatrix();
    this.dirLight.shadow.bias = -0.00035;
    this.dirLight.shadow.normalBias = 0.012;
  }

  private setShadowMapSize(size: number): void {
    if (this.dirLight.shadow.mapSize.x === size && this.dirLight.shadow.mapSize.y === size) {
      return;
    }

    this.dirLight.shadow.mapSize.set(size, size);
    this.dirLight.shadow.map?.dispose();
    this.dirLight.shadow.map = null;
    this.dirLight.shadow.needsUpdate = true;
  }

  private updateMengerRaymarchMaterial(params: FractalParams): void {
    const uniforms = this.raymarchMaterial.uniforms;
    (uniforms.uSolidColor.value as Color).set(params.color.solidColor);
    (uniforms.uGradStart.value as Color).set(params.color.gradStart);
    (uniforms.uGradEnd.value as Color).set(params.color.gradEnd);
    (uniforms.uLightDir.value as Vector3).copy(this.dirLight.position).normalize();
    uniforms.uColorMode.value = params.color.mode === 'gradient' ? 1 : 0;
    uniforms.uGradDir.value = params.color.gradDir === 'vertical' ? 1 : 0;
    uniforms.uMengerDepth.value = Math.min(params.depth, 10);
    uniforms.uLightIntensity.value = params.pbr.lightIntensity;
    uniforms.uEnvIntensity.value = params.pbr.envIntensity;
    uniforms.uMetalness.value = params.pbr.metalness;
    uniforms.uRoughness.value = params.pbr.roughness;
    this.raymarchMaterial.wireframe = params.pbr.wireframe;
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
    this.setShadowMapSize(EXPORT_SHADOW_SIZE);
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
    this.setShadowMapSize(PREVIEW_SHADOW_SIZE);
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

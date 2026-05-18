# フラクタルモデル 開発計画書

## 技術スタック

| 用途 | パッケージ |
|------|-----------|
| 言語 | TypeScript 6 |
| パッケージ管理 | pnpm |
| バンドラー | vite |
| 2D描画 | HTML Canvas API |
| 3D描画 | three.js + OrbitControls |

依存関係の例:
```json
{
  "dependencies": {
    "three": "^0.176.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "typescript": "^6.0.0",
    "@types/three": "^0.176.0"
  }
}
```

`tsconfig.json` は `vite` の推奨設定をベースに、`strict: true` を有効化する。

## プロジェクト構成

```
fractal-models/
  src/
    main.ts              # エントリポイント、UI初期化
    fractals/
      sierpinski2d.ts    # シェルピンスキーのギャスケット（2D）
      sierpinski3d.ts    # シェルピンスキーの三角錐（3D）
      menger.ts          # メンガーのスポンジ（3D）
      koch2d.ts          # コッホ曲線（2D）
      koch3d.ts          # コッホ曲線の三次元版（3D）
    renderer/
      renderer2d.ts      # Canvas 2D レンダラー
      renderer3d.ts      # three.js WebGL レンダラー
    ui/
      controls.ts        # パラメータUIの生成・管理
      exporter.ts        # PNG書き出し処理
    types/
      fractal.ts         # フラクタル共通インターフェース定義
  index.html
  package.json
  tsconfig.json
  vite.config.ts
  example/               # 既存のサンプルスクリプト（参考実装）
```

## 描画するフラクタル

### 2D

| フラクタル | 実装方式 | 参考ファイル |
|-----------|---------|------------|
| シェルピンスキーのギャスケット | Canvas 2D (三角形の再帰塗りつぶし) | — |
| コッホ曲線 | Canvas 2D (三角形の再帰コピー・縮小・配置) | example/koch2d/ |

#### コッホ曲線の実装アルゴリズム

参考実装（`example/koch2d/Koch.pde`）に基づく三角形ベースの手法を採用する。
折れ線を伸ばす方式ではなく、**三角形をコピー・縮小・回転して再帰的に置き換える**方式。

1. 初期形状として正三角形を1つ用意する
2. 各ステップで1つの三角形を、頂点を共有する2つの子三角形に分割する
   - 底辺を3等分した中間2点を新たな底辺端点とし、元の頂点を共有した子三角形×2を生成
   - `split(bottomMidLeft, top, bottomLeft)` / `split(bottomMidRight, top, bottomRight)`
3. 最大深さに達した葉ノードの三角形を Canvas に塗りつぶし描画する

これにより折れ線ベースと視覚的に等価なコッホ曲線が描画される。

### 3D

| フラクタル | 実装方式 | 参考ファイル |
|-----------|---------|------------|
| シェルピンスキーの四面体 | three.js BufferGeometry | example/sierpinski3d/ |
| メンガーのスポンジ | three.js BufferGeometry | example/menger/ |
| コッホ曲線の三次元版 | three.js BufferGeometry | example/koch3d/koch3d.js |

各フラクタルは `example/` 配下に参考実装が同梱されている。

| 参考実装 | 言語 | 備考 |
|---------|------|------|
| example/koch2d/ | Processing (Java) | 三角形コピー・縮小方式、Koch.pde + renderKoch.pde |
| example/koch3d/koch3d.js | JavaScript | 四面体の再帰縮小・回転 |
| example/sierpinski3d/ | Processing | 3D四面体ギャスケット |
| example/menger/ | OpenSCAD | メンガースポンジ |

## 共通パラメータ（全フラクタル）

| パラメータ | UI部品 | 範囲 |
|-----------|--------|------|
| 再帰の深さ | スライダー | 0〜フラクタルごとの上限（下表） |
| 色モード | ラジオボタン | 単色 / グラデーション / テクスチャ（2Dのみ） |
| 単色カラー | カラーピッカー | 色モードが単色時のみ表示 |
| グラデーション開始色 | カラーピッカー | 色モードがグラデーション時のみ表示 |
| グラデーション終了色 | カラーピッカー | 色モードがグラデーション時のみ表示 |
| グラデーション方向 | セレクトボックス | 深さ基準 / 上下 / 左右（グラデーション時のみ表示） |

グラデーションは再帰の深さレベルに応じた色補間を基本とする。

### フラクタルごとの深さ上限

| フラクタル | 上限 | 理由 |
|-----------|------|------|
| コッホ曲線（2D） | **20** | 2²⁰≈1M三角形。深さが大きい場合はブラウザフリーズのリスクあり，UI上で警告を表示する |
| シェルピンスキーギャスケット（2D） | 10 | 3¹⁰≈6万三角形 |
| シェルピンスキーの四面体（3D） | 8 | 3⁸≈6500四面体 |
| メンガースポンジ（3D） | 4 | 20⁴=16万個の立方体。depth5以上はスキップ |
| コッホ曲線の三次元版（3D） | 8 | 参考実装のdepth=12だと時間がかかるため上限設定 |

## 2Dフラクタルのテクスチャ仕様

参考実装（`example/koch2d/renderKoch.pde`）が `texture(img)` でタイル画像を三角形ポリゴンにマッピングしている手法を踏襲する。

- **色モード「テクスチャ」** を選択するとテクスチャUIが表示される
- ユーザーはローカルの画像ファイル（PNG / JPEG）を選択してアップロードできる（`<input type="file">`）
- アップロードされた画像は `HTMLImageElement` → `CanvasRenderingContext2D.drawImage()` で各三角形ポリゴンに UV マッピングする
  - **各三角形にテクスチャ全体を貼る**（参考実装 `renderKoch.pde` と同じ方式）
- テクスチャ画像はプレビュー・書き出しの両解像度で利用する（`drawImage` の拡縮に委ねる）
- テクスチャ選択中はグラデーション・単色カラーのUIは非表示にする

## 解像度仕様

出力画像は**正方形**。A4ではなく正方形キャンバスとして書き出す。

| モード | 解像度 | 用途 |
|--------|--------|------|
| プレビュー | 800 × 800 px | リアルタイム操作 |
| 書き出し（300dpi 相当） | 3508 × 3508 px | 印刷（約297mm角） |

正方形 300dpi 根拠: 297mm ÷ 25.4 × 300 ≈ 3508px

- 背景色は透明（`clearColor` のアルファ = 0、PNG として保存）
- 2D: `canvas.toDataURL('image/png')` で書き出し
- 3D: `WebGLRenderer` は **`preserveDrawingBuffer: true`** で初期化する（これを指定しないと `toDataURL()` が空画像を返す）
  - `renderer.render()` 後に `renderer.domElement.toDataURL('image/png')` で書き出し
  - 書き出し時はレンダラーのサイズを 3508 × 3508 に一時変更し、書き出し後にプレビューサイズへ戻す

## 2D/3Dキャンバス切り替え設計

Canvas 2DコンテキストとWebGLコンテキストは同一`<canvas>`に共存できない。以下の方針で対応する。

- `index.html` に `<canvas id="canvas2d">` と `<canvas id="canvas3d">` を並列配置する
- 選択中のフラクタルが2Dなら `canvas2d` を表示・`canvas3d` を非表示（`display: none`）、逆は反対
- 2つのレンダラーインスタンス（`renderer2d.ts` / `renderer3d.ts`）は常時保持し、切り替え時に当該レンダラーの `render()` を呼び出す

## UIレイアウト（概要）

```
┌─────────────────────────────────────────────────────┐
│  [フラクタル選択 ▼]                                   │
│                                                      │
│  再帰の深さ: [━━●─────] 3                            │
│  色モード:   ● 単色  ○ グラデーション  ○ テクスチャ   │
│  カラー:     [■] #3a7bd5                             │
│  テクスチャ: [ファイルを選択...]  ※テクスチャ時のみ   │
│                                                      │
│  ┌──────────────────────────┐                        │
│  │                          │                        │
│  │        Canvas/WebGL      │                        │
│  │      (プレビュー)         │                        │
│  │                          │                        │
│  └──────────────────────────┘                        │
│                                                      │
│                              [PNG書き出し ↓]        │
└─────────────────────────────────────────────────────┘
```

3Dフラクタル選択時はキャンバス上でマウスドラッグによるOrbitControls操作が可能。

## 開発フェーズ

### Phase 1 — プロジェクト基盤
- [ ] `pnpm init` + vite + TypeScript 6 + three.js セットアップ
- [ ] `tsconfig.json` 作成（`strict: true`、`moduleResolution: bundler`）
- [ ] `index.html` / `main.ts` のスケルトン作成
- [ ] `types/fractal.ts`: フラクタル共通インターフェース定義
- [ ] UIコンポーネント（フラクタル選択・パラメータスライダー）の実装

### Phase 2 — 2Dフラクタル
- [ ] `renderer2d.ts`: Canvas 2D ラッパー（プレビュー 800px / 書き出し 3508px 切り替え対応）
- [ ] `sierpinski2d.ts`: シェルピンスキーのギャスケット（三角形の再帰塗りつぶし）
- [ ] `koch2d.ts`: コッホ曲線（`example/koch2d/Koch.pde` を参考に三角形コピー・縮小方式で実装、深さ上限=20）
- [ ] 色・グラデーション適用（深さレベル基準の色補間）
- [ ] テクスチャモード: 画像アップロードUI（PNG/JPEG のみ許可）+ clipPath + drawImage によるアフィン変換三角形UVマッピング
  - テクスチャ読み込み失敗時はエラーメッセージを表示し選択を解除する
- [ ] 深さ大時のブラウザフリーズ警告表示（コッホ2D depth≧16 を目安に閾値設定）
- [ ] PNG書き出し（`exporter.ts`）: ファイル名は `{フラクタル名}-depth{n}.png` 形式、透明背景
  - 書き出し中はUIを操作不可にし、失敗時はユーザーへ通知する

### Phase 3 — 3Dフラクタル
- [ ] `renderer3d.ts`: three.js シーン・カメラ・OrbitControls 初期化（**`preserveDrawingBuffer: true`** を必ず指定）
  - `requestAnimationFrame` によるレンダーループを実装し、OrbitControls の変更を反映する（**60fps** に固定: `delta < 1000/60` の場合はスキップ）
- [ ] 2D/3Dキャンバスのshow/hide切り替えロジックを `main.ts` に実装
  - 非表示側のレンダーループは停止し、イベントリスナーを残さない
- [ ] `sierpinski3d.ts`: `example/sierpinski3d/` を参考に BufferGeometry へ移植
- [ ] `menger.ts`: `example/menger/` を参考に BufferGeometry へ移植
- [ ] `koch3d.ts`: `example/koch3d/koch3d.js` を参考に BufferGeometry へ移植
- [ ] フラクタル切り替え・再描画時に不要な `BufferGeometry` / `Material` を `dispose()` して GPU メモリを解放
- [ ] 頂点カラーによるグラデーション（深さ基準 / 上下(Y) / 左右(X)）
- [ ] 書き出し時の解像度切り替え（3508 × 3508）+ `camera.aspect` 更新 + 書き出し後に元サイズへ復元 + 透明背景

### Phase 4 — 3D PBRシェーダ

three.js の `MeshPhysicalMaterial`（PBR: Physically Based Rendering）を 3D フラクタルに適用し、より質感のある表現を可能にする。

#### 使用クラスと根拠

| クラス | 用途 |
|--------|------|
| `MeshPhysicalMaterial` | metalness/roughness + clearcoat + iridescence などを持つフル PBR マテリアル |
| `PMREMGenerator` | 環境マップをプリフィルタリングし IBL（Image-Based Lighting）を有効化 |
| `EquirectangularReflectionMapping` | HDRI 等の等緯度長方形マップを環境光として使用するためのマッピング方式 |

`MeshStandardMaterial` は metalness/roughness PBR の基本実装で、`MeshPhysicalMaterial` はその拡張（clearcoat・iridescence・transmission・sheenなど）。3D フラクタルには `MeshPhysicalMaterial` を採用する。

#### 追加する UI パラメータ（3D 選択時のみ表示）

| パラメータ | UI部品 | 範囲 | 説明 |
|-----------|--------|------|------|
| Metalness | スライダー | 0.0〜1.0 | 金属感（0=非金属, 1=完全金属） |
| Roughness | スライダー | 0.0〜1.0 | 粗さ（0=鏡面, 1=完全拡散） |
| Clearcoat | スライダー | 0.0〜1.0 | クリアコート層の強度 |
| Clearcoat Roughness | スライダー | 0.0〜1.0 | クリアコート層の粗さ |
| Iridescence | スライダー | 0.0〜1.0 | 虹彩（シャボン玉・油膜）効果の強度 |
| Light強度 | スライダー | 0.0〜5.0 | DirectionalLight の明るさ |
| L.方位角 | スライダー | 0°〜360° | ライト水平方向の回転 |
| L.仰角 | スライダー | 0°〜90° | ライトの高さ（0°=水平, 90°=真上）|
| IBL強度 | スライダー | 0.0〜3.0 | `scene.environmentIntensity`（IBL 全体の明るさ）|
| Camera FOV | スライダー | 10°〜120° | 透視投影の画角（小さいほど望遠、大きいほど広角）|
| Wireframe | チェックボックス | on/off | ワイヤーフレーム表示切り替え |

デフォルト値: metalness=0.3, roughness=0.5, clearcoat=0.0, clearcoatRoughness=0.1, iridescence=0.0, lightIntensity=1.2, lightAzimuth=45°, lightElevation=45°, envIntensity=1.0, fov=45°

#### 環境光（IBL）設定

- `renderer3d.ts` 内で `PMREMGenerator` を使用し、`RoomEnvironment`（three.js 同梱）をプリフィルタリングして `scene.environment` に設定する
- 外部 HDRI ファイルは不要（バンドルサイズ増加を避けるため `RoomEnvironment` を優先）
- `scene.environment` を設定すると IBL が有効になり、metalness/roughness の見た目が大きく改善する
- `scene.background` は `null` のまま（背景透明を維持）

```typescript
import { PMREMGenerator, RoomEnvironment } from 'three';
// renderer 初期化後に実行
const pmremGenerator = new PMREMGenerator(this.renderer);
this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment()).texture;
pmremGenerator.dispose();
```

#### マテリアル管理

- `MeshPhysicalMaterial` のインスタンスは `Renderer3D` が保持し、フラクタル切り替え時に使い回す（`geometry` のみ差し替え）
- PBR パラメータが変更されたら `material` のプロパティを更新し `needsUpdate = true` は不要（`MeshPhysicalMaterial` のほとんどのプロパティは動的更新対応）
- `vertexColors: true` は維持し、色モード（単色/グラデーション）はこれまで通り頂点カラーで制御する

#### 実装タスク

- [ ] `types/fractal.ts` に `PbrParams` インターフェースを追加し `FractalParams` に統合
- [ ] `ui/controls.ts` に PBR スライダー群を追加（3D 選択時のみ表示・2D 選択時は非表示）
- [ ] `renderer3d.ts` で `MeshPhysicalMaterial` へ切り替え + `PMREMGenerator` + `RoomEnvironment` による IBL 初期化
- [ ] フラクタル切り替え時のマテリアル使い回し（geometry のみ `dispose()` → 差し替え）
- [ ] Wireframe チェックボックスの on/off 対応

### Phase 5 — プリセット保存・読み込み（JSON）

現在の全設定（色・カメラ・マテリアル）を JSON ファイルとして書き出し、ドロップで復元する機能を追加する。

#### JSON スキーマ設計

```jsonc
{
  "version": 1,                    // 互換性管理用バージョン番号
  "fractalId": "sierpinski3d",     // フラクタル ID
  "depth": 4,                      // 再帰の深さ
  "color": {
    "mode": "gradient",            // "solid" | "gradient" | "texture"
    "solidColor": "#3a7bd5",
    "gradStart": "#ff0000",
    "gradEnd": "#0000ff",
    "gradDir": "depth"             // "depth" | "vertical" | "horizontal"
    // texture は再現不可のため省略（読み込み時は solid にフォールバック）
  },
  "pbr": {                         // 3D のみ。2D の場合は省略可
    "metalness": 0.3,
    "roughness": 0.5,
    "clearcoat": 0.0,
    "clearcoatRoughness": 0.1,
    "iridescence": 0.0,
    "wireframe": false,
    "lightIntensity": 1.2,
    "lightAzimuth": 45,
    "lightElevation": 45,
    "envIntensity": 1.0
  },
  "camera": {                      // 3D のみ。2D の場合は省略可
    "position": [2, 2, 3],         // camera.position.toArray()
    "target": [0, 0, 0],           // controls.target.toArray()
    "fov": 45                      // PerspectiveCamera の画角（度）
  }
}
```

- テクスチャ画像はバイナリのため JSON に含めない。読み込み時に `color.mode === "texture"` であれば `"solid"` にフォールバックし、ユーザーに通知する。
- `version` フィールドが一致しない場合は読み込みを拒否し、エラーを表示する。

#### UI 仕様

- **書き出しボタン**: 「⚙ プリセット保存」ボタン（PNG 書き出しボタンの隣に配置）をクリックすると `{fractalId}-preset.json` をダウンロード
- **ドロップ読み込み**: キャンバスエリアまたはコントロールパネル全体に `dragover` / `drop` を設定し、JSON ファイルをドロップすると即座に UI へ反映・再描画

#### 実装タスク

- [ ] `src/ui/presetManager.ts` を作成: `exportPreset(state, camera, controls)` / `importPreset(json)` を実装
- [ ] `src/types/fractal.ts` に `PresetV1` インターフェースを追加（バージョン管理用）
- [ ] `index.html` に「プリセット保存」ボタンを追加
- [ ] `src/main.ts` でドロップイベントを受け取り `importPreset` を呼び出す → UI 状態を更新して再描画
- [ ] テクスチャモード読み込み時の `solid` フォールバック処理とユーザー通知
- [ ] `version` 不一致時のエラー表示

### Phase 6 — 仕上げ
- [ ] WebGL コンテキストロスト時の対応（再読込を案内するメッセージを表示）
- [ ] レスポンシブUI調整
- [ ] README 更新（動作確認済みブラウザ・使い方・ライセンスを記載）

## 動作確認チェックリスト

実装完了後に以下を確認する。

| # | 確認内容 |
|---|----------|
| 1 | 各フラクタルを代表的な深さ（上限値付近含む）で描画してもレイアウトが崩れない |
| 2 | 2D/3D の切り替え後も UI のパラメータ値が正しく反映される |
| 3 | 書き出した PNG が 3508×3508 px・背景透過になっている |
| 4 | 3D フラクタルで OrbitControls の回転・ズーム・パンが正常に動作する |
| 5 | テクスチャ読み込み失敗時にエラーが表示され操作を継続できる |
| 6 | コッホ2D で depth≧16 付近にフリーズ警告が表示される |
| 7 | フラクタル切り替えを繰り返しても GPU メモリリークが発生しない（DevTools Memory で確認） |
| 8 | PBR スライダーを動かすと 3D フラクタルの質感がリアルタイムに変化する |
| 9 | Metalness=1.0 / Roughness=0.0 で鏡面反射が確認できる |
| 10 | Iridescence=1.0 でシャボン玉状の干渉色が確認できる |
| 11 | 2D フラクタル選択中は PBR パラメータ UI が非表示になっている |
| 12 | プリセット保存ボタンで有効な JSON がダウンロードされる |
| 13 | JSON をドロップすると UI・描画が即座に復元される |
| 14 | テクスチャモードの JSON 読み込み時に solid フォールバックの通知が出る |
| 15 | `version` 不一致 JSON をドロップするとエラーが表示され読み込まれない |



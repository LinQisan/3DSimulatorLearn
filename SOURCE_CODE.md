# 十字路シミュレーション 完成版：全ソースコード

実行に必要な全10ファイル、テスト、READMEの全文です。コードの省略はありません。この一覧ファイル自身は含めません。

## index.html

````html
<!doctype html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#173d35">
  <title>十字路の交通信号シミュレーション｜完成版</title>
  <link rel="icon" href="data:,">
  <link rel="stylesheet" href="style.css?v=20261027">
  <!-- 本体と追加機能は、同じCDN・同じバージョンに固定する。 -->
  <script type="importmap">
    {
      "imports": {
        "three": "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js",
        "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.180.0/examples/jsm/"
      }
    }
  </script>
</head>
<body>
  <header class="header">
    <span class="brand-icon" aria-hidden="true">╋</span>
    <div><p class="eyebrow">交通のしくみを、立体で観察する</p><h1>十字路シミュレーション</h1></div>
    <span class="version">完成版 <span>ステップ 1〜6</span></span>
  </header>
  <main class="layout">
    <aside class="panel" aria-label="操作パネル">
      <p class="eyebrow">条件を変えて、比べてみる</p>
      <h2>交差点の実験室。</h2>
      <p class="description">交通量と信号時間を調整して、車列や待ち時間の変化を観察しましょう。</p>
      <div class="buttons" aria-label="実行操作">
        <button id="start" class="primary" type="button" disabled>開始</button>
        <button id="pause" type="button" disabled>一時停止</button>
        <button id="resume" type="button" disabled>再開</button>
        <button id="reset" type="button" disabled>リセット</button>
      </div>
      <h3>シミュレーション設定</h3>
      <div id="parameter-fields"></div>
      <p id="notice" class="notice" role="status">交通量は東西・南北それぞれ2方向の合計です。</p>
      <p class="touch-help">交通量・速度は変更後すぐに反映。信号時間は次に始まる各区間から反映します。</p>
      <details class="help">
        <summary>視点操作と測定の定義</summary>
        <p>左ドラッグで回転、ホイールでズーム、右ドラッグで移動。3Dビューにフォーカスすると矢印キーでも移動できます。タッチは1本指で回転、2本指でズーム・移動。</p>
        <p>待機は停止線に進入する前の秒速0.3m未満の車両です。平均待ち時間は全発生車両の累積停止待ち時間の平均（走行中・待ち時間0秒の車両も含む）。最長待ち時間は1台の累積停止待ち時間の最大値です。</p>
        <p>最大待ち行列は1方向あたりの待機台数の過去最大。通過は車両の後端が道路端から退出した台数です。場外の進入待ちは発生台数・待ち時間の集計に含めません。</p>
        <p>全赤の設定時間が終わっても交差点内に車両がある場合は、通過するまで全赤を延長します。黄・赤になる前に停止線へ進入済みの車両は、そのまま退出します。</p>
        <p>リセットは設定と視点を維持し、同じ乱数の到着列で初めから比較できます。タブが非表示になると自動で一時停止します。</p>
      </details>
    </aside>
    <div class="observation">
      <section class="signal-strip" aria-label="現在の信号">
        <div id="signal-EW" class="signal-state" data-color="green"><span class="signal-dot"></span><span>東西方向</span><strong id="color-EW">青</strong></div>
        <div id="signal-NS" class="signal-state" data-color="red"><span class="signal-dot"></span><span>南北方向</span><strong id="color-NS">赤</strong></div>
        <div class="phase"><span id="phase-name">東西方向が青</span><strong id="remaining">残り 20.0 秒</strong><div class="phase-track"><div id="phase-fill"></div></div></div>
      </section>
      <section class="viewport" aria-label="十字路の3Dビュー">
        <div class="view-heading"><span id="status-dot" class="dot"></span><span id="status" role="status">3Dシーンを読み込み中…</span><span id="speed-label">1 倍速</span></div>
        <div id="scene-container"></div>
        <div class="view-footer"><span>片側1車線・左側通行・直進のみ</span><button id="reset-view" type="button" disabled>↺ 初期の視点に戻す</button></div>
        <p id="error" class="error" role="alert" hidden></p>
      </section>
      <section class="measurements" aria-label="測定結果">
        <div class="section-heading"><h2>交差点のいま</h2><span>シミュレーション時間で集計</span></div>
        <div class="metrics">
          <div class="metric"><span>発生車両数</span><strong id="generated">0 台</strong></div>
          <div class="metric"><span>通過車両数</span><strong id="passed">0 台</strong></div>
          <div class="metric"><span>現在の車両数</span><strong id="active">0 台</strong></div>
          <div class="metric"><span>最大待ち行列（1方向）</span><strong id="maxQueue">0 台</strong></div>
          <div class="metric accent"><span>平均待ち時間</span><strong id="averageWait">0.0 秒</strong></div>
          <div class="metric"><span>最長待ち時間</span><strong id="longestWait">0.0 秒</strong></div>
          <div class="metric"><span>経過時間</span><strong id="elapsed">0 分 00 秒</strong></div>
          <div class="metric"><span>場外の進入待ち</span><strong id="pending">0 台</strong></div>
        </div>
        <div class="queues" aria-label="方向別の待機車両数"><span class="queue-title">方向別の待機</span><span>北 <strong id="queue-north">0 台</strong></span><span>東 <strong id="queue-east">0 台</strong></span><span>南 <strong id="queue-south">0 台</strong></span><span>西 <strong id="queue-west">0 台</strong></span></div>
      </section>
    </div>
  </main>
  <noscript>シミュレーションを動かすにはJavaScriptを有効にしてください。</noscript>
  <script type="module" src="js/main.js"></script>
</body>
</html>
````

## style.css

````css
:root {
  color-scheme: light;
  font-family: -apple-system, BlinkMacSystemFont, "Noto Sans JP", "Yu Gothic", sans-serif;
  color: #203c35;
  background: #f7f8f4;
  font-synthesis: none;
  font-variant-numeric: tabular-nums;
}
* { box-sizing: border-box; }
body { margin: 0; }
.header { min-height: 90px; padding: 20px 30px; display: flex; align-items: center; gap: 16px; border-bottom: 1px solid #dce3d9; }
.brand-icon { display: grid; place-items: center; width: 46px; height: 46px; border-radius: 13px; background: #173d35; color: #d6edb8; font-size: 32px; }
.eyebrow { margin: 0 0 7px; font-size: 11px; font-weight: 600; letter-spacing: .08em; color: #728279; }
h1 { margin: 0; font-size: 20px; font-weight: 650; letter-spacing: .03em; }
.version { margin-left: auto; padding: 9px 15px; border: 1px solid #d5dfd0; border-radius: 30px; font-size: 12px; white-space: nowrap; }
.version span { margin-left: 8px; color: #728279; font-size: 10px; }
.layout { max-width: 1800px; margin: auto; display: grid; grid-template-columns: 290px minmax(0, 1fr); gap: 26px; padding: 26px; }
.panel { padding: 12px 4px; }
h2 { margin: 0 0 14px; font-size: 23px; letter-spacing: -.04em; }
.description, .touch-help, .notice, .help p { color: #718077; font-size: 12px; line-height: 1.85; }
.description { margin: 0 0 22px; }
h3 { margin: 25px 0 10px; font-size: 13px; }
button { padding: 11px 12px; border: 1px solid #cbd8c6; border-radius: 8px; background: #fff; color: #294e40; font: inherit; font-size: 12px; cursor: pointer; }
button:hover:not(:disabled) { background: #eaf0e3; }
button.primary { background: #244c3f; color: #fff; border-color: #244c3f; }
button.primary:hover:not(:disabled) { background: #376750; }
button:disabled { cursor: default; opacity: .35; }
button:focus-visible, input:focus-visible, summary:focus-visible { outline: 3px solid #61856b; outline-offset: 3px; }
.buttons { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.field { display: flex; align-items: center; justify-content: space-between; gap: 6px; padding: 11px 0; border-bottom: 1px solid #e1e6dd; font-size: 11px; }
.input-wrap { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.input-wrap > span { width: 34px; font-size: 10px; color: #718077; }
input { width: 66px; min-width: 0; padding: 8px 4px 8px 8px; border: 1px solid #cdd9c7; border-radius: 6px; background: #fff; color: #203c35; font: inherit; font-size: 13px; }
.notice { margin: 14px 0 6px; padding: 12px; background: #eaf0e3; border-radius: 8px; font-size: 11px; }
.touch-help { margin: 10px 0 18px; font-size: 10px; }
.help { border-top: 1px solid #dce3d9; padding-top: 14px; }
.help summary { cursor: pointer; font-size: 11px; }
.help p { font-size: 11px; }
.observation { min-width: 0; }
.signal-strip { display: grid; grid-template-columns: 1fr 1fr 1.5fr; gap: 16px; padding: 17px 20px; margin-bottom: 14px; border: 1px solid #dce3d9; border-radius: 12px; background: #fff; }
.signal-state { display: flex; align-items: center; gap: 9px; font-size: 12px; }
.signal-state strong { margin-left: auto; font-size: 14px; }
.signal-dot { width: 13px; height: 13px; flex-shrink: 0; border-radius: 50%; background: #cf625a; box-shadow: 0 0 0 4px #cf625a12; }
[data-color="green"] .signal-dot { background: #309e7a; box-shadow: 0 0 0 4px #309e7a14; }
[data-color="yellow"] .signal-dot { background: #d49a20; box-shadow: 0 0 0 4px #d49a2014; }
.phase { display: flex; flex-wrap: wrap; justify-content: space-between; gap: 6px; padding-left: 18px; border-left: 1px solid #e2e6dd; font-size: 10px; }
.phase strong { font-weight: 600; }
.phase-track { width: 100%; height: 3px; overflow: hidden; background: #e9eee5; border-radius: 4px; }
#phase-fill { height: 100%; width: 100%; background: #719c76; }
.viewport { position: relative; height: clamp(420px, 56dvh, 740px); overflow: hidden; border: 1px solid #d9e1d3; border-radius: 16px; background: #e8eee1; }
#scene-container { width: 100%; height: 100%; }
canvas { display: block; width: 100%; height: 100%; touch-action: none; }
canvas:focus-visible { outline: 3px solid #497b62; outline-offset: -5px; }
.view-heading { position: absolute; z-index: 1; top: 20px; left: 22px; right: 22px; display: flex; align-items: center; gap: 8px; font-size: 11px; pointer-events: none; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: #89998b; }
.dot.running { background: #308a61; box-shadow: 0 0 0 4px #308a6117; }
#speed-label { margin-left: auto; color: #657764; }
.view-footer { position: absolute; left: 20px; right: 20px; bottom: 17px; display: flex; justify-content: space-between; align-items: center; gap: 12px; font-size: 10px; color: #657764; pointer-events: none; }
.view-footer button { padding: 9px 12px; font-size: 10px; background: #f7f8f4eb; pointer-events: auto; }
.error { position: absolute; inset: 30% 8% auto; padding: 22px; border-radius: 10px; background: #fff; color: #883c2f; font-size: 14px; line-height: 1.8; }
.measurements { margin-top: 21px; }
.section-heading { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.section-heading h2 { margin: 0; font-size: 16px; }
.section-heading > span { font-size: 10px; color: #7c897e; }
.metrics { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.metric { display: grid; gap: 11px; padding: 16px; border: 1px solid #dce3d9; border-radius: 10px; background: #fff; }
.metric > span { font-size: 10px; color: #7c897e; }
.metric > strong { font-size: 21px; font-weight: 550; letter-spacing: -.03em; }
.metric.accent { background: #eaf0e3; border-color: #dce5d1; }
.queues { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 25px; padding: 18px 2px; font-size: 11px; }
.queue-title { color: #7c897e; }
.queues strong { margin-left: 9px; font-weight: 600; }
@media (max-width: 1000px) {
  .layout { grid-template-columns: 255px minmax(0, 1fr); gap: 18px; padding: 20px; }
  .signal-strip { grid-template-columns: 1fr 1fr; gap: 14px; }
  .phase { grid-column: 1 / -1; border-left: 0; border-top: 1px solid #e2e6dd; padding: 10px 0 0; }
  .metric { padding: 12px; }
  .metric > strong { font-size: 17px; }
}
@media (max-width: 740px) {
  .header { padding: 17px; gap: 10px; min-height: 80px; }
  .brand-icon { width: 35px; height: 35px; font-size: 25px; }
  h1 { font-size: 15px; }
  .header .eyebrow { font-size: 9px; letter-spacing: 0; }
  .version { padding: 7px 10px; font-size: 10px; }
  .version span { display: none; }
  .layout { display: flex; flex-direction: column; padding: 14px 14px 90px; }
  .buttons { position: fixed; z-index: 4; bottom: 12px; left: 14px; right: 14px; grid-template-columns: repeat(4, 1fr); gap: 6px; padding: 8px; border: 1px solid #d4ded0; border-radius: 12px; background: #f7f8f4f5; box-shadow: 0 8px 30px #193f2d18; }
  .buttons button { padding: 11px 4px; }
  .observation { order: -1; }
  .signal-strip { padding: 14px; margin-bottom: 10px; }
  .viewport { height: 52dvh; min-height: 340px; }
  .view-heading { left: 15px; right: 15px; top: 16px; }
  .view-footer { left: 14px; right: 14px; bottom: 13px; }
  .view-footer > span { max-width: 120px; line-height: 1.6; }
  .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .metric > strong { font-size: 21px; }
  .panel { padding: 10px 4px; }
  .field { font-size: 12px; padding: 12px 0; }
  input { width: 85px; }
  .queues { gap: 12px 18px; }
  .queue-title { width: 100%; }
}
````

## js/config.js

````javascript
// 単位はメートル・秒。東が+x、上が+y、南が+zの左側通行。
export const ROAD = Object.freeze({ size: 120, width: 12, stopDistance: 12 });
export const CAR = Object.freeze({ length: 4.2, width: 1.8, gap: 2, speed: 10, acceleration: 2.4, brake: 4.5, headway: 0.8 });
export const STEP = 1 / 60;
export const STOP_CENTER = -ROAD.stopDistance - 0.25 - 0.15 - CAR.length / 2;
export const ENTRY = -ROAD.size / 2 + CAR.length / 2;
export const EXIT = ROAD.size / 2 + CAR.length / 2;
export const DIRECTIONS = Object.freeze([
  { id: 'north', name: '北', axis: 'NS', angle: 0 },
  { id: 'east', name: '東', axis: 'EW', angle: -Math.PI / 2 },
  { id: 'south', name: '南', axis: 'NS', angle: Math.PI },
  { id: 'west', name: '西', axis: 'EW', angle: Math.PI / 2 },
]);
export const DEFAULTS = Object.freeze({ trafficEW: 24, trafficNS: 24, greenEW: 20, greenNS: 20, yellow: 3, allRed: 2, speed: 1 });
export const FIELDS = Object.freeze([
  { key: 'trafficEW', label: '東西方向の交通量', unit: '台／分', min: 0, max: 120, step: 1 },
  { key: 'trafficNS', label: '南北方向の交通量', unit: '台／分', min: 0, max: 120, step: 1 },
  { key: 'greenEW', label: '東西方向の青信号時間', unit: '秒', min: 5, max: 120, step: 1 },
  { key: 'greenNS', label: '南北方向の青信号時間', unit: '秒', min: 5, max: 120, step: 1 },
  { key: 'yellow', label: '黄信号時間', unit: '秒', min: 0, max: 10, step: 1 },
  { key: 'allRed', label: '全赤時間', unit: '秒', min: 0, max: 10, step: 1 },
  { key: 'speed', label: 'シミュレーション速度', unit: '倍', min: 0.25, max: 10, step: 0.25 },
]);

export function validateSettings(settings) {
  for (const field of FIELDS) {
    const value = settings[field.key];
    if (!Number.isFinite(value) || value < field.min || value > field.max) {
      throw new RangeError(`${field.label}は${field.min}〜${field.max}${field.unit}で指定してください。`);
    }
  }
  return { ...settings };
}
````

## js/signals.js

````javascript
// 描画から独立した信号制御。設定変更は、次に始まる区間から使う。
const PHASES = [
  { axis: 'EW', color: 'green', key: 'greenEW', name: '東西方向が青' },
  { axis: 'EW', color: 'yellow', key: 'yellow', name: '東西方向が黄' },
  { axis: null, color: 'red', key: 'allRed', name: '全方向が赤 → 南北へ' },
  { axis: 'NS', color: 'green', key: 'greenNS', name: '南北方向が青' },
  { axis: 'NS', color: 'yellow', key: 'yellow', name: '南北方向が黄' },
  { axis: null, color: 'red', key: 'allRed', name: '全方向が赤 → 東西へ' },
];

export class SignalController {
  constructor(settings) {
    this.settings = settings;
    this.index = 0;
    this.duration = settings.greenEW;
    this.remaining = this.duration;
    this.holding = false;
  }
  get phase() { return PHASES[this.index]; }
  color(axis) { return this.phase.axis === axis ? this.phase.color : 'red'; }
  isGreen(axis) { return this.color(axis) === 'green'; }
  update(dt, intersectionClear) {
    this.remaining -= dt;
    while (this.remaining <= 1e-9) {
      // 全赤を0秒に設定しても、進入済みの車両を安全に退出させる。
      if (this.phase.axis === null && !intersectionClear()) {
        this.remaining = 0;
        this.holding = true;
        return;
      }
      this.index = (this.index + 1) % PHASES.length;
      this.duration = this.settings[this.phase.key];
      this.remaining += this.duration;
      this.holding = false;
    }
  }
}
````

## js/simulation.js

````javascript
import { CAR, DEFAULTS, DIRECTIONS, ENTRY, EXIT, ROAD, STEP, STOP_CENTER, validateSettings } from './config.js';
import { SignalController } from './signals.js';

export class Simulation {
  constructor(settings = DEFAULTS) {
    this.settings = validateSettings(settings);
    this.reset();
  }
  reset() {
    this.state = 'ready';
    this.time = 0;
    this.accumulator = 0;
    this.generated = 0;
    this.passed = 0;
    this.requested = 0;
    this.totalWait = 0;
    this.longestWait = 0;
    this.maxQueue = 0;
    this.seed = 20261027;
    this.signal = new SignalController(this.settings);
    this.lanes = DIRECTIONS.map((direction) => ({ ...direction, cars: [], pending: 0, hazard: 0, threshold: this.exponential() }));
  }
  // 同じ設定でリセットすれば、同じ到着列で比較できる擬似乱数。
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return (this.seed + 0.5) / 4294967296;
  }
  exponential() { return -Math.log(1 - this.random()); }
  setSettings(patch) {
    const next = validateSettings({ ...this.settings, ...patch });
    Object.assign(this.settings, next);
    // 開始前は、変更した青時間を最初の区間から反映する。
    if (this.state === 'ready') this.signal = new SignalController(this.settings);
  }
  start() { if (this.state === 'ready') this.state = 'running'; }
  pause() { if (this.state === 'running') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  get cars() { return this.lanes.flatMap((lane) => lane.cars); }
  get alpha() { return this.state === 'running' ? this.accumulator / STEP : 1; }

  // 実時間のdelta timeを速度倍率で変換し、物理計算は常に1/60秒刻み。
  advance(realDelta) {
    if (this.state !== 'running' || !Number.isFinite(realDelta) || realDelta <= 0) return;
    this.accumulator += realDelta * this.settings.speed;
    while (this.accumulator + 1e-10 >= STEP) {
      this.step();
      this.accumulator = Math.max(0, this.accumulator - STEP);
    }
  }
  step() {
    this.time += STEP;
    for (const lane of this.lanes) {
      // 交通量は2方向の合計台数/分。指数分布の到着間隔を使う。
      lane.hazard += this.settings[`traffic${lane.axis}`] / 120 * STEP;
      while (lane.hazard >= lane.threshold) {
        lane.hazard -= lane.threshold;
        lane.threshold = this.exponential();
        lane.pending += 1;
        this.requested += 1;
      }
      let leader = null;
      let queued = 0;
      // 先頭から更新し、前車の後端より前に後続車を進めない。
      for (const car of lane.cars) {
        car.previous = car.position;
        let limit = Infinity;
        let target = CAR.speed;
        if (leader) {
          limit = leader.position - CAR.length - CAR.gap;
          const room = Math.max(0, limit - car.position - CAR.headway * car.speed);
          target = Math.min(target, Math.sqrt(leader.speed ** 2 + 2 * CAR.brake * room));
        }
        if (!car.committed && !this.signal.isGreen(lane.axis)) {
          limit = Math.min(limit, STOP_CENTER);
          target = Math.min(target, Math.sqrt(2 * CAR.brake * Math.max(0, limit - car.position)));
        }
        const oldSpeed = car.speed;
        car.speed += Math.max(-CAR.brake * STEP, Math.min(CAR.acceleration * STEP, target - car.speed));
        const movement = (oldSpeed + car.speed) / 2 * STEP;
        car.position = Math.min(limit, car.position + movement);
        // 黄への切替直後など、制動距離が足りない場合も境界を越えない。
        car.speed = Math.max(0, Math.min(car.speed, (car.position - car.previous) / STEP));
        if (Number.isFinite(limit) && limit - car.position < 0.02 && car.speed < 0.3) {
          car.position = limit;
          car.speed = 0;
        }
        if (car.position > STOP_CENTER + 1e-7) car.committed = true;
        // 一度停止線へ進入した車両は、黄・赤でも交差点から退出する。
        if (!car.committed && car.speed < 0.3) {
          car.wait += STEP;
          this.totalWait += STEP;
          this.longestWait = Math.max(this.longestWait, car.wait);
          queued += 1;
        }
        leader = car;
      }
      this.maxQueue = Math.max(this.maxQueue, queued);
      const before = lane.cars.length;
      lane.cars = lane.cars.filter((car) => car.position <= EXIT);
      this.passed += before - lane.cars.length;
      const tail = lane.cars.at(-1);
      if (lane.pending > 0 && (!tail || tail.position - ENTRY >= CAR.length + CAR.gap)) {
        lane.cars.push({ id: ++this.generated, direction: lane.id, position: ENTRY, previous: ENTRY, speed: tail ? Math.min(CAR.speed, tail.speed) : CAR.speed, wait: 0, committed: false });
        lane.pending -= 1;
      }
      this.maxQueue = Math.max(this.maxQueue, lane.cars.filter((car) => !car.committed && car.speed < 0.3).length);
    }
    this.signal.update(STEP, () => this.isIntersectionClear());
  }
  isIntersectionClear() {
    return this.lanes.every((lane) => lane.cars.every((car) => !car.committed || car.position - CAR.length / 2 > ROAD.width / 2 + 1));
  }
  statistics() {
    const queues = Object.fromEntries(this.lanes.map((lane) => [lane.id, lane.cars.filter((car) => !car.committed && car.speed < 0.3).length]));
    return { generated: this.generated, passed: this.passed, active: this.generated - this.passed, queues, pending: this.lanes.reduce((total, lane) => total + lane.pending, 0), maxQueue: this.maxQueue, averageWait: this.generated ? this.totalWait / this.generated : 0, longestWait: this.longestWait, time: this.time };
  }
}
````

## js/road.js

````javascript
import * as THREE from 'three';
import { ROAD, DIRECTIONS } from './config.js';

// 1単位を1メートルとし、道路寸法を一か所で管理する。
// 座標は東が+x、上が+y、南が+z。車両・信号の実装時も共通で使う。
export { ROAD } from './config.js';

export function createRoad() {
  const group = new THREE.Group();
  group.name = '交差点';
  const half = ROAD.width / 2;
  const length = ROAD.size / 2 - half;
  const asphalt = new THREE.MeshStandardMaterial({ color: 0x505b58, roughness: 1 });
  const paint = new THREE.MeshBasicMaterial({ color: 0xf5f1dc });
  const ground = new THREE.MeshStandardMaterial({ color: 0xb0c69c, roughness: 1 });
  const curb = new THREE.MeshStandardMaterial({ color: 0xd9dfce, roughness: 1 });

  // 上面の高さを分け、道路と標示のちらつき（Z-fighting）を防ぐ。
  function box(parent, width, height, depth, x, y, z, material) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(width, height, depth), material);
    mesh.position.set(x, y, z);
    mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }
  function mark(parent, width, depth, x, z) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), paint);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.075, z);
    parent.add(mesh);
  }

  // 厚みのある地面と、重なりのない中央の交差部分。
  box(group, ROAD.size, 1.2, ROAD.size, 0, -0.6, 0, ground);
  box(group, ROAD.width, 0.06, ROAD.width, 0, 0.03, 0, asphalt);

  // 四隅の縁石と緑地も、基本図形だけで生成する。
  const cornerSize = ROAD.size / 2 - half - 1;
  const cornerCenter = half + 1 + cornerSize / 2;
  for (const xSign of [-1, 1]) {
    for (const zSign of [-1, 1]) {
      const x = xSign * cornerCenter;
      const z = zSign * cornerCenter;
      box(group, cornerSize, 0.3, cornerSize, x, 0.15, z, curb);
      box(group, cornerSize - 3, 0.06, cornerSize - 3, x, 0.33, z, ground);
    }
  }

  // 北側の道路を原型にして、回転させた4方向を組み立てる。
  for (const { name, angle } of DIRECTIONS) {
    const approach = new THREE.Group();
    approach.name = `${name}側の道路`;
    box(approach, ROAD.width, 0.06, length, 0, 0.03, -half - length / 2, asphalt);
    // 中央の破線は交差部分と停止線付近に引かない。
    for (let distance = ROAD.stopDistance + 5; distance < ROAD.size / 2 - 2; distance += 6) {
      mark(approach, 0.18, 3, 0, -distance);
    }
    for (const x of [-half + 0.35, half - 0.35]) {
      mark(approach, 0.16, length, x, -half - length / 2);
    }
    // 北から南へ向かう進入車線は+x側。回転後も左側通行になる。
    mark(approach, half - 0.7, 0.5, half / 2, -ROAD.stopDistance);
    const label = createDirectionLabel(name);
    label.position.set(half + 5, 1.5, -34);
    approach.add(label);
    approach.rotation.y = angle;
    group.add(approach);
  }
  return group;
}

function createDirectionLabel(text) {
  // 日本語の方角表示をCanvasから生成するため、画像ファイルは不要。
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 128;
  const context = canvas.getContext('2d');
  context.fillStyle = '#294c40';
  context.beginPath();
  context.arc(64, 64, 57, 0, Math.PI * 2);
  context.fill();
  context.fillStyle = '#f5f5e8';
  context.font = '600 58px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 64, 67);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
  sprite.scale.set(4.5, 4.5, 1);
  return sprite;
}
````

## js/traffic-view.js

````javascript
import * as THREE from 'three';
import { CAR, DIRECTIONS, ROAD } from './config.js';

export function createTrafficView(scene) {
  const root = new THREE.Group();
  root.name = '信号機と車両';
  scene.add(root);
  const meshes = new Map();
  const lamps = [];
  const dark = new THREE.MeshStandardMaterial({ color: 0x26372f, roughness: 0.7 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x7e8983, metalness: 0.5, roughness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x26332e, roughness: 1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x526a71, roughness: 0.25 });
  const frontLight = new THREE.MeshBasicMaterial({ color: 0xfff1b5 });
  const rearLight = new THREE.MeshBasicMaterial({ color: 0xc74a40 });
  const bodyGeometry = new THREE.BoxGeometry(CAR.width, 0.65, CAR.length);
  const cabinGeometry = new THREE.BoxGeometry(1.5, 0.6, 2);
  const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10);
  const lightGeometry = new THREE.BoxGeometry(0.4, 0.22, 0.06);
  function mesh(parent, geometry, material, x, y, z) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.castShadow = true;
    item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  // 車両ごとにGPU資源を作らず、形状とマテリアルを共有する。
  const templates = [0xc97953, 0x557c7b, 0xd8c494, 0x869e73, 0xf1eee2].map((color) => {
    const car = new THREE.Group();
    const body = new THREE.MeshStandardMaterial({ color, roughness: 0.55 });
    mesh(car, bodyGeometry, body, 0, 0.62, 0);
    mesh(car, cabinGeometry, glass, 0, 1.15, -0.25);
    for (const x of [-0.92, 0.92]) {
      for (const z of [-1.3, 1.3]) mesh(car, wheelGeometry, rubber, x, 0.3, z).rotation.z = Math.PI / 2;
    }
    for (const x of [-0.55, 0.55]) {
      mesh(car, lightGeometry, frontLight, x, 0.65, CAR.length / 2);
      mesh(car, lightGeometry, rearLight, x, 0.65, -CAR.length / 2);
    }
    return car;
  });
  // 北側を原型として、進入方向に向いた信号機を4か所に配置する。
  for (const direction of DIRECTIONS) {
    const signal = new THREE.Group();
    signal.rotation.y = direction.angle;
    mesh(signal, new THREE.CylinderGeometry(0.15, 0.19, 4.7, 12), metal, 7.4, 2.35, -10.5);
    mesh(signal, new THREE.BoxGeometry(4.4, 0.16, 0.16), metal, 5.2, 4.7, -10.5);
    mesh(signal, new THREE.BoxGeometry(3.4, 1.05, 0.75), dark, 3, 4.7, -10.5);
    for (const [index, color] of ['green', 'yellow', 'red'].entries()) {
      const value = { green: 0x45dcaa, yellow: 0xffc752, red: 0xff6258 }[color];
      const material = new THREE.MeshStandardMaterial({ color: value, emissive: value, emissiveIntensity: 0 });
      mesh(signal, new THREE.SphereGeometry(0.32, 16, 12), material, 4 - index, 4.7, -10.95);
      lamps.push({ axis: direction.axis, color, material, value });
    }
    root.add(signal);
  }
  return {
    sync(simulation) {
      const alive = new Set();
      for (const lane of simulation.lanes) {
        for (const car of lane.cars) {
          alive.add(car.id);
          if (!meshes.has(car.id)) {
            const model = templates[(car.id - 1) % templates.length].clone(true);
            model.rotation.y = lane.angle;
            meshes.set(car.id, model);
            root.add(model);
          }
          const position = car.previous + (car.position - car.previous) * simulation.alpha;
          const x = ROAD.width / 4;
          meshes.get(car.id).position.set(Math.cos(lane.angle) * x + Math.sin(lane.angle) * position, 0.065, -Math.sin(lane.angle) * x + Math.cos(lane.angle) * position);
        }
      }
      for (const [id, model] of meshes) {
        if (!alive.has(id)) { root.remove(model); meshes.delete(id); }
      }
      for (const lamp of lamps) {
        const active = simulation.signal.color(lamp.axis) === lamp.color;
        lamp.material.color.setHex(active ? lamp.value : 0x263b32);
        lamp.material.emissiveIntensity = active ? 1.6 : 0;
      }
    },
    dispose() {
      // 退出済み車両の共有資源も、最後に一度だけ解放する。
      const geometries = new Set();
      const materials = new Set();
      for (const object of [root, ...templates]) object.traverse((item) => {
        if (item.geometry) geometries.add(item.geometry);
        if (item.material) materials.add(item.material);
      });
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
      meshes.clear();
      scene.remove(root);
    },
  };
}
````

## js/scene.js

````javascript
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRoad } from './road.js';
import { createTrafficView } from './traffic-view.js';

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8eee1);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '十字路。ドラッグで回転、ホイールでズーム、右ドラッグまたは矢印キーで移動。');
  container.appendChild(renderer.domElement);

  // 空と地面からの環境光に、斜め上からの日光を加える。
  scene.add(new THREE.HemisphereLight(0xfffcf0, 0x7c916a, 2.6));
  const sun = new THREE.DirectionalLight(0xfff6df, 2.4);
  sun.position.set(-40, 90, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 200 });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(createRoad());
  const traffic = createTrafficView(scene);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 25;
  controls.maxDistance = 500;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  // キーボード操作は、3Dビューにフォーカスがあるときだけ受け付ける。
  controls.listenToKeyEvents(renderer.domElement);

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  resize();
  // 縦長画面でも交差点が収まるよう、初期のカメラ距離を調整する。
  camera.position.set(94, 110, 126).multiplyScalar(Math.max(1, 1.15 / camera.aspect));
  controls.target.set(0, 0, 0);
  controls.update();
  controls.saveState();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // 視点操作は実時間、車両表示は物理モデルの補間位置で更新する。
  return {
    update(deltaTime, simulation) {
      controls.dampingFactor = 1 - Math.exp(-12 * deltaTime);
      controls.update(deltaTime);
      traffic.sync(simulation);
    },
    render() { renderer.render(scene, camera); },
    resetView() { controls.reset(); },
    dispose() {
      observer.disconnect();
      controls.dispose();
      traffic.dispose();
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
````

## js/ui.js

````javascript
import { FIELDS, DIRECTIONS } from './config.js';

const number = new Intl.NumberFormat('ja-JP', { maximumFractionDigits: 0 });
const decimal = new Intl.NumberFormat('ja-JP', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const colors = { green: '青', yellow: '黄', red: '赤' };

export function createUI(simulation, onAction) {
  const controller = new AbortController();
  const options = { signal: controller.signal };
  const fields = document.querySelector('#parameter-fields');
  // 表示と検証が食い違わないよう、入力範囲は設定定義から作る。
  fields.innerHTML = FIELDS.map((field) => `<label class="field" for="${field.key}"><span>${field.label}</span><span class="input-wrap"><input id="${field.key}" type="number" min="${field.min}" max="${field.max}" step="${field.step}" value="${simulation.settings[field.key]}" inputmode="decimal"><span>${field.unit}</span></span></label>`).join('');
  function notice(text) { document.querySelector('#notice').textContent = text; }
  for (const field of FIELDS) {
    const input = document.getElementById(field.key);
    const apply = (finished) => {
      try {
        if (input.value === '' || !input.validity.valid) {
          // 編集途中の空欄は許容し、入力確定時にだけ元の値へ戻す。
          if (!finished) return;
          throw new Error(`${field.label}は${field.min}〜${field.max}${field.unit}、刻み${field.step}で指定してください。`);
        }
        simulation.setSettings({ [field.key]: Number(input.value) });
        notice('設定を変更しました。信号時間は次に始まる各区間から反映します。');
      } catch (error) {
        input.value = simulation.settings[field.key];
        notice(error.message);
      }
    };
    input.addEventListener('input', () => apply(false), options);
    input.addEventListener('change', () => apply(true), options);
  }
  const actions = { start: 'start', pause: 'pause', resume: 'resume', reset: 'reset', 'reset-view': 'view' };
  for (const [id, action] of Object.entries(actions)) {
    document.getElementById(id).addEventListener('click', () => {
      if (action === 'reset') notice('車両・測定値・信号サイクルをリセットしました。設定値は維持しています。');
      else if (action === 'resume' || action === 'start') notice('交通量は東西・南北それぞれ2方向の合計です。');
      onAction(action);
    }, options);
  }
  function text(id, value) {
    const element = document.getElementById(id);
    if (element.textContent !== value) element.textContent = value;
  }
  function render() {
    const stats = simulation.statistics();
    const signal = simulation.signal;
    const state = { ready: '開始待ち', running: '実行中', paused: '一時停止中' }[simulation.state];
    text('status', state);
    document.querySelector('#status-dot').classList.toggle('running', simulation.state === 'running');
    document.querySelector('#start').disabled = simulation.state !== 'ready';
    document.querySelector('#pause').disabled = simulation.state !== 'running';
    document.querySelector('#resume').disabled = simulation.state !== 'paused';
    document.querySelector('#reset').disabled = false;
    document.querySelector('#reset-view').disabled = false;
    for (const axis of ['EW', 'NS']) {
      const color = signal.color(axis);
      document.getElementById(`signal-${axis}`).dataset.color = color;
      text(`color-${axis}`, colors[color]);
    }
    text('phase-name', signal.holding ? '全赤・交差点内の車両通過待ち' : signal.phase.name);
    text('remaining', signal.holding ? '安全確認中' : `残り ${decimal.format(Math.max(0, signal.remaining))} 秒`);
    document.querySelector('#phase-fill').style.width = `${signal.duration ? Math.max(0, Math.min(100, signal.remaining / signal.duration * 100)) : 0}%`;
    for (const key of ['generated', 'passed', 'active', 'maxQueue', 'pending']) text(key, `${number.format(stats[key])} 台`);
    for (const { id } of DIRECTIONS) text(`queue-${id}`, `${number.format(stats.queues[id])} 台`);
    text('averageWait', `${decimal.format(stats.averageWait)} 秒`);
    text('longestWait', `${decimal.format(stats.longestWait)} 秒`);
    const seconds = Math.floor(stats.time + 1e-8);
    text('elapsed', `${number.format(Math.floor(seconds / 60))} 分 ${String(seconds % 60).padStart(2, '0')} 秒`);
    text('speed-label', `${simulation.settings.speed.toLocaleString('ja-JP')} 倍速`);
  }
  return { render, notice, dispose() { controller.abort(); } };
}
````

## js/main.js

````javascript
async function main() {
  // CDNに到達できない場合も、初期化エラーを日本語で案内する。
  const [{ createScene }, { Simulation }, { createUI }] = await Promise.all([
    import('./scene.js'), import('./simulation.js'), import('./ui.js'),
  ]);
  const simulation = new Simulation();
  const world = createScene(document.querySelector('#scene-container'));
  let previousTime = null;
  let uiElapsed = 0;
  let animationId;
  const ui = createUI(simulation, (action) => {
    if (action === 'view') world.resetView();
    else simulation[action]();
    previousTime = null;
    world.update(0, simulation);
    world.render();
    ui.render();
  });

  function animate(now) {
    // 長時間の非表示や処理落ち後に、突然大量の計算を走らせない。
    const dt = previousTime === null ? 0 : Math.min((now - previousTime) / 1000, 0.1);
    previousTime = now;
    simulation.advance(dt);
    world.update(dt, simulation);
    world.render();
    uiElapsed += dt;
    if (uiElapsed >= 0.1) { ui.render(); uiElapsed = 0; }
    animationId = requestAnimationFrame(animate);
  }
  ui.render();
  world.update(0, simulation);
  world.render();
  animationId = requestAnimationFrame(animate);

  // 非表示中は自動で一時停止。再開ボタンで続きを観察できる。
  const onVisibility = () => {
    previousTime = null;
    if (document.hidden && simulation.state === 'running') {
      simulation.pause();
      ui.notice('タブが非表示になったため一時停止しました。「再開」で続けられます。');
      ui.render();
    }
  };
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', () => {
    cancelAnimationFrame(animationId);
    document.removeEventListener('visibilitychange', onVisibility);
    ui.dispose();
    world.dispose();
  }, { once: true });
  window.addEventListener('pageshow', (event) => {
    if (event.persisted) window.location.reload();
  });
}

main().catch((error) => {
  console.error('初期化に失敗しました。', error);
  document.querySelector('#status').textContent = '読み込みに失敗しました';
  const message = document.querySelector('#error');
  message.textContent = '3Dシーンを表示できませんでした。HTTPサーバー経由で開いているか、インターネット接続とブラウザのWebGL設定を確認してください。';
  message.hidden = false;
});
````

## tests/simulation.test.mjs

````javascript
import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../js/simulation.js';
import { SignalController } from '../js/signals.js';
import { CAR, DEFAULTS, ROAD, STEP, STOP_CENTER } from '../js/config.js';

function make(patch = {}) { return new Simulation({ ...DEFAULTS, ...patch }); }
function run(simulation, seconds, fps = 60) {
  simulation.start();
  for (let frame = 0; frame < Math.round(seconds * fps); frame++) simulation.advance(1 / fps);
  return simulation;
}
function close(actual, expected, tolerance = 1e-6) { assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} ≠ ${expected}`); }

test('青→黄→全赤の順序と設定時間、東西と南北の排他', () => {
  const signal = new SignalController({ ...DEFAULTS });
  const phases = [[0, 20], [1, 3], [2, 2], [3, 20], [4, 3], [5, 2]];
  for (const [index, duration] of phases) {
    assert.equal(signal.index, index);
    close(signal.remaining, duration);
    assert.ok(!(signal.isGreen('EW') && signal.isGreen('NS')));
    signal.update(duration, () => true);
  }
  assert.equal(signal.index, 0);
});

test('信号時間の変更は進行中の区間を飛ばさず、次の区間に反映', () => {
  const ready = make();
  ready.setSettings({ greenEW: 7 });
  assert.equal(ready.signal.remaining, 7);
  const settings = { ...DEFAULTS };
  const signal = new SignalController(settings);
  settings.greenEW = 5;
  settings.yellow = 1;
  close(signal.remaining, 20);
  signal.update(20, () => true);
  assert.equal(signal.index, 1);
  close(signal.remaining, 1);
  signal.update(1 + 2 + 20 + 1 + 2, () => true);
  assert.equal(signal.index, 0);
  close(signal.remaining, 5);
});

test('黄・全赤0秒でも交差点の通過待ちは全赤で保持', () => {
  const simulation = make({ trafficEW: 0, trafficNS: 0, yellow: 0, allRed: 0 });
  const lane = simulation.lanes.find((item) => item.axis === 'EW');
  lane.cars.push({ id: 1, direction: lane.id, position: 0, previous: 0, speed: 0, wait: 0, committed: true });
  simulation.generated = 1;
  simulation.signal.index = 2;
  simulation.signal.remaining = 0;
  simulation.signal.duration = 0;
  simulation.step();
  assert.equal(simulation.signal.holding, true);
  assert.equal(simulation.signal.color('EW'), 'red');
  assert.equal(simulation.signal.color('NS'), 'red');
  for (let i = 0; i < 600; i++) simulation.step();
  assert.equal(simulation.signal.index, 3);
  assert.equal(simulation.signal.holding, false);
});

test('交通量0では発生せず、未開始・一時停止中は時間も測定値も変化しない', () => {
  const simulation = make({ trafficEW: 0, trafficNS: 0 });
  simulation.advance(100);
  assert.equal(simulation.time, 0);
  run(simulation, 60);
  assert.equal(simulation.generated, 0);
  close(simulation.time, 60);
  simulation.pause();
  const snapshot = JSON.stringify(simulation.statistics());
  simulation.advance(100);
  assert.equal(JSON.stringify(simulation.statistics()), snapshot);
  simulation.resume();
  simulation.advance(1);
  close(simulation.time, 61);
});

test('30fps・144fps・速度倍率が同じシミュレーション結果になる', () => {
  const a = run(make(), 120, 30);
  const b = run(make(), 120, 144);
  const c = run(make({ speed: 2 }), 60, 60);
  assert.deepEqual(a.statistics(), b.statistics());
  assert.deepEqual(a.statistics(), c.statistics());
  assert.deepEqual(a.cars, b.cars);
  assert.deepEqual(a.cars, c.cars);
});

test('高交通量・短い信号でも重なり、信号無視、交差衝突、台数の欠落がない', () => {
  const simulation = make({ trafficEW: 120, trafficNS: 120, greenEW: 5, greenNS: 5, yellow: 0, allRed: 0 });
  let maximumWait = 0;
  for (let step = 0; step < 60 * 300; step++) {
    const previous = new Map(simulation.cars.map((car) => [car.id, car.committed]));
    const greenAxis = simulation.signal.phase.color === 'green' ? simulation.signal.phase.axis : null;
    simulation.step();
    for (const lane of simulation.lanes) {
      for (const [index, car] of lane.cars.entries()) {
        assert.ok(Number.isFinite(car.position) && car.speed >= 0 && car.speed <= CAR.speed + 1e-8);
        if (index) assert.ok(lane.cars[index - 1].position - car.position >= CAR.length + CAR.gap - 1e-7);
        if (!car.committed) assert.ok(car.position <= STOP_CENTER + 1e-7);
        if (car.committed && previous.get(car.id) === false) assert.equal(lane.axis, greenAxis);
        maximumWait = Math.max(maximumWait, car.wait);
      }
    }
    // 交差し得る各方向の車両を、上面の長方形で判定する。
    const boxes = simulation.lanes.flatMap((lane) => lane.cars.filter((car) => car.committed && car.position < ROAD.width).map((car) => {
      const s = Math.sin(lane.angle), c = Math.cos(lane.angle), x = ROAD.width / 4;
      return { axis: lane.axis, x: c * x + s * car.position, z: -s * x + c * car.position, width: lane.axis === 'EW' ? CAR.length : CAR.width, depth: lane.axis === 'EW' ? CAR.width : CAR.length };
    }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.axis !== b.axis) assert.ok(Math.abs(a.x - b.x) >= (a.width + b.width) / 2 || Math.abs(a.z - b.z) >= (a.depth + b.depth) / 2, '交差する車両の重なり');
    }
    const stats = simulation.statistics();
    assert.equal(stats.generated, stats.passed + stats.active);
    assert.equal(stats.active, simulation.cars.length);
    assert.equal(simulation.requested, stats.generated + stats.pending);
    assert.ok(stats.maxQueue >= Math.max(...Object.values(stats.queues)));
    assert.ok(stats.averageWait >= 0 && stats.longestWait >= stats.averageWait - 1e-8);
  }
  const stats = simulation.statistics();
  assert.ok(stats.pending > 0 && stats.passed > 0 && stats.maxQueue > 1);
  assert.ok(simulation.requested > 950 && simulation.requested < 1450);
  close(stats.longestWait, maximumWait);
  close(stats.averageWait, simulation.totalWait / simulation.generated);
});

test('交通量を止めると既存の車列と場外待ちがすべて退出する', () => {
  const simulation = run(make({ trafficEW: 120, trafficNS: 120 }), 60);
  simulation.setSettings({ trafficEW: 0, trafficNS: 0 });
  run(simulation, 600);
  assert.equal(simulation.statistics().pending, 0);
  assert.equal(simulation.cars.length, 0);
  assert.equal(simulation.generated, simulation.passed);
});

test('交通量の増加で渋滞と待ち時間が増える', () => {
  const low = run(make({ trafficEW: 8, trafficNS: 8 }), 300).statistics();
  const high = run(make({ trafficEW: 100, trafficNS: 100 }), 300).statistics();
  assert.ok(high.maxQueue > low.maxQueue);
  assert.ok(high.averageWait > low.averageWait);
  assert.ok(high.pending > low.pending);
});

test('リセットは設定を維持し、車両・信号・測定値・到着列を初期化', () => {
  const simulation = run(make({ greenEW: 12, speed: 5 }), 30);
  const before = simulation.statistics();
  simulation.reset();
  assert.equal(simulation.state, 'ready');
  assert.equal(simulation.settings.greenEW, 12);
  assert.equal(simulation.settings.speed, 5);
  assert.equal(simulation.signal.remaining, 12);
  assert.equal(simulation.statistics().generated, 0);
  assert.equal(simulation.statistics().longestWait, 0);
  assert.deepEqual(run(simulation, 30).statistics(), before);
});

test('範囲外や非数の設定を拒否し、既存設定を維持', () => {
  const simulation = make();
  assert.throws(() => simulation.setSettings({ greenEW: 0 }), RangeError);
  assert.throws(() => simulation.setSettings({ trafficEW: NaN }), RangeError);
  assert.throws(() => simulation.setSettings({ speed: 100 }), RangeError);
  assert.equal(simulation.settings.greenEW, DEFAULTS.greenEW);
  assert.equal(simulation.settings.trafficEW, DEFAULTS.trafficEW);
  assert.equal(STEP, 1 / 60);
});
````

## README.md

````markdown
# 十字路の交通信号シミュレーション：完成版

HTML・CSS・JavaScript ES Modules・Three.jsだけで動作する、ステップ1〜6を統合したシミュレーションです。
React、Vue、TypeScript、ビルドツール、外部3Dモデルは使用していません。
Three.jsとOrbitControlsは、同じCDNのバージョン0.180.0に固定しています。

## 起動

Python 3がある環境で、プロジェクトのフォルダから実行します。

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

ブラウザで http://127.0.0.1:8000/ を開き、「開始」を押してください。
終了はターミナルでCtrl+Cです。既存のHTTPサーバーから配信しても動きます。
HTMLのダブルクリックではなく、HTTPサーバー経由で開いてください。
CDNの読み込みにはインターネット接続、描画にはWebGL対応ブラウザが必要です。
アプリの起動にNode.jsやnpm installは不要です。

## ファイル構成

```text
3DSimulatorLearn/
├── index.html                 # 日本語UIとCDNのimport map
├── style.css                  # レイアウトとレスポンシブ表示
├── js/
│   ├── config.js              # 寸法・物理定数・設定と入力範囲
│   ├── main.js                # 起動・delta time・実行操作の接続
│   ├── road.js                # ステップ1の地面・道路・標示・方角
│   ├── scene.js               # カメラ・照明・OrbitControls・描画
│   ├── signals.js             # 信号サイクルと全赤の安全延長
│   ├── simulation.js          # 到着・停止・追従・退出・測定
│   ├── traffic-view.js        # 基本図形による車両と信号機の表示
│   └── ui.js                  # 入力検証と日本語表示
├── tests/
│   └── simulation.test.mjs    # Node.js標準機能による自動テスト
├── README.md
└── SOURCE_CODE.md             # 上記全ファイルの内容を省略せず掲載
```

## 実装機能

- ステップ1：十字路、車線、停止線、地面、斜め上からのカメラ、OrbitControls。
- ステップ2：東西青→東西黄→全赤→南北青→南北黄→全赤。状態・残り時間の表示。
- ステップ3：東西南北からランダムに車両が到着し、直進。赤・黄では停止線前で停止、青で再発進。退出した車両の表示とデータを削除。
- ステップ4：加速・減速と前車追従、最低2mの車間、停止車列、重なり防止。
- ステップ5：東西・南北交通量、各青時間、黄時間、全赤時間、速度、開始・一時停止・再開・リセット。
- ステップ6：発生・通過・現在台数、方向別待機台数、最大待ち行列、平均・最長待ち時間、経過時間。
- 補助表示：場外の進入待ち、全赤の安全確認状態、設定の反映案内。

## 設定と操作

| 設定 | 初期値 | 入力範囲 |
| --- | --- | --- |
| 東西方向の交通量 | 24台/分 | 0〜120台/分 |
| 南北方向の交通量 | 24台/分 | 0〜120台/分 |
| 東西方向の青時間 | 20秒 | 5〜120秒 |
| 南北方向の青時間 | 20秒 | 5〜120秒 |
| 黄時間 | 3秒 | 0〜10秒 |
| 全赤時間 | 2秒 | 0〜10秒 |
| シミュレーション速度 | 1倍 | 0.25〜10倍、0.25刻み |

交通量は各軸の2方向を合計した到着率です。各方向に半分の率でランダムに到着するため、短い時間の実台数が設定値に一致するとは限りません。
例えば東西24台/分なら、東と西にそれぞれ平均12台/分が到着します。

交通量と速度は即時反映。実行中・一時停止中に変更した信号時間は、次に始まる各区間から反映します。
開始前の設定は最初の青時間から反映します。
リセットは車両・測定値・信号サイクル・乱数を初期化し、設定とカメラは維持します。
一時停止中も視点を動かせます。タブを非表示にすると自動で一時停止し、「再開」で続行できます。
処理落ち時は1フレーム分の実時間を最大0.1秒として計算するため、重い環境では指定倍率より遅く進むことがあります。

- 左ドラッグ：回転
- ホイール：ズーム
- 右ドラッグ：視点移動
- 3Dビューにフォーカスして矢印キー：視点移動
- 1本指：回転、2本指：ズーム・視点移動
- 「初期の視点に戻す」：カメラ位置と注視点を復元

## 車両と信号の連携

1単位は1m。東が+x、上が+y、南が+zです。地面は120m四方、道路幅は12m、片側1車線の左側通行です。
車両は全長4.2m、最高速度10m/s。前車の速度と空き距離を使って減速し、最低2mの車間を維持します。
停止線の中心は交差点中心から12m。車両の前端が停止線へかからない位置で停止します。
赤・黄になる前に停止線へ進入済みの車両は、交差点内で停止せず退出します。
全赤が終了しても進入済み車両の後端が交差領域を抜けていない場合は、抜けるまで全赤を延長します。全赤・黄を0秒に設定した場合もこの確認を行います。

進入口が車列で埋まった場合、到着要求を消さず場外の進入待ちとして保持します。
進入口に安全な空きができると、道路上へ発生させます。
表示範囲の都合で車両を重ねて追加したり、到着を黙って破棄したりしません。

物理計算はdelta timeを積算して1/60秒の固定刻みで行い、表示位置を補間します。
同じ条件でリセットすれば、同じ擬似乱数の到着列で比較できます。
これは直進車両による教育・観察用の単純化モデルです。

## 測定の定義

| 項目 | 定義 |
| --- | --- |
| 発生車両数 | 道路上へ実際に追加した車両の累計 |
| 通過車両数 | 車両の後端が道路端を越えて退出した累計 |
| 現在の車両数 | 発生数−通過数。走行・待機中の全車両 |
| 方向別の待機 | 停止線へ未進入かつ速度0.3m/s未満の車両数 |
| 最大待ち行列 | 1方向あたりの待機台数の過去最大 |
| 平均待ち時間 | 全発生車両の累積停止待ち時間の合計÷発生車両数。現在の車両と待ち時間0秒の車両も含む |
| 最長待ち時間 | 1台の累積停止待ち時間の過去最大 |
| 経過時間 | 速度倍率を反映したシミュレーション時間 |
| 場外の進入待ち | 到着済みだが入口の空きを待っている台数。発生台数・待ち時間の集計からは除外 |

一時停止中は信号・車両・測定時間がすべて停止します。
待ち時間は停止時間の累計であり、走行時間や場外の待ち時間は含めません。

## 動作確認

テストにはNode.jsが必要です（検証環境：26.7.0）。依存パッケージなしで以下を実行できます。

```sh
node --test tests/simulation.test.mjs
```

10件のテストで、信号順序、時間変更、全赤保持、停止・再開、フレームレートと倍率の整合、過負荷での衝突・信号無視・台数欠落防止、車列の解消、交通量による渋滞の変化、リセット、入力範囲を確認します。
````

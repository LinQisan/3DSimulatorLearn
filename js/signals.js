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

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

import { CAR, CLEAR_DISTANCE, DEFAULTS, DIRECTIONS, ENTRY, STEP, STOP_CENTER, validateSettings } from './config.js';
import { overlaps, routeFor, routesConflict } from './routes.js';
import { SignalController } from './signals.js';

export class Simulation {
  constructor(settings = DEFAULTS) {
    this.settings = validateSettings({ ...DEFAULTS, ...settings });
    this.reset();
  }
  reset() {
    this.state = 'ready';
    this.time = 0;
    this.accumulator = 0;
    this.generated = this.passed = this.requested = 0;
    this.totalWait = this.longestWait = this.maxQueue = 0;
    this.admittedPendingWait = this.longestSystemWait = this.maxSystemQueue = 0;
    this.passedMovements = { straight: 0, left: 0, right: 0 };
    this.seed = 20261027;
    this.signal = new SignalController(this.settings);
    this.lanes = DIRECTIONS.map((direction) => ({
      ...direction, cars: [], pendingQueue: [], pendingHead: 0, pendingArrivalSum: 0,
      hazard: 0, threshold: this.exponential(),
      get pending() { return this.pendingQueue.length - this.pendingHead; },
    }));
  }
  // 到着ごとに必ず同数の乱数を使い、旋回率だけを変えた比較も再現可能にする。
  random() {
    this.seed = (Math.imul(1664525, this.seed) + 1013904223) >>> 0;
    return (this.seed + 0.5) / 4294967296;
  }
  exponential() { return -Math.log(1 - this.random()); }
  chooseMovement() {
    const value = this.random() * 100;
    return value < this.settings.leftPercent ? 'left' : value < this.settings.leftPercent + this.settings.rightPercent ? 'right' : 'straight';
  }
  setSettings(patch) {
    Object.assign(this.settings, validateSettings({ ...this.settings, ...patch }));
    if (this.state === 'ready') this.signal = new SignalController(this.settings);
  }
  start() { if (this.state === 'ready') this.state = 'running'; }
  pause() { if (this.state === 'running') this.state = 'paused'; }
  resume() { if (this.state === 'paused') this.state = 'running'; }
  get cars() { return this.lanes.flatMap((lane) => lane.cars); }
  get alpha() { return this.state === 'running' ? this.accumulator / STEP : 1; }
  advance(realDelta) {
    if (this.state !== 'running' || !Number.isFinite(realDelta) || realDelta <= 0) return;
    this.accumulator += realDelta * this.settings.speed;
    while (this.accumulator + 1e-10 >= STEP) {
      this.step();
      this.accumulator = Math.max(0, this.accumulator - STEP);
    }
  }
  isIntersectionClear() {
    return this.cars.every((car) => !car.committed || car.position > routeFor(car).clearAt);
  }
  canEnter(car, route, reservations, snapshots, heads) {
    const lane = this.lanes.find((item) => item.id === car.direction);
    if (!this.signal.isGreen(lane.axis)) return false;
    if (reservations.some((other) => other.id !== car.id && routesConflict(route, routeFor(other)))) return false;
    // 片側1車線なので追い越さない。右折は対向の先頭の直進・左折に譲る。
    if (car.movement === 'right') {
      const opposite = this.lanes[(this.lanes.indexOf(lane) + 2) % 4];
      const head = heads.get(opposite.id);
      if (head && head.movement !== 'right' && head.position >= STOP_CENTER - CAR.speed * 3) return false;
    }
    // 別経路から同じ出口へ合流する場合、出口に車体と車間の空きが必要。
    return !snapshots.some((other) => other.id !== car.id && other.route.key !== route.key && other.route.exit === route.exit && other.position >= other.route.curveEnd && other.route.outPosition(other.position) < CLEAR_DISTANCE + CAR.length + CAR.gap);
  }
  leaderLimit(car, route, snapshots) {
    let limit = Infinity;
    let leaderSpeed = CAR.speed;
    for (const other of snapshots) {
      if (other.id === car.id) continue;
      let candidate = Infinity;
      if (other.direction === car.direction && other.position > car.position && (other.route.key === route.key || (car.position <= -9 && other.position < -9 + CAR.length + CAR.gap))) {
        candidate = other.position - CAR.length - CAR.gap;
      }
      if (other.route.exit === route.exit && other.position >= other.route.curveEnd && other.route.outPosition(other.position) > route.outPosition(car.position)) {
        candidate = Math.min(candidate, route.curveEnd + other.route.outPosition(other.position) - 9 - CAR.length - CAR.gap);
      }
      if (candidate < limit) { limit = candidate; leaderSpeed = other.speed; }
    }
    return { limit, leaderSpeed };
  }
  step() {
    this.time += STEP;
    for (const lane of this.lanes) {
      lane.hazard += this.settings[`traffic${lane.axis}`] / 120 * STEP;
      while (lane.hazard >= lane.threshold) {
        lane.hazard -= lane.threshold;
        lane.threshold = this.exponential();
        // pendingも進路と到着時刻を持つ本物の到着要求。入口が空くまでFIFOで保持。
        lane.pendingQueue.push({ requestId: ++this.requested, movement: this.chooseMovement(), arrivalTime: this.time });
        lane.pendingArrivalSum += this.time;
      }
    }
    const cars = this.cars;
    const snapshots = cars.map((car) => ({ ...car, route: routeFor(car) }));
    const reservations = cars.filter((car) => car.committed && car.position <= routeFor(car).clearAt);
    const heads = new Map(this.lanes.map((lane) => [lane.id, lane.cars.filter((car) => !car.committed).sort((a, b) => b.position - a.position)[0]]));
    const poses = new Map(cars.map((car) => [car.id, routeFor(car).pose(car.position)]));
    // 先に進入済みの車両、次に直進・左折、最後に右折。同じ優先度では到着順。
    const priority = (car) => car.committed ? 0 : car.movement === 'right' ? 2 : 1;
    cars.sort((a, b) => priority(a) - priority(b) || a.requestId - b.requestId || a.id - b.id);
    for (const car of cars) {
      const route = routeFor(car);
      car.previous = car.position;
      const { limit: leaderLimit, leaderSpeed } = this.leaderLimit(car, route, snapshots);
      let limit = Math.max(car.position, leaderLimit);
      let target = CAR.speed;
      if (Number.isFinite(limit)) {
        const room = Math.max(0, limit - car.position - CAR.headway * car.speed);
        target = Math.min(target, Math.sqrt(leaderSpeed ** 2 + 2 * CAR.brake * room));
      }
      // 曲線に入る前に減速し、曲線の途中で突然速度を変えない。
      if (car.position <= route.curveEnd) {
        target = Math.min(target, Math.sqrt(route.speed ** 2 + 2 * CAR.brake * Math.max(0, -9 - car.position)));
      }
      if (!car.committed && !this.canEnter(car, route, reservations, snapshots, heads)) {
        limit = Math.min(limit, STOP_CENTER);
        target = Math.min(target, Math.sqrt(2 * CAR.brake * Math.max(0, limit - car.position)));
      }
      const oldSpeed = car.speed;
      car.speed += Math.max(-CAR.brake * STEP, Math.min(CAR.acceleration * STEP, target - car.speed));
      let next = Math.min(limit, car.position + (oldSpeed + car.speed) / 2 * STEP);
      if (Number.isFinite(limit) && limit - next < 0.02 && car.speed < 0.3) next = limit;
      // 経路距離の制約に加え、曲線・合流での実車体の重なりも防ぐ。
      const blocked = (position) => {
        const pose = route.pose(position);
        for (const [id, other] of poses) {
          if (id !== car.id && (pose.x - other.x) ** 2 + (pose.z - other.z) ** 2 < 25 && overlaps(pose, other, 0.15)) return true;
        }
        return false;
      };
      if (blocked(next)) {
        let low = car.position, high = next;
        for (let i = 0; i < 8; i++) {
          const middle = (low + high) / 2;
          if (blocked(middle)) high = middle; else low = middle;
        }
        next = low;
      }
      car.position = Math.max(car.previous, next);
      car.speed = Math.max(0, Math.min(car.speed, (car.position - car.previous) / STEP));
      poses.set(car.id, route.pose(car.position));
      if (!car.committed && car.position > STOP_CENTER + 1e-7) {
        car.committed = true;
        reservations.push(car);
      }
      if (!car.committed && car.speed < 0.3) {
        car.wait += STEP;
        this.totalWait += STEP;
        this.longestWait = Math.max(this.longestWait, car.wait);
      }
      this.longestSystemWait = Math.max(this.longestSystemWait, car.wait + car.pendingWait);
    }
    for (const lane of this.lanes) {
      lane.cars = lane.cars.filter((car) => {
        if (car.position <= routeFor(car).end) return true;
        this.passed += 1;
        this.passedMovements[car.movement] += 1;
        return false;
      });
      const tail = lane.cars.filter((car) => car.position < -9).sort((a, b) => a.position - b.position)[0];
      if (lane.pending > 0 && (!tail || tail.position - ENTRY >= CAR.length + CAR.gap)) {
        const request = lane.pendingQueue[lane.pendingHead++];
        lane.pendingArrivalSum -= request.arrivalTime;
        const pendingWait = Math.max(0, this.time - request.arrivalTime);
        this.admittedPendingWait += pendingWait;
        this.longestSystemWait = Math.max(this.longestSystemWait, pendingWait);
        lane.cars.push({ id: ++this.generated, ...request, direction: lane.id, position: ENTRY, previous: ENTRY, speed: tail ? Math.min(CAR.speed, tail.speed) : CAR.speed, wait: 0, pendingWait, committed: false });
        if (lane.pendingHead > 128 && lane.pendingHead * 2 > lane.pendingQueue.length) {
          lane.pendingQueue = lane.pendingQueue.slice(lane.pendingHead);
          lane.pendingHead = 0;
        }
        if (lane.pending === 0) {
          lane.pendingQueue = [];
          lane.pendingHead = 0;
          lane.pendingArrivalSum = 0;
        }
      }
      const queued = lane.cars.filter((car) => !car.committed && car.speed < 0.3).length;
      this.maxQueue = Math.max(this.maxQueue, queued);
      this.maxSystemQueue = Math.max(this.maxSystemQueue, queued + lane.pending);
    }
    this.signal.update(STEP, () => this.isIntersectionClear());
  }
  statistics() {
    const queues = {}, pendingByDirection = {};
    let pending = 0, pendingWait = 0, oldestWait = 0;
    for (const lane of this.lanes) {
      queues[lane.id] = lane.cars.filter((car) => !car.committed && car.speed < 0.3).length;
      pendingByDirection[lane.id] = lane.pending;
      pending += lane.pending;
      pendingWait += Math.max(0, lane.pending * this.time - lane.pendingArrivalSum);
      if (lane.pending) oldestWait = Math.max(oldestWait, this.time - lane.pendingQueue[lane.pendingHead].arrivalTime);
    }
    return {
      generated: this.generated, passed: this.passed, requested: this.requested, active: this.generated - this.passed,
      queues, pending, pendingByDirection, maxQueue: this.maxQueue, maxSystemQueue: this.maxSystemQueue,
      averageWait: this.generated ? this.totalWait / this.generated : 0, longestWait: this.longestWait,
      systemAverageWait: this.requested ? (this.totalWait + this.admittedPendingWait + pendingWait) / this.requested : 0,
      systemLongestWait: Math.max(this.longestSystemWait, oldestWait), passedMovements: { ...this.passedMovements }, time: this.time,
    };
  }
}

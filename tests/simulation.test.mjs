import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../js/simulation.js';
import { SignalController } from '../js/signals.js';
import { CAR, DEFAULTS, ROAD, STEP, STOP_CENTER } from '../js/config.js';

// 従来の直進ケースを回帰テストとして残す。
function make(patch = {}) { return new Simulation({ ...DEFAULTS, leftPercent: 0, rightPercent: 0, ...patch }); }
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
  lane.cars.push({ id: 1, requestId: 1, direction: lane.id, movement: 'straight', position: 0, previous: 0, speed: 0, wait: 0, pendingWait: 0, committed: true });
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

import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../js/simulation.js';
import { CAR, CLEAR_DISTANCE, DEFAULTS, DIRECTIONS, EXIT, STEP, STOP_CENTER } from '../js/config.js';
import { MOVEMENTS, ROUTES, routeFor, routesConflict } from '../js/routes.js';

function make(settings = {}) { return new Simulation({ ...DEFAULTS, ...settings }); }
function advance(simulation, seconds) { for (let i = 0; i < seconds * 60; i++) simulation.step(); }
function close(a, b) { assert.ok(Math.abs(a - b) < 1e-6, `${a} ≠ ${b}`); }
function addCar(simulation, direction, movement, position = STOP_CENTER, speed = 0, committed = false) {
  const id = ++simulation.generated;
  simulation.requested += 1;
  const car = { id, requestId: id, direction, movement, position, previous: position, speed, committed, arrivalTime: 0, wait: 0, pendingWait: 0 };
  simulation.lanes.find((lane) => lane.id === direction).cars.push(car);
  return car;
}
function nsGreen(simulation) { simulation.signal.index = 3; simulation.signal.remaining = simulation.signal.duration = 20; }

// 物理実装のoverlapsを使わず、車体四隅の多角形で独立に衝突を検査する。
function corners(pose) {
  return [[-1, -1], [-1, 1], [1, 1], [1, -1]].map(([side, front]) => ({
    x: pose.x + side * CAR.width / 2 * Math.cos(pose.yaw) + front * CAR.length / 2 * Math.sin(pose.yaw),
    z: pose.z - side * CAR.width / 2 * Math.sin(pose.yaw) + front * CAR.length / 2 * Math.cos(pose.yaw),
  }));
}
function intersect(a, b) {
  for (const polygon of [a, b]) for (let i = 0; i < 4; i++) {
    const p = polygon[i], q = polygon[(i + 1) % 4];
    const axis = { x: -(q.z - p.z), z: q.x - p.x };
    const projections = [a, b].map((shape) => shape.map((point) => point.x * axis.x + point.z * axis.z));
    if (Math.max(...projections[0]) <= Math.min(...projections[1]) + 1e-7 || Math.max(...projections[1]) <= Math.min(...projections[0]) + 1e-7) return false;
  }
  return true;
}

test('全12経路が連続し、左右の正しい出口・左側通行の車線へ接続', () => {
  assert.equal(ROUTES.size, 12);
  for (const route of ROUTES.values()) {
    for (const boundary of [-9, route.curveEnd]) {
      const a = route.pose(boundary - 1e-8), b = route.pose(boundary + 1e-8);
      assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 1e-6);
      assert.ok(Math.abs(a.yaw - b.yaw) < 1e-6);
    }
    const output = DIRECTIONS.find((direction) => direction.id === route.exit);
    const pose = route.pose(route.end);
    close(pose.x, Math.cos(output.angle) * -3 + Math.sin(output.angle) * -EXIT);
    close(pose.z, -Math.sin(output.angle) * -3 + Math.cos(output.angle) * -EXIT);
  }
  assert.equal(ROUTES.get('north:left').exit, 'east');
  assert.equal(ROUTES.get('north:right').exit, 'west');
});

test('交錯表は対称で、対向直進は同時通行、右折の交錯・出口合流は排他', () => {
  const get = (key) => ROUTES.get(key);
  assert.equal(routesConflict(get('north:straight'), get('south:straight')), false);
  assert.equal(routesConflict(get('north:left'), get('south:left')), false);
  assert.equal(routesConflict(get('north:right'), get('south:straight')), true);
  assert.equal(routesConflict(get('north:left'), get('west:straight')), true);
  for (const a of ROUTES.values()) for (const b of ROUTES.values()) assert.equal(routesConflict(a, b), routesConflict(b, a));
});

test('右折は対向直進に譲り、進入済み車両が抜けるまで待つ', () => {
  const simulation = make({ trafficEW: 0, trafficNS: 0 });
  nsGreen(simulation);
  const right = addCar(simulation, 'north', 'right');
  const straight = addCar(simulation, 'south', 'straight');
  simulation.step();
  assert.equal(right.committed, false);
  assert.equal(straight.committed, true);
  assert.ok(right.position <= STOP_CENTER);
  advance(simulation, 12);
  assert.equal(right.committed, true);
  assert.ok(right.wait > 0);
});

test('交錯しない対向の左折は同時に進入できる', () => {
  const simulation = make({ trafficEW: 0, trafficNS: 0 });
  nsGreen(simulation);
  const a = addCar(simulation, 'north', 'left');
  const b = addCar(simulation, 'south', 'left');
  simulation.step();
  assert.ok(a.committed && b.committed);
});

test('異なる出発方向から同じ出口へ入った車両も車間を保って追従', () => {
  const simulation = make({ trafficEW: 0, trafficNS: 0 });
  const aRoute = ROUTES.get('north:left');
  const a = addCar(simulation, 'north', 'left', aRoute.curveEnd + 35 - 9, 4, true);
  const b = addCar(simulation, 'west', 'straight', 25, 10, true);
  for (let i = 0; i < 120; i++) {
    simulation.step();
    const gap = routeFor(a).outPosition(a.position) - routeFor(b).outPosition(b.position);
    assert.ok(gap >= CAR.length + CAR.gap - 1e-7);
    assert.equal(intersect(corners(routeFor(a).pose(a.position)), corners(routeFor(b).pose(b.position))), false);
  }
});

test('曲線を抜けるまで全赤を保持し、旋回済みの出口車両は延長の対象から外す', () => {
  const simulation = make({ trafficEW: 0, trafficNS: 0, yellow: 0, allRed: 0 });
  const route = ROUTES.get('north:right');
  const car = addCar(simulation, 'north', 'right', route.curveEnd - 0.1, 5, true);
  simulation.signal.index = 2;
  simulation.signal.remaining = 0;
  simulation.step();
  assert.equal(simulation.signal.holding, true);
  car.position = route.clearAt + 0.01;
  assert.equal(simulation.isIntersectionClear(), true);
  assert.ok(route.outPosition(car.position) > CLEAR_DISTANCE);
});

for (const ratios of [{ leftPercent: 20, rightPercent: 20 }, { leftPercent: 0, rightPercent: 100 }, { leftPercent: 100, rightPercent: 0 }]) {
  test(`最大交通量・ゼロ全赤・旋回率${JSON.stringify(ratios)}で衝突、信号無視、台数欠落なし`, () => {
    const simulation = make({ trafficEW: 120, trafficNS: 120, greenEW: 5, greenNS: 5, yellow: 0, allRed: 0, ...ratios });
    const moved = new Set();
    for (let step = 0; step < 60 * 180; step++) {
      const before = new Map(simulation.cars.map((car) => [car.id, { committed: car.committed, position: car.position }]));
      const green = simulation.signal.phase.color === 'green' ? simulation.signal.phase.axis : null;
      simulation.step();
      const cars = simulation.cars;
      const poses = cars.map((car) => routeFor(car).pose(car.position));
      for (const [i, car] of cars.entries()) {
        const old = before.get(car.id);
        assert.ok(Number.isFinite(car.position) && car.speed >= 0);
        if (old) assert.ok(car.position >= old.position);
        if (!car.committed) assert.ok(car.position <= STOP_CENTER + 1e-7);
        if (car.committed && old?.committed === false) assert.equal(DIRECTIONS.find((lane) => lane.id === car.direction).axis, green);
        if (car.committed) moved.add(car.direction);
        for (let j = i + 1; j < cars.length; j++) if (Math.hypot(poses[i].x - poses[j].x, poses[i].z - poses[j].z) < 5) assert.equal(intersect(corners(poses[i]), corners(poses[j])), false, `車両${car.id}と${cars[j].id}が衝突`);
      }
      const stats = simulation.statistics();
      assert.equal(stats.generated, stats.passed + cars.length);
      assert.equal(stats.requested, stats.generated + stats.pending);
      assert.equal(stats.pending, Object.values(stats.pendingByDirection).reduce((a, b) => a + b, 0));
      assert.equal(stats.passed, Object.values(stats.passedMovements).reduce((a, b) => a + b, 0));
      assert.ok(stats.maxSystemQueue >= Math.max(...simulation.lanes.map((lane) => stats.queues[lane.id] + lane.pending)));
      assert.ok(stats.systemAverageWait <= stats.systemLongestWait + 1e-6);
    }
    assert.equal(moved.size, 4);
    assert.ok(simulation.passed > 10 && simulation.statistics().pending > 0);
    assert.ok(simulation.maxSystemQueue > simulation.maxQueue);
  });
}

test('pendingの進路・到着時刻を保持し、FIFOで入場、交通停止後に全需要が退出', () => {
  const simulation = make({ trafficEW: 120, trafficNS: 120 });
  advance(simulation, 30);
  assert.ok(simulation.statistics().pending > 0);
  simulation.setSettings({ trafficEW: 0, trafficNS: 0, leftPercent: 0, rightPercent: 100 });
  const expected = new Map(simulation.lanes.map((lane) => [lane.id, lane.pendingQueue.slice(lane.pendingHead).map((request) => ({ ...request }))]));
  const seen = new Set(simulation.cars.map((car) => car.id));
  for (let i = 0; i < 60 * 1200 && simulation.passed < simulation.requested; i++) {
    simulation.step();
    for (const car of simulation.cars) if (!seen.has(car.id)) {
      seen.add(car.id);
      const request = expected.get(car.direction).shift();
      assert.equal(car.requestId, request.requestId);
      assert.equal(car.movement, request.movement);
      close(car.pendingWait, simulation.time - request.arrivalTime);
    }
  }
  assert.equal(simulation.statistics().pending, 0);
  assert.equal(simulation.cars.length, 0);
  assert.equal(simulation.passed, simulation.requested);
  assert.ok([...expected.values()].every((items) => !items.length));
});

test('場外の待ち時間は入場前から増加し、入場後に二重計上されない', () => {
  const simulation = make({ trafficEW: 0, trafficNS: 0 });
  const lane = simulation.lanes[0];
  simulation.time = 10;
  simulation.requested = 1;
  lane.pendingQueue.push({ requestId: 1, movement: 'left', arrivalTime: 0 });
  close(simulation.statistics().systemAverageWait, 10);
  assert.equal(simulation.statistics().averageWait, 0);
  simulation.step();
  close(simulation.statistics().systemAverageWait, 10 + STEP);
  close(lane.cars[0].pendingWait, 10 + STEP);
  assert.equal(lane.pending, 0);
  simulation.step();
  close(simulation.statistics().systemAverageWait, 10 + STEP);
});

test('旋回率の合計を検証し、直進0〜100％・再現性・フレーム独立性を維持', () => {
  const simulation = make();
  assert.throws(() => simulation.setSettings({ leftPercent: 81 }), RangeError);
  const a = make({ speed: 2 }), b = make({ speed: 1 });
  a.start(); b.start();
  for (let i = 0; i < 30 * 30; i++) a.advance(1 / 30);
  for (let i = 0; i < 60 * 144; i++) b.advance(1 / 144);
  assert.deepEqual(a.statistics(), b.statistics());
  assert.deepEqual(a.cars, b.cars);
  assert.deepEqual(a.lanes.map((lane) => lane.pendingQueue), b.lanes.map((lane) => lane.pendingQueue));
  assert.equal(Object.keys(MOVEMENTS).length, 3);
});

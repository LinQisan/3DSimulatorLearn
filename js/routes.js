import { CAR, CLEAR_DISTANCE, DIRECTIONS, EXIT, ROAD, STOP_CENTER } from './config.js';

export const MOVEMENTS = Object.freeze({ straight: '直進', left: '左折', right: '右折' });
const START = -9;
const END = 9;

// 表示と物理計算で同じ経路を使う。positionは経路に沿った距離。
function createRoute(direction, movement) {
  const origin = DIRECTIONS.indexOf(direction);
  const exitIndex = (origin + { straight: 2, left: 1, right: 3 }[movement]) % 4;
  const radius = movement === 'left' ? 6 : 12;
  const curveEnd = movement === 'straight' ? END : START + radius * Math.PI / 2;
  const c = Math.cos(direction.angle), s = Math.sin(direction.angle);
  return {
    key: `${direction.id}:${movement}`, origin: direction.id, movement,
    exit: DIRECTIONS[exitIndex].id, curveEnd,
    clearAt: curveEnd + CLEAR_DISTANCE - END,
    end: curveEnd + EXIT - END,
    speed: movement === 'straight' ? CAR.speed : movement === 'left' ? 5 : 5.5,
    outPosition(position) { return END + position - curveEnd; },
    pose(position) {
      let x = ROAD.width / 4, z = position, yaw = 0;
      if (movement !== 'straight' && position > START) {
        const theta = Math.min(Math.PI / 2, (position - START) / radius);
        const extra = Math.max(0, position - curveEnd);
        if (movement === 'left') {
          x = END - radius * Math.cos(theta) + extra;
          z = START + radius * Math.sin(theta);
          yaw = theta;
        } else {
          x = -END + radius * Math.cos(theta) - extra;
          z = START + radius * Math.sin(theta);
          yaw = -theta;
        }
      }
      return { x: c * x + s * z, z: -s * x + c * z, yaw: direction.angle + yaw };
    },
  };
}

export const ROUTES = new Map(DIRECTIONS.flatMap((direction) => Object.keys(MOVEMENTS).map((movement) => {
  const route = createRoute(direction, movement);
  return [route.key, route];
})));
export function routeFor(car) { return ROUTES.get(`${car.direction}:${car.movement}`); }

// 車体の向きまで含めた長方形の重なり判定（分離軸法）。
export function overlaps(a, b, margin = 0) {
  const axes = [
    [Math.sin(a.yaw), Math.cos(a.yaw)], [Math.cos(a.yaw), -Math.sin(a.yaw)],
    [Math.sin(b.yaw), Math.cos(b.yaw)], [Math.cos(b.yaw), -Math.sin(b.yaw)],
  ];
  const radius = (pose, x, z) => (CAR.length + margin) / 2 * Math.abs(x * Math.sin(pose.yaw) + z * Math.cos(pose.yaw)) + (CAR.width + margin) / 2 * Math.abs(x * Math.cos(pose.yaw) - z * Math.sin(pose.yaw));
  return axes.every(([x, z]) => Math.abs((a.x - b.x) * x + (a.z - b.z) * z) < radius(a, x, z) + radius(b, x, z) - 1e-9);
}

// 全経路の掃引領域から交錯表を一度だけ作る。サンプル間隔分の余裕を加える。
const samples = new Map([...ROUTES].map(([key, route]) => {
  const points = [];
  for (let position = STOP_CENTER; position <= route.clearAt + 0.6; position += 0.6) points.push(route.pose(position));
  return [key, points];
}));
const conflicts = new Map();
for (const [key, a] of ROUTES) {
  conflicts.set(key, new Set());
  for (const [other, b] of ROUTES) {
    if (key === other) continue; // 同一経路は車間制御で複数台を通す。
    const radius = Math.hypot(CAR.length, CAR.width) + 0.8;
    if (a.exit === b.exit || samples.get(key).some((p) => samples.get(other).some((q) => (p.x - q.x) ** 2 + (p.z - q.z) ** 2 < radius ** 2))) conflicts.get(key).add(other);
  }
}
export function routesConflict(a, b) { return conflicts.get(a.key).has(b.key); }

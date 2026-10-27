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

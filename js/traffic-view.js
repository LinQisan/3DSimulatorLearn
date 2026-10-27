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

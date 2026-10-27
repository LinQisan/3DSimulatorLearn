import * as THREE from 'three';
import { CAR, DIRECTIONS, PENDING_SLOTS, ROAD } from './config.js';
import { ROUTES, routeFor } from './routes.js';

export function createTrafficView(scene, container) {
  const root = new THREE.Group();
  root.name = '信号機・走行車両・場外待機列';
  scene.add(root);
  const meshes = new Map(), ghosts = new Map();
  const lamps = [];
  const dark = new THREE.MeshStandardMaterial({ color: 0x26372f, roughness: 0.7 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x7e8983, metalness: 0.5, roughness: 0.5 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x26332e, roughness: 1 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x526a71, roughness: 0.25 });
  const frontLight = new THREE.MeshBasicMaterial({ color: 0xfff1b5 });
  const rearLight = new THREE.MeshBasicMaterial({ color: 0xc74a40 });
  const amber = new THREE.MeshBasicMaterial({ color: 0xffb12e });
  const bodyGeometry = new THREE.BoxGeometry(CAR.width, 0.65, CAR.length);
  const cabinGeometry = new THREE.BoxGeometry(1.5, 0.6, 2);
  const wheelGeometry = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 10);
  const lightGeometry = new THREE.BoxGeometry(0.4, 0.22, 0.06);
  function mesh(parent, geometry, material, x, y, z) {
    const item = new THREE.Mesh(geometry, material);
    item.position.set(x, y, z);
    item.castShadow = item.receiveShadow = true;
    parent.add(item);
    return item;
  }
  // 走行車両と場外の代表車両で基本形状を共有する。
  const templates = [0xc97953, 0x557c7b, 0xd8c494, 0x869e73, 0xf1eee2].map((color) => {
    const car = new THREE.Group();
    mesh(car, bodyGeometry, new THREE.MeshStandardMaterial({ color, roughness: 0.55 }), 0, 0.62, 0);
    mesh(car, cabinGeometry, glass, 0, 1.15, -0.25);
    for (const x of [-0.92, 0.92]) for (const z of [-1.3, 1.3]) mesh(car, wheelGeometry, rubber, x, 0.3, z).rotation.z = Math.PI / 2;
    for (const x of [-0.55, 0.55]) {
      mesh(car, lightGeometry, frontLight, x, 0.65, CAR.length / 2);
      mesh(car, lightGeometry, rearLight, x, 0.65, -CAR.length / 2);
    }
    mesh(car, lightGeometry, amber, 0.85, 0.9, 1.65).name = 'left-indicator';
    mesh(car, lightGeometry, amber, -0.85, 0.9, 1.65).name = 'right-indicator';
    return car;
  });
  const ghostMaterials = new Map();
  const ghostTemplates = templates.map((template) => {
    const copy = template.clone(true);
    copy.traverse((item) => {
      if (!item.material) return;
      if (!ghostMaterials.has(item.material)) {
        const material = item.material.clone();
        material.transparent = true;
        material.opacity = 0.55;
        material.depthWrite = false;
        ghostMaterials.set(item.material, material);
      }
      item.material = ghostMaterials.get(item.material);
      item.castShadow = false;
    });
    return copy;
  });
  function createModel(list, requestId) {
    const model = list[(requestId - 1) % list.length].clone(true);
    root.add(model);
    return { model, left: model.getObjectByName('left-indicator'), right: model.getObjectByName('right-indicator') };
  }
  function place(entry, pose, movement, blink) {
    entry.model.position.set(pose.x, 0.065, pose.z);
    entry.model.rotation.y = pose.yaw;
    entry.left.visible = movement === 'left' && blink;
    entry.right.visible = movement === 'right' && blink;
  }
  const layer = document.createElement('div');
  layer.className = 'pending-layer';
  layer.setAttribute('role', 'group');
  layer.setAttribute('aria-label', '各道路端の場外待機列');
  container.appendChild(layer);
  const badges = new Map();
  const padMaterial = new THREE.MeshStandardMaterial({ color: 0xcbd7c4, roughness: 1 });
  const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0xf8f8ed });
  const number = new Intl.NumberFormat('ja-JP');

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
    // 道路を延長したように誤解させず、入口の外側に淡い場外待機区画を作る。
    mesh(signal, new THREE.BoxGeometry(5.8, 0.06, 27), padMaterial, 3, -0.03, -73.5);
    for (let i = 0; i <= PENDING_SLOTS; i++) mesh(signal, new THREE.BoxGeometry(5.3, 0.02, 0.12), stripeMaterial, 3, 0.01, -60 - i * (CAR.length + CAR.gap));
    root.add(signal);
    const badge = document.createElement('div');
    badge.className = 'pending-badge';
    badge.id = `scene-pending-${direction.id}`;
    badge.innerHTML = `<strong>${direction.name}の入口</strong><span>場外 0 台</span><small>場外の待機なし</small>`;
    layer.appendChild(badge);
    const pose = ROUTES.get(`${direction.id}:straight`).pose(-73);
    // 台数札を待機列の横へ寄せ、先頭4台の車体を隠さない。
    pose.x -= Math.cos(direction.angle) * 28;
    pose.z += Math.sin(direction.angle) * 28;
    badges.set(direction.id, { element: badge, anchor: new THREE.Vector3(pose.x, 2, pose.z), count: -1 });
  }

  return {
    sync(simulation, camera) {
      const alive = new Set(), waiting = new Set();
      const blink = Math.floor(simulation.time * 2) % 2 === 0;
      for (const lane of simulation.lanes) {
        for (const car of lane.cars) {
          alive.add(car.id);
          if (!meshes.has(car.id)) meshes.set(car.id, createModel(templates, car.requestId));
          const route = routeFor(car);
          const position = car.previous + (car.position - car.previous) * simulation.alpha;
          place(meshes.get(car.id), route.pose(position), car.movement, blink && car.position <= route.clearAt);
        }
        const requests = lane.pendingQueue.slice(lane.pendingHead, lane.pendingHead + PENDING_SLOTS);
        requests.forEach((request, index) => {
          waiting.add(request.requestId);
          if (!ghosts.has(request.requestId)) ghosts.set(request.requestId, createModel(ghostTemplates, request.requestId));
          const position = -ROAD.size / 2 - CAR.length / 2 - CAR.gap - index * (CAR.length + CAR.gap);
          const pose = ROUTES.get(`${lane.id}:straight`).pose(position);
          place(ghosts.get(request.requestId), pose, request.movement, blink);
        });
        const badge = badges.get(lane.id);
        if (badge.count !== lane.pending) {
          badge.count = lane.pending;
          badge.element.querySelector('span').textContent = `場外 ${number.format(lane.pending)} 台`;
          badge.element.querySelector('small').textContent = lane.pending > PENDING_SLOTS ? `先頭${PENDING_SLOTS}台表示 ＋${number.format(lane.pending - PENDING_SLOTS)}台` : lane.pending ? `${lane.pending}台を表示` : '場外の待機なし';
          badge.element.dataset.empty = String(lane.pending === 0);
        }
        const projected = badge.anchor.clone().project(camera);
        badge.element.hidden = projected.z < -1 || projected.z > 1 || Math.abs(projected.x) > 1 || Math.abs(projected.y) > 1;
        const halfWidth = badge.element.offsetWidth / 2;
        badge.element.style.left = `${Math.max(halfWidth + 5, Math.min(container.clientWidth - halfWidth - 5, (projected.x + 1) * container.clientWidth / 2))}px`;
        badge.element.style.top = `${(1 - projected.y) * container.clientHeight / 2}px`;
      }
      for (const [map, ids] of [[meshes, alive], [ghosts, waiting]]) for (const [id, entry] of map) {
        if (!ids.has(id)) { root.remove(entry.model); map.delete(id); }
      }
      for (const lamp of lamps) {
        const active = simulation.signal.color(lamp.axis) === lamp.color;
        lamp.material.color.setHex(active ? lamp.value : 0x263b32);
        lamp.material.emissiveIntensity = active ? 1.6 : 0;
      }
    },
    dispose() {
      const geometries = new Set(), materials = new Set();
      for (const object of [root, ...templates, ...ghostTemplates]) object.traverse((item) => {
        if (item.geometry) geometries.add(item.geometry);
        if (item.material) materials.add(item.material);
      });
      geometries.forEach((item) => item.dispose());
      materials.forEach((item) => item.dispose());
      meshes.clear(); ghosts.clear();
      layer.remove();
      scene.remove(root);
    },
  };
}

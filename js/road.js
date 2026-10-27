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

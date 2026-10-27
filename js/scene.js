import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { createRoad } from './road.js';
import { createTrafficView } from './traffic-view.js';

export function createScene(container) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xe8eee1);
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '十字路。ドラッグで回転、ホイールでズーム、右ドラッグまたは矢印キーで移動。');
  container.appendChild(renderer.domElement);

  // 空と地面からの環境光に、斜め上からの日光を加える。
  scene.add(new THREE.HemisphereLight(0xfffcf0, 0x7c916a, 2.6));
  const sun = new THREE.DirectionalLight(0xfff6df, 2.4);
  sun.position.set(-40, 90, -30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -90, right: 90, top: 90, bottom: -90, far: 200 });
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(createRoad());
  const traffic = createTrafficView(scene, container);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.screenSpacePanning = false;
  controls.minDistance = 25;
  controls.maxDistance = 500;
  controls.maxPolarAngle = Math.PI / 2 - 0.08;
  // キーボード操作は、3Dビューにフォーカスがあるときだけ受け付ける。
  controls.listenToKeyEvents(renderer.domElement);

  function resize() {
    const { width, height } = container.getBoundingClientRect();
    camera.aspect = width / Math.max(height, 1);
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
  }
  resize();
  // 縦長画面でも交差点が収まるよう、初期のカメラ距離を調整する。
  camera.position.set(94, 110, 126).multiplyScalar(1.25 * Math.max(1, 1.15 / camera.aspect));
  controls.target.set(0, 0, 0);
  controls.update();
  controls.saveState();
  const observer = new ResizeObserver(resize);
  observer.observe(container);

  // 視点操作は実時間、車両表示は物理モデルの補間位置で更新する。
  return {
    update(deltaTime, simulation) {
      controls.dampingFactor = 1 - Math.exp(-12 * deltaTime);
      controls.update(deltaTime);
      camera.updateMatrixWorld();
      traffic.sync(simulation, camera);
    },
    render() { renderer.render(scene, camera); },
    resetView() { controls.reset(); },
    dispose() {
      observer.disconnect();
      controls.dispose();
      traffic.dispose();
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) materials.add(object.material);
      });
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) {
        material.map?.dispose();
        material.dispose();
      }
      sun.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

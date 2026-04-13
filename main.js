import "./main-enhanced.js";
/*
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";

const GRID = 8;
const CELL = 1;
const MAX_H = 8;
const ORIGIN = new THREE.Vector3(
  ((GRID - 1) * CELL) / 2,
  0,
  ((GRID - 1) * CELL) / 2
);

const PRESETS = {
  intro: {
    label: "情境：正面看似 3 箱，实际 4 箱（中间后排多 1 箱）",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [1, 0, 1],
    ],
    target: 4,
  },
  free: {
    label: "自由堆放：试试 4 个箱子有哪些不同堆法",
    cells: [],
    target: null,
  },
  sheet1: {
    label: "图纸一：6 箱平铺（无遮挡）",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [2, 0, 1],
    ],
    target: 6,
    diagramBadge: "图纸一",
    diagramCaption: "两层各 3 箱，每格都是 1 层高，共 6 箱。",
  },
  sheet2: {
    label: "图纸二：6 箱带遮挡，可用透视分层点数",
    cells: [
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 0],
    ],
    target: 6,
    diagramBadge: "图纸二",
    diagramCaption: "中间靠前那一摞要叠 2 层；虚线格不放箱。共 6 箱。",
  },
};

const canvas = document.getElementById("c");
const elCount = document.getElementById("count");
const elTarget = document.getElementById("targetLine");
const elHint = document.getElementById("hint");
const overlayTop = document.getElementById("overlayTop");
const sheetPanel = document.getElementById("sheetPanel");
const sheetPanelBadge = document.getElementById("sheetPanelBadge");
const sheetPanelCaption = document.getElementById("sheetPanelCaption");
const sheetPanelDiagram = document.getElementById("sheetPanelDiagram");
const btnXray = document.getElementById("btn-xray");
const btnPlace = document.getElementById("btn-place");
const btnRemove = document.getElementById("btn-remove");
const btnReset = document.getElementById("btn-reset");
const btnFront = document.getElementById("btn-front");
const btnSide = document.getElementById("btn-side");
const btnFreecam = document.getElementById("btn-freecam");
const btnFullscreen = document.getElementById("btn-fullscreen");
const appEl = document.getElementById("app");
const stageWrap = document.getElementById("stageWrap");
const btnExitStageFullscreen = document.getElementById("btn-exit-stage-fullscreen");

/** 浏览器不支持元素全屏时，用 CSS 铺满仅保留 3D 区 */
let stageImmersiveFallback = false;

let mode = "place";
let xray = false;
let currentKey = "free";

const scene = new THREE.Scene();
const SKY = 0x243a52;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 14, 40);

const camera = new THREE.PerspectiveCamera(
  48,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.set(7.2, 6.5, 9.2);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: false,
  powerPreference: "high-performance",
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(ORIGIN.clone().add(new THREE.Vector3(0, 1.2, 0)));
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.minDistance = 5;
controls.maxDistance = 28;
controls.maxPolarAngle = Math.PI * 0.495;
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
};

scene.add(new THREE.AmbientLight(0xd2e4ff, 0.62));
const sun = new THREE.DirectionalLight(0xfff5e0, 1.12);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 2;
sun.shadow.camera.far = 40;
sun.shadow.camera.left = -12;
sun.shadow.camera.right = 12;
sun.shadow.camera.top = 12;
sun.shadow.camera.bottom = -12;
scene.add(sun);

const fill = new THREE.DirectionalLight(0xb8d8ff, 0.42);
fill.position.set(-6, 8, -10);
scene.add(fill);

const floorGeo = new THREE.PlaneGeometry(GRID * CELL + 6, GRID * CELL + 6);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x2a3d55,
  roughness: 0.88,
  metalness: 0.04,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(
  GRID * CELL + 0.02,
  GRID,
  0x5a7ab0,
  0x3d5a80
);
gridHelper.position.set(ORIGIN.x, 0.002, ORIGIN.z);
scene.add(gridHelper);

const boxGeo = new THREE.BoxGeometry(CELL * 0.92, CELL * 0.92, CELL * 0.92);

/** 大班/卡通风：高饱和 pastel 果箱色，按格位轮换 */
const CARTOON_CRATE_HEX = [
  0xffb088, // 杏橙
  0xffe566, // 柠檬黄
  0x7ee0b0, // 蜜瓜绿
  0xff9ec8, // 草莓粉
  0x8fd4ff, // 天空蓝
  0xe4b8ff, // 香芋紫
];

function createCartoonCrateMaterial(gx, gy, gz) {
  const hex = CARTOON_CRATE_HEX[(gx + gz * 3 + gy * 5) % CARTOON_CRATE_HEX.length];
  const color = new THREE.Color(hex);
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.32,
    metalness: 0.02,
    emissive: color.clone(),
    emissiveIntensity: 0.22,
  });
}

const edgeGeo = new THREE.EdgesGeometry(boxGeo);
const OUTLINE_COLOR = 0x5c3d28;

/** @type {Map<string, THREE.Group>} */
const cubes = new Map();

function heightAt(gx, gz) {
  let h = 0;
  for (let y = 0; y < MAX_H; y++) {
    if (cubes.has(`${gx},${y},${gz}`)) h = y + 1;
  }
  return h;
}

function worldPos(gx, gy, gz) {
  return new THREE.Vector3(gx * CELL, 0.5 * CELL + gy * CELL, gz * CELL);
}

function applyXrayToGroup(group, on) {
  group.traverse((o) => {
    if (o.isMesh && o.material) {
      const m = o.material;
      m.transparent = on;
      m.opacity = on ? 0.38 : 1;
      m.depthWrite = !on;
    }
  });
}

function setXray(on) {
  xray = on;
  btnXray.setAttribute("aria-pressed", on ? "true" : "false");
  cubes.forEach((g) => applyXrayToGroup(g, on));
}

function updateCountUI() {
  const n = cubes.size;
  elCount.textContent = String(n);
  const t = PRESETS[currentKey]?.target;
  if (t != null) {
    elTarget.textContent = `本关目标 ${t} 箱` + (n === t ? " · 已达目标" : "");
  } else {
    elTarget.textContent = "";
  }
}

function addCube(gx, gy, gz) {
  const k = `${gx},${gy},${gz}`;
  if (cubes.has(k)) return false;
  if (gy > 0 && !cubes.has(`${gx},${gy - 1},${gz}`)) return false;

  const group = new THREE.Group();
  const mesh = new THREE.Mesh(boxGeo, createCartoonCrateMaterial(gx, gy, gz));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.set(0, 0, 0);
  group.add(mesh);

  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({
      color: OUTLINE_COLOR,
      transparent: true,
      opacity: 0.92,
    })
  );
  group.add(edges);

  const pos = worldPos(gx, gy, gz);
  group.position.copy(pos);
  mesh.name = "cratePick";
  group.userData = { gx, gy, gz, key: k, pickMesh: mesh };
  scene.add(group);
  cubes.set(k, group);
  applyXrayToGroup(group, xray);
  updateCountUI();
  return true;
}

function removeCube(gx, gy, gz) {
  const k = `${gx},${gy},${gz}`;
  const g = cubes.get(k);
  if (!g) return false;
  for (let y = gy + 1; y < MAX_H; y++) {
    if (cubes.has(`${gx},${y},${gz}`)) return false;
  }
  scene.remove(g);
  cubes.delete(k);
  g.traverse((o) => {
    if (o.geometry && o.geometry !== boxGeo && o.geometry !== edgeGeo) o.geometry.dispose?.();
    if (o.material) {
      if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose?.());
      else o.material.dispose?.();
    }
  });
  updateCountUI();
  return true;
}

const DIAGRAM_FILLS = [
  "#ffb088",
  "#ffe566",
  "#7ee0b0",
  "#ff9ec8",
  "#8fd4ff",
  "#e4b8ff",
];

/** 每根柱子上箱子的数量（与场景逻辑一致：无悬空则等于 max(gy)+1） */
function columnHeightsFromCells(cells) {
  const maxGy = new Map();
  for (const [gx, gy, gz] of cells) {
    const k = `${gx},${gz}`;
    maxGy.set(k, Math.max(maxGy.get(k) ?? -1, gy));
  }
  const m = new Map();
  for (const [k, g] of maxGy) m.set(k, g + 1);
  return m;
}

/**
 * 俯视图 SVG：横排 = 前→后（z），竖排 = 左→右（x）；数字 = 该摞层数。
 */
function buildSheetDiagramSvg(cells) {
  if (!cells.length) return "";
  const H = columnHeightsFromCells(cells);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [gx, gy, gz] of cells) {
    minX = Math.min(minX, gx);
    maxX = Math.max(maxX, gx);
    minZ = Math.min(minZ, gz);
    maxZ = Math.max(maxZ, gz);
  }
  const nx = maxX - minX + 1;
  const nz = maxZ - minZ + 1;
  const cell = 30;
  const g = 4;
  const ml = 22;
  const mt = 18;
  const mb = 16;
  const mr = 8;
  const W = ml + nz * (cell + g) + mr;
  const Ht = mt + nx * (cell + g) + mb;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Ht}" class="sheet-svg" role="img" aria-label="搭建俯视图示意图">`,
    `<defs><filter id="sd" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.35"/></filter></defs>`,
    `<text x="${ml}" y="12" font-size="9" fill="#7a9ab8" font-weight="600">后</text>`,
    `<text x="${W - mr - 2}" y="12" font-size="9" fill="#7a9ab8" font-weight="600" text-anchor="end">前</text>`,
  ];

  for (let xi = 0; xi < nx; xi++) {
    const gx = minX + xi;
    const ly = mt + xi * (cell + g) + cell / 2 + 4;
    parts.push(
      `<text x="3" y="${ly}" font-size="10" fill="#8fa8c0" font-weight="700">${gx + 1}</text>`
    );
  }

  for (let zi = 0; zi < nz; zi++) {
    const gz = maxZ - zi;
    for (let xi = 0; xi < nx; xi++) {
      const gx = minX + xi;
      const k = `${gx},${gz}`;
      const h = H.get(k) || 0;
      const x = ml + zi * (cell + g);
      const y = mt + xi * (cell + g);
      const fill = DIAGRAM_FILLS[(gx + gz) % DIAGRAM_FILLS.length];
      if (h === 0) {
        parts.push(
          `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.28)" stroke-width="1.2" stroke-dasharray="3 3"/>`
        );
      } else {
        parts.push(
          `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="8" fill="${fill}" stroke="#5c3d28" stroke-width="2" filter="url(#sd)"/>`
        );
        parts.push(
          `<text x="${x + cell / 2}" y="${y + cell / 2 + 5}" text-anchor="middle" font-size="13" font-weight="800" fill="#3d2818" font-family="system-ui,sans-serif">${h}</text>`
        );
      }
    }
  }

  parts.push(`</svg>`);
  return parts.join("");
}

function syncSheetPanel(key) {
  const show = key === "sheet1" || key === "sheet2";
  overlayTop.classList.toggle("overlay__top--diagram", show);
  if (!show) {
    sheetPanel.hidden = true;
    return;
  }
  const p = PRESETS[key];
  sheetPanel.hidden = false;
  sheetPanelBadge.textContent = p.diagramBadge || "图纸";
  sheetPanelCaption.textContent = p.diagramCaption || "";
  sheetPanelDiagram.innerHTML = buildSheetDiagramSvg(p.cells);
}

function clearAll() {
  const sorted = [...cubes.keys()]
    .map((k) => {
      const [gx, gy, gz] = k.split(",").map(Number);
      return { gx, gy, gz };
    })
    .sort((a, b) => b.gy - a.gy);
  for (const { gx, gy, gz } of sorted) {
    removeCube(gx, gy, gz);
  }
}

function loadPreset(key) {
  currentKey = key;
  const p = PRESETS[key];
  clearAll();
  for (const [gx, gy, gz] of p.cells) {
    addCube(gx, gy, gz);
  }
  elHint.textContent =
    p.label +
    " — 单指拖动旋转；双指缩放。放置：点箱顶加高一层；点侧面或空地则在对应格落箱；拆除：先点「拆除」再点箱子。";
  updateCountUI();
  syncSheetPanel(key);
}

function resetCurrent() {
  loadPreset(currentKey);
}

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const planeFloor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const _worldN = new THREE.Vector3();
const TAP_PX = window.matchMedia("(pointer: coarse)").matches ? 22 : 14;
let dragStart = null;

/** 只拾取箱体实体，避免线框抢先命中导致错位 */
function pickMeshes() {
  const list = [];
  cubes.forEach((g) => {
    const m = g.userData.pickMesh;
    if (m) list.push(m);
  });
  return list;
}

function hitWorldNormal(hit) {
  return _worldN.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
}

/** 将世界坐标映射到格柱（箱体中心在整数格点） */
function xzToColumn(px, pz) {
  return {
    gx: clampGrid(Math.round(px / CELL)),
    gz: clampGrid(Math.round(pz / CELL)),
  };
}

function ndcFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

function clampGrid(n) {
  return Math.max(0, Math.min(GRID - 1, n));
}

function tryPlaceFromRay() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickMeshes(), false);
  if (hits.length) {
    const hit = hits[0];
    const n = hitWorldNormal(hit);
    let root = hit.object;
    while (root.parent && root.userData.gx == null) root = root.parent;
    const ud = root.userData;
    if (ud && ud.gx != null) {
      if (n.y > 0.45) {
        const ny = ud.gy + 1;
        if (ny < MAX_H) addCube(ud.gx, ny, ud.gz);
      } else {
        const { gx, gz } = xzToColumn(hit.point.x, hit.point.z);
        const h = heightAt(gx, gz);
        if (h < MAX_H) addCube(gx, h, gz);
      }
    }
    return;
  }

  const pt = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(planeFloor, pt)) {
    const { gx, gz } = xzToColumn(pt.x, pt.z);
    const h = heightAt(gx, gz);
    if (h < MAX_H) addCube(gx, h, gz);
  }
}

function tryRemoveFromRay() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickMeshes(), false);
  if (!hits.length) return;
  let root = hits[0].object;
  while (root.parent && root.userData.gx == null) root = root.parent;
  const ud = root.userData;
  if (ud && ud.gx != null) {
    removeCube(ud.gx, ud.gy, ud.gz);
  }
}

function onPointerDown(e) {
  if (e.button != null && e.button !== 0) return;
  dragStart = { x: e.clientX, y: e.clientY };
}

function onPointerUp(e) {
  if (e.button != null && e.button !== 0) return;
  if (dragStart) {
    const dx = e.clientX - dragStart.x;
    const dy = e.clientY - dragStart.y;
    dragStart = null;
    if (dx * dx + dy * dy > TAP_PX * TAP_PX) return;
  }
  ndcFromEvent(e);
  if (mode === "place") tryPlaceFromRay();
  else tryRemoveFromRay();
}

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", () => {
  dragStart = null;
});

document.querySelectorAll("[data-scene]").forEach((b) => {
  b.addEventListener("click", () => loadPreset(b.getAttribute("data-scene")));
});

btnXray.addEventListener("click", () => setXray(!xray));

btnPlace.addEventListener("click", () => {
  mode = "place";
  btnPlace.setAttribute("aria-pressed", "true");
  btnRemove.setAttribute("aria-pressed", "false");
});

btnRemove.addEventListener("click", () => {
  mode = "remove";
  btnRemove.setAttribute("aria-pressed", "true");
  btnPlace.setAttribute("aria-pressed", "false");
});

btnReset.addEventListener("click", () => resetCurrent());

const orbitTarget = controls.target.clone();

function animateCameraTo(pos, target, duration = 520) {
  const startP = camera.position.clone();
  const startT = controls.target.clone();
  const t0 = performance.now();
  function step(now) {
    const u = Math.min(1, (now - t0) / duration);
    const k = 1 - Math.pow(1 - u, 3);
    camera.position.lerpVectors(startP, pos, k);
    controls.target.lerpVectors(startT, target, k);
    controls.update();
    if (u < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

btnFront.addEventListener("click", () => {
  const target = ORIGIN.clone().add(new THREE.Vector3(0, 1.1, 0));
  animateCameraTo(new THREE.Vector3(ORIGIN.x, 4.2, ORIGIN.z + 11.5), target);
});

btnSide.addEventListener("click", () => {
  const target = ORIGIN.clone().add(new THREE.Vector3(0, 1.1, 0));
  animateCameraTo(new THREE.Vector3(ORIGIN.x + 11.5, 4.2, ORIGIN.z), target);
});

btnFreecam.addEventListener("click", () => {
  animateCameraTo(new THREE.Vector3(7.2, 6.5, 9.2), orbitTarget.clone());
});

function fullscreenElement() {
  return (
    document.fullscreenElement ||
    document.webkitFullscreenElement ||
    null
  );
}

function isStageFullscreen() {
  const el = fullscreenElement();
  return el === stageWrap || stageImmersiveFallback === true;
}

function syncFullscreenButton() {
  if (!btnFullscreen) return;
  const on = isStageFullscreen();
  btnFullscreen.setAttribute("aria-pressed", on ? "true" : "false");
  btnFullscreen.textContent = on ? "退出全屏" : "堆箱全屏";
  if (btnExitStageFullscreen) {
    btnExitStageFullscreen.hidden = !on;
  }
}

function leaveStageFullscreen() {
  if (stageImmersiveFallback && appEl) {
    appEl.classList.remove("app--immersive-stage");
    stageImmersiveFallback = false;
  } else if (fullscreenElement()) {
    if (document.exitFullscreen) void document.exitFullscreen();
    else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
  }
  syncFullscreenButton();
  syncRendererSize();
}

async function enterStageFullscreen() {
  if (!stageWrap) return;
  try {
    const req =
      stageWrap.requestFullscreen?.bind(stageWrap) ||
      stageWrap.webkitRequestFullscreen?.bind(stageWrap);
    if (!req) throw new Error("no element fullscreen");
    const ret = req();
    if (ret && typeof ret.then === "function") await ret;
    stageImmersiveFallback = false;
  } catch {
    if (appEl) {
      appEl.classList.add("app--immersive-stage");
      stageImmersiveFallback = true;
    }
  }
  syncFullscreenButton();
  syncRendererSize();
}

async function toggleStageFullscreen() {
  if (isStageFullscreen()) {
    leaveStageFullscreen();
    return;
  }
  await enterStageFullscreen();
}

if (btnFullscreen) {
  btnFullscreen.addEventListener("click", () => {
    void toggleStageFullscreen();
  });
}

if (btnExitStageFullscreen) {
  btnExitStageFullscreen.addEventListener("click", () => {
    leaveStageFullscreen();
  });
}

document.addEventListener("fullscreenchange", () => {
  if (!fullscreenElement()) stageImmersiveFallback = false;
  syncFullscreenButton();
  syncRendererSize();
});
document.addEventListener("webkitfullscreenchange", () => {
  if (!fullscreenElement()) stageImmersiveFallback = false;
  syncFullscreenButton();
  syncRendererSize();
});
syncFullscreenButton();

function syncRendererSize() {
  let w = window.innerWidth;
  let h = window.innerHeight;
  const fsEl = fullscreenElement();
  if (fsEl === stageWrap && stageWrap) {
    w = stageWrap.clientWidth || w;
    h = stageWrap.clientHeight || h;
  } else if (stageImmersiveFallback && stageWrap) {
    w = stageWrap.clientWidth || w;
    h = stageWrap.clientHeight || h;
  }
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
}

window.addEventListener("resize", syncRendererSize);
window.visualViewport?.addEventListener("resize", syncRendererSize);
syncRendererSize();

function tick() {
  requestAnimationFrame(tick);
  controls.update();
  renderer.render(scene, camera);
}

loadPreset("intro");
tick();
*/

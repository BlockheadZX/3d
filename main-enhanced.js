import * as THREE from "./vendor/three/build/three.module.js";
import { OrbitControls } from "./vendor/three/examples/jsm/controls/OrbitControls.js";

const bootDiagnostic =
  window.__bootDiagnostic && typeof window.__bootDiagnostic.mark === "function"
    ? window.__bootDiagnostic
    : null;

if (bootDiagnostic) {
  bootDiagnostic.mark("js", "ok", "脚本已启动，正在准备 3D 场景。");
}

const GRID = 4;
const CELL = 1;
const MAX_H = 8;
const MAX_HISTORY_ENTRIES = 36;
const IS_COARSE_POINTER = window.matchMedia("(pointer: coarse)").matches;
const TAP_PX = IS_COARSE_POINTER ? 22 : 14;
/** 触控设备上，顶栏默认收起；含多数平板竖屏/横屏（旧版 iPad / Android 常用宽度） */
const TOP_PANEL_TOUCH_AUTO_COLLAPSE_MAX_W = 1024;
/** 警告/错误类底部提示至少显示时长，再恢复默认操作说明 */
const FEEDBACK_WARN_ERROR_HIDE_MS = 3000;
const DEFAULT_HINT =
  "先选主操作，再轻点 3D 画面。单指拖动换方向，双指捏合能看得更清楚。";

const ORIGIN = new THREE.Vector3(
  ((GRID - 1) * CELL) / 2,
  0,
  ((GRID - 1) * CELL) / 2
);
const DEFAULT_CAMERA_TARGET = ORIGIN.clone().add(new THREE.Vector3(0, 1.1, 0));
/** 略拉近，减少画面四周「空蓝天」占比（随 GRID 4×4 略收） */
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(5.8, 4.8, 7.5);

const PRESETS = {
  intro: {
    name: "情境·4箱遮挡",
    label: "情境：正面看似 3 箱，实际 4 箱（中间后排多 1 箱）",
    task: "研究任务：从正面数一数，为什么看起来只有 3 箱，实际却有 4 箱？",
    recommendedView: "front",
    phases: [
      { label: "先观察", prompt: "先观察：站在正面看看，你现在能看到几箱？" },
      { label: "先猜想", prompt: "先猜一猜：后面会不会还有被挡住的箱子？" },
      { label: "动手验证", prompt: "动手验证：转到侧面或自由视角，再重新数一数。" },
      { label: "说说发现", prompt: "说说发现：为什么正面像 3 箱，实际却有 4 箱？" },
    ],
    cells: [
      [1, 0, 2],
      [2, 0, 2],
      [3, 0, 2],
      [2, 0, 3],
    ],
    target: 4,
  },
  free: {
    name: "清空·自由堆",
    label: "自由搭建：试试 4 个箱子有哪些不同堆法",
    task: "研究任务：自己搭一搭，再换不同方向说说你看到了几箱。",
    recommendedView: "freecam",
    phases: [
      { label: "先搭建", prompt: "先搭建：请你自己搭出几箱不同的样子。" },
      { label: "先观察", prompt: "先观察：换一个方向看，你看到的箱数一样吗？" },
      { label: "动手验证", prompt: "动手验证：转一转仓库，比比正面、侧面和斜着看。"},
      { label: "说说发现", prompt: "说说发现：遮挡和高低，会不会影响你看到的箱数？" },
    ],
    cells: [],
    target: null,
  },
  /**
   * 图纸八：参考 3×3 网格示意（后左为原点方向），五摞共 8 箱。
   * 左后、中后、左中各 2 层；正中、右中各 1 层；其余格空。
   */
  sheet8: {
    name: "图纸八·8箱",
    label: "图纸八：五摞错落（三摞两层、两摞一层），共 8 箱",
    task: "研究任务：按参考图在 3×3 区域内搭出五摞箱子，注意有两格只有一只箱。",
    recommendedView: "freecam",
    phases: [
      { label: "先读图", prompt: "先读图：图里有几摞是「叠两层」的？有几摞只有一层？" },
      { label: "先猜想", prompt: "先猜一猜：一共是几只箱子？" },
      { label: "动手验证", prompt: "动手验证：搭完后转一转，和俯视图格内数字对照。" },
      { label: "说说发现", prompt: "说说发现：空格子对「数箱子」有什么帮助？" },
    ],
    cells: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 0, 1],
      [0, 1, 1],
      [1, 0, 1],
      [2, 0, 0],
    ],
    target: 8,
    diagramBadge: "图纸八",
    diagramCaption: "（gx,gz）左后(0,0)(1,0)与中后(0,1)各 2 层；正中(1,1) 1 层；右前(2,0) 1 层；(2,1) 不放箱，共 8 箱。",
  },
  /** 前排 2、2、1，后排左两格 2 层（右后空），共 9 箱 */
  sheet9: {
    name: "图纸九·9箱",
    label: "图纸九：前排多出一格，后排两格仍叠高，共 9 箱",
    task: "研究任务：照图搭 9 箱，注意最右前一格只有一层、右后一格不放箱。",
    recommendedView: "freecam",
    phases: [
      { label: "先读图", prompt: "先读图：哪一格只有一层？哪一格在图上是空的？" },
      { label: "先猜想", prompt: "先猜一猜：从正面看会不会少看到几只？" },
      { label: "动手验证", prompt: "动手验证：搭完换侧面、自由视角数一数。" },
      { label: "说说发现", prompt: "说说发现：「凸出一块」时，数箱更容易还是更难？" },
    ],
    cells: [
      [0, 0, 0],
      [0, 1, 0],
      [1, 0, 0],
      [1, 1, 0],
      [2, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [1, 0, 1],
      [1, 1, 1],
    ],
    target: 9,
    diagramBadge: "图纸九",
    diagramCaption: "前排三列 2、2、1 层；后排左两列各 2 层，右后不放，共 9 箱。",
  },
  /** 前排 2、1、1，后排 3、2、1，共 10 箱 */
  /**
   * 图纸十：阶梯形（3×3 区域）。矩阵「后→前」行、「左→右」列，
   * 层高 [3,2,1] / [2,1,0] / [1,0,0]（其中 (1,1) 仅 1 箱），gx=列、gz=行，共 10 箱。
   */
  sheet10: {
    name: "图纸十·10箱",
    label: "图纸十：阶梯形三排错落，共 10 箱",
    task: "研究任务：按参考图搭出左后最高、向右向前逐层变矮的台阶形，可用透视核对。",
    recommendedView: "freecam",
    phases: [
      { label: "先读图", prompt: "先读图：哪一摞最高？哪几格是空的？" },
      { label: "先猜想", prompt: "先猜一猜：一共要几只箱子？" },
      { label: "动手验证", prompt: "动手验证：搭完转一转，对照俯视图格内数字。" },
      { label: "说说发现", prompt: "说说发现：这种「台阶」从斜上方看像什么？" },
    ],
    cells: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [1, 0, 0],
      [1, 1, 0],
      [2, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [1, 0, 1],
      [0, 0, 2],
    ],
    target: 10,
    diagramBadge: "图纸十",
    diagramCaption:
      "层高矩阵（后→前为行，左→右为列）：[3,2,1] / [2,1,0] / [1,0,0]，(1,1) 仅 1 箱，共 10 箱。",
  },
  /**
   * 图纸十一：9 箱。(0,0)3、(1,0)2、(0,1)2；(2,0)(2,1) 各 1 箱；(0,2)(1,2) 不放；(1,1) 空。
   */
  sheet11: {
    name: "图纸十一·9箱",
    label: "图纸十一：左区叠高、(2,0)(2,1) 各 1 箱，共 9 箱",
    task: "研究任务：按层高示意搭 9 箱，注意 (1,1) 不放箱，前排 (0,2)(1,2) 不放。",
    recommendedView: "freecam",
    phases: [
      { label: "先读图", prompt: "先读图：哪一格叠得最高？哪一格是空的？" },
      { label: "先猜想", prompt: "先猜一猜：空的那一格会影响你从正面数箱吗？" },
      { label: "动手验证", prompt: "动手验证：搭完换角度，和俯视图数字核对。" },
      { label: "说说发现", prompt: "说说发现：为什么图纸里要留一个「洞」？" },
    ],
    cells: [
      [0, 0, 0],
      [0, 1, 0],
      [0, 2, 0],
      [1, 0, 0],
      [1, 1, 0],
      [0, 0, 1],
      [0, 1, 1],
      [2, 0, 0],
      [2, 0, 1],
    ],
    target: 9,
    diagramBadge: "图纸十一",
    diagramCaption:
      "(0,0)3、(1,0)2、(0,1)2；(2,0)(2,1) 各 1 箱；(0,2)(1,2) 不放；(1,1) 不放，共 9 箱。",
  },
};

const canvas = document.getElementById("c");
const elCount = document.getElementById("count");
const elTarget = document.getElementById("targetLine");
const elHint = document.getElementById("hint");
const researchTaskEl = document.getElementById("researchTask");
const overlayTop = document.getElementById("overlayTop");
const sheetPanel = document.getElementById("sheetPanel");
const sheetPanelBadge = document.getElementById("sheetPanelBadge");
const sheetPanelCaption = document.getElementById("sheetPanelCaption");
const sheetPanelDiagram = document.getElementById("sheetPanelDiagram");
const stageStatus = document.getElementById("stageStatus");
const feedbackEl = document.getElementById("feedback");
const researchPhaseBadgeEl = document.getElementById("researchPhaseBadge");
const researchStepsEl = document.getElementById("researchSteps");
const topPanel = document.querySelector(".top-panel");
const topPanelDetails = document.getElementById("topPanelDetails");
const topPanelSummaryBadgeEl = document.getElementById("topPanelSummaryBadge");
const topPanelSummaryTextEl = document.getElementById("topPanelSummaryText");
const btnUndo = document.getElementById("btn-undo");
const btnClear = document.getElementById("btn-clear");
const btnXray = document.getElementById("btn-xray");
const btnPlace = document.getElementById("btn-place");
const btnRemove = document.getElementById("btn-remove");
const btnCountMode = document.getElementById("btn-count-mode");
const btnReset = document.getElementById("btn-reset");
const btnFront = document.getElementById("btn-front");
const btnSide = document.getElementById("btn-side");
const btnFreecam = document.getElementById("btn-freecam");
const btnFullscreen = document.getElementById("btn-fullscreen");
const btnTools = document.getElementById("btn-tools");
const btnCloseTools = document.getElementById("btn-close-tools");
const btnTeacherMode = document.getElementById("btn-teacher-mode");
const btnPhaseNext = document.getElementById("btn-phase-next");
const btnTopPanelToggle = document.getElementById("btn-top-panel-toggle");
const topPanelToggleLabelEl = document.getElementById("topPanelToggleLabel");
const btnTopPanelSummary = document.getElementById("btn-top-panel-summary");
const appEl = document.getElementById("app");
const stageWrap = document.getElementById("stageWrap");
const btnExitStageFullscreen = document.getElementById("btn-exit-stage-fullscreen");
const toolSheet = document.getElementById("toolSheet");
const sceneButtons = [...document.querySelectorAll("[data-scene]")];

if (!canvas || !stageWrap) {
  if (bootDiagnostic) {
    bootDiagnostic.mark("js", "error", "页面结构不完整，缺少关键元素，无法继续启动。");
  }
  throw new Error("Missing required app elements.");
}

const interactiveButtons = [
  ...sceneButtons,
  btnUndo,
  btnClear,
  btnXray,
  btnPlace,
  btnRemove,
  btnReset,
  btnFront,
  btnSide,
  btnFreecam,
  btnFullscreen,
  btnTools,
  btnCloseTools,
  btnTeacherMode,
  btnPhaseNext,
  btnTopPanelToggle,
  btnTopPanelSummary,
  btnCountMode,
].filter(Boolean);

const state = {
  mode: "place",
  xray: false,
  currentKey: "free",
  activeCamera: "freecam",
  stageImmersiveFallback: false,
  feedbackTimer: 0,
  resetTimer: 0,
  resetConfirmUntil: 0,
  cameraAnimationToken: 0,
  renderLoopHandle: 0,
  renderLoopRunning: false,
  contextLost: false,
  historyStack: [],
  teacherMode: false,
  researchPhase: 0,
  topPanelCollapsed:
    IS_COARSE_POINTER && window.innerWidth <= TOP_PANEL_TOUCH_AUTO_COLLAPSE_MAX_W,
  toolSheetOpen: false,
  /** 幼儿「数箱子」：禁止再放/拿，点箱变色表示已数过 */
  countingMode: false,
};

const scene = new THREE.Scene();
const SKY = 0x2b4e63;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 18, 58);

const camera = new THREE.PerspectiveCamera(
  44,
  window.innerWidth / window.innerHeight,
  0.1,
  200
);
camera.position.copy(DEFAULT_CAMERA_POSITION);

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: IS_COARSE_POINTER ? "default" : "high-performance",
  });
} catch (error) {
  if (stageStatus) {
    stageStatus.hidden = false;
    stageStatus.dataset.tone = "error";
    stageStatus.textContent = "这个设备暂时打不开 3D 画面，请重新打开页面。";
  }
  if (bootDiagnostic) {
    bootDiagnostic.mark(
      "webgl",
      "error",
      "这个设备暂时没能启动 3D 画面，请换 Safari / Chrome 或重新打开页面。"
    );
  }
  throw error;
}

if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
}
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, IS_COARSE_POINTER ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

if (bootDiagnostic) {
  bootDiagnostic.mark("webgl", "ok", "3D 画面已启动。");
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(DEFAULT_CAMERA_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 4.2;
controls.maxDistance = 22;
controls.maxPolarAngle = Math.PI * 0.495;
controls.rotateSpeed = IS_COARSE_POINTER ? 0.92 : 1;
controls.zoomSpeed = 0.95;
controls.touches = {
  ONE: THREE.TOUCH.ROTATE,
  TWO: THREE.TOUCH.DOLLY_PAN,
};

scene.add(new THREE.AmbientLight(0xd2e4ff, 0.62));

const sun = new THREE.DirectionalLight(0xfff5e0, 1.12);
sun.position.set(8, 14, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(
  IS_COARSE_POINTER ? 1024 : 2048,
  IS_COARSE_POINTER ? 1024 : 2048
);
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

const floorPad = 0.28;
const floorGeo = new THREE.PlaneGeometry(GRID * CELL + floorPad, GRID * CELL + floorPad);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x24384d,
  roughness: 0.9,
  metalness: 0.04,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
floor.position.set(ORIGIN.x, 0, ORIGIN.z);
floor.receiveShadow = true;
scene.add(floor);

const gridHelper = new THREE.GridHelper(
  GRID * CELL + 0.02,
  GRID,
  0x7aa6cf,
  0x49688f
);
gridHelper.position.set(ORIGIN.x, 0.002, ORIGIN.z);
scene.add(gridHelper);

const boxGeo = new THREE.BoxGeometry(CELL * 0.92, CELL * 0.92, CELL * 0.92);
const edgeGeo = new THREE.EdgesGeometry(boxGeo);
const OUTLINE_COLOR = 0x4a3020;
/**
 * 透视：仅「靠外一排」虚化（主箱体 colorWrite=false；线框 + 淡色壳 depthTest=false）；
 * 后排保持实体与阴影。正面看 gz 最大一排，侧面看 gx 最大一排；换视角会重算。
 */
const XRAY_LINE_OPACITY = 0.82;
const XRAY_LINE_COLOR = 0xf5ecd8;
/** 透视外壳：略大于实体；不写深度、不测深度，与主箱同色索引 */
const XRAY_SHELL_OPACITY = 0.15;
const XRAY_SHELL_SCALE = 1.012;
/** 地面格一色（gx+gz*GRID 在 4×4 上 0…15 各占一种），同摞同色便于辨认 */
const CRATE_PALETTE_HEX = [
  0xf07856, 0xf0a030, 0xe8c038, 0xb8c848, 0x70c070, 0x50b898, 0x48b0d0, 0x5890e8,
  0x7878e8, 0xa868d8, 0xd060a0, 0xe86878, 0xd89860, 0x90b070, 0x68a0c8, 0xb89890,
];

/** @type {{ side: THREE.CanvasTexture; top: THREE.CanvasTexture }[]} */
const crateTextureCache = [];

function hexToRgb(hex) {
  const h = hex >>> 0;
  return { r: (h >> 16) & 255, g: (h >> 8) & 255, b: h & 255 };
}

function makeCanvasTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  if ("colorSpace" in tex && THREE.SRGBColorSpace) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  return tex;
}

/** 侧面：木板条 + 钉眼 + 淡果色水漆感 */
function buildCrateSideTexture(accentHex) {
  const w = 160;
  const h = 160;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const { r: ar, g: ag, b: ab } = hexToRgb(accentHex);

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, "#e8d4b8");
  bg.addColorStop(0.45, "#d2bc98");
  bg.addColorStop(1, "#c4a882");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  for (let y = 6; y < h - 4; y += 20) {
    ctx.fillStyle = "rgba(75, 52, 32, 0.38)";
    ctx.fillRect(0, y, w, 3);
    ctx.fillStyle = "rgba(140, 110, 72, 0.2)";
    ctx.fillRect(0, y + 3, w, 17);
  }

  ctx.fillStyle = "rgba(55, 38, 22, 0.28)";
  ctx.fillRect(0, 0, 5, h);
  ctx.fillRect(w - 5, 0, 5, h);

  ctx.fillStyle = `rgba(${ar},${ag},${ab},0.14)`;
  ctx.fillRect(18, 52, w - 36, 48);

  for (let i = 0; i < 18; i += 1) {
    const px = 10 + (i % 6) * 26;
    const py = 12 + Math.floor(i / 6) * 48;
    ctx.fillStyle = "rgba(40, 28, 18, 0.35)";
    ctx.beginPath();
    ctx.arc(px, py, 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  return makeCanvasTexture(canvas);
}

/** 顶面：木板封条 + 中间「果区」色块，像装水果木箱 */
function buildCrateTopTexture(accentHex) {
  const w = 160;
  const h = 160;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  const { r, g, b } = hexToRgb(accentHex);

  ctx.fillStyle = "#d8c4a4";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = "rgba(90, 62, 38, 0.45)";
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i += 1) {
    const o = 8 + i * 34;
    ctx.strokeRect(o, o, w - o * 2, h - o * 2);
  }

  ctx.fillStyle = `rgb(${Math.min(255, r + 35)},${Math.min(255, g + 28)},${Math.min(255, b + 22)})`;
  const cx = w / 2;
  const cy = h / 2;
  const rw = w * 0.38;
  const rh = h * 0.32;
  const x0 = cx - rw / 2;
  const y0 = cy - rh / 2;
  ctx.beginPath();
  if (typeof ctx.roundRect === "function") {
    ctx.roundRect(x0, y0, rw, rh, 10);
  } else {
    ctx.rect(x0, y0, rw, rh);
  }
  ctx.fill();

  ctx.strokeStyle = "rgba(60, 42, 26, 0.5)";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.strokeStyle = "rgba(70, 48, 30, 0.35)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(12, h / 2);
  ctx.lineTo(w - 12, h / 2);
  ctx.stroke();

  return makeCanvasTexture(canvas);
}

function cratePaletteIndex(gx, gz) {
  return gx + gz * GRID;
}

function getCrateTexturePair(paletteIndex) {
  const idx = paletteIndex % CRATE_PALETTE_HEX.length;
  if (!crateTextureCache[idx]) {
    const hex = CRATE_PALETTE_HEX[idx];
    crateTextureCache[idx] = {
      side: buildCrateSideTexture(hex),
      top: buildCrateTopTexture(hex),
    };
  }
  return crateTextureCache[idx];
}

/** 六面木箱材质（纹理共享，材质每箱 clone，便于透视与 dispose） */
function createFruitCrateMaterials(gx, gy, gz) {
  const paletteIndex = cratePaletteIndex(gx, gz);
  const { side: sideMap, top: topMap } = getCrateTexturePair(paletteIndex);

  const wood = new THREE.MeshStandardMaterial({
    map: sideMap,
    roughness: 0.88,
    metalness: 0.04,
    envMapIntensity: 0.35,
  });
  const topM = new THREE.MeshStandardMaterial({
    map: topMap,
    roughness: 0.8,
    metalness: 0.03,
    envMapIntensity: 0.4,
  });
  const bottomM = new THREE.MeshStandardMaterial({
    map: sideMap,
    roughness: 0.94,
    metalness: 0.02,
    color: new THREE.Color(0x9c8a78),
  });

  const mats = [wood, wood, topM, bottomM, wood, wood];
  return mats.map((m) => m.clone());
}

/** 透视时可见：与同格木箱主色略混木底，极淡不挡后面 */
function createXrayTintShellMaterial(paletteIndex) {
  const hex = CRATE_PALETTE_HEX[paletteIndex % CRATE_PALETTE_HEX.length];
  const c = new THREE.Color(hex);
  c.lerp(new THREE.Color(0xc4a882), 0.42);
  return new THREE.MeshBasicMaterial({
    color: c,
    transparent: true,
    opacity: XRAY_SHELL_OPACITY,
    depthWrite: false,
    depthTest: true,
    fog: true,
  });
}
const DIAGRAM_FILLS = [
  "#ffb088",
  "#ffe566",
  "#7ee0b0",
  "#ff9ec8",
  "#8fd4ff",
  "#e4b8ff",
];

/** 数箱子模式：已点箱体的高对比标记色（仅改 MeshStandardMaterial.color） */
const COUNT_MODE_TINT = new THREE.Color(0x22c55e);
const COUNT_MODE_COLOR_MIX = 0.88;

const cubes = new Map();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const planeFloor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const worldNormal = new THREE.Vector3();
let dragStart = null;

function setStageStatus(message = "", tone = "info") {
  if (!stageStatus) return;
  stageStatus.hidden = !message;
  stageStatus.dataset.tone = tone;
  stageStatus.textContent = message;
}

function clearFeedbackTimer() {
  if (state.feedbackTimer) {
    window.clearTimeout(state.feedbackTimer);
    state.feedbackTimer = 0;
  }
}

function setFeedbackText(text, tone) {
  if (!feedbackEl) return;
  feedbackEl.textContent = text;
  feedbackEl.dataset.tone = tone;
}

function getDefaultFeedbackTone() {
  if (state.countingMode) return "info";
  if (isDiagramSheetKey(state.currentKey)) return "info";
  return state.mode === "place" ? "place" : "remove";
}

function getDefaultFeedback() {
  if (state.contextLost) {
    return "3D 画面恢复中，请稍等。";
  }
  if (state.countingMode) {
    return "数箱子模式：轻点每只箱子，变色表示你已经数过；不能再放新箱。";
  }
  if (isDiagramSheetKey(state.currentKey)) {
    return "当前为图纸情境：可转动视角观摩，不能放箱或拿箱。需要搭建时请点「清空·自由堆」等任务。";
  }
  return state.mode === "place"
    ? "轻点空位置或箱子顶面，放上一个新箱子。"
    : "轻点最上面的箱子，把它拿下来。";
}

function restoreDefaultFeedback() {
  clearFeedbackTimer();
  setFeedbackText(getDefaultFeedback(), getDefaultFeedbackTone());
}

function showFeedback(text, tone = "info", duration = 2200) {
  setFeedbackText(text, tone);
  clearFeedbackTimer();
  let hideAfter = duration;
  if (duration > 0 && (tone === "warn" || tone === "error")) {
    hideAfter = Math.max(duration, FEEDBACK_WARN_ERROR_HIDE_MS);
  }
  if (hideAfter > 0) {
    state.feedbackTimer = window.setTimeout(() => {
      if (!state.contextLost) {
        restoreDefaultFeedback();
      }
    }, hideAfter);
  }
}

function clearResetConfirm() {
  state.resetConfirmUntil = 0;
  if (state.resetTimer) {
    window.clearTimeout(state.resetTimer);
    state.resetTimer = 0;
  }
}

function setControlsDisabled(disabled) {
  interactiveButtons.forEach((button) => {
    button.disabled = disabled;
  });
  if (btnExitStageFullscreen) {
    btnExitStageFullscreen.disabled = false;
  }
  syncUndoButton();
}

function setToolSheetOpen(open) {
  if (open && !state.teacherMode) {
    return;
  }
  state.toolSheetOpen = open;
  if (toolSheet) {
    toolSheet.hidden = !open;
  }
  if (btnTools) {
    btnTools.setAttribute("aria-expanded", open ? "true" : "false");
    const label = open ? "收起研究工具" : "研究工具";
    btnTools.setAttribute("aria-label", label);
    btnTools.title = label;
  }
}

function maybeCloseToolSheet() {
  if (IS_COARSE_POINTER) {
    setToolSheetOpen(false);
  }
}

function isCompactTopPanelViewport() {
  return window.innerWidth <= TOP_PANEL_TOUCH_AUTO_COLLAPSE_MAX_W;
}

function syncTopPanelVisibility() {
  const nextCollapsed = state.topPanelCollapsed;
  topPanel?.classList.toggle("top-panel--collapsed", nextCollapsed);
  if (topPanel) {
    topPanel.hidden = nextCollapsed;
  }
  if (topPanelDetails) {
    topPanelDetails.hidden = nextCollapsed;
  }
  if (btnTopPanelToggle) {
    const expanded = !nextCollapsed;
    btnTopPanelToggle.hidden = nextCollapsed;
    btnTopPanelToggle.setAttribute("aria-expanded", expanded ? "true" : "false");
    if (topPanelToggleLabelEl) {
      topPanelToggleLabelEl.textContent = "收起";
    }
    btnTopPanelToggle.title = expanded
      ? "收起左上角说明与步骤"
      : "展开左上角说明与步骤";
    btnTopPanelToggle.setAttribute(
      "aria-label",
      expanded ? "收起左上角说明与步骤" : "展开左上角说明与步骤"
    );
  }
  if (btnTopPanelSummary) {
    btnTopPanelSummary.hidden = !nextCollapsed;
    btnTopPanelSummary.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
  }
}

function setTopPanelCollapsed(collapsed) {
  state.topPanelCollapsed = collapsed;
  syncTopPanelVisibility();
}

function maybeCollapseTopPanel() {
  if (IS_COARSE_POINTER && isCompactTopPanelViewport() && !state.teacherMode) {
    setTopPanelCollapsed(true);
  }
}

function syncTopPanelForViewport() {
  syncTopPanelVisibility();
}

function getCurrentPreset() {
  return PRESETS[state.currentKey];
}

function getResearchPhases(key = state.currentKey) {
  return PRESETS[key]?.phases || [];
}

function syncTeacherModeUI() {
  appEl?.classList.toggle("app--teacher-mode", state.teacherMode);
  if (btnTeacherMode) {
    btnTeacherMode.setAttribute("aria-pressed", state.teacherMode ? "true" : "false");
    btnTeacherMode.textContent = state.teacherMode ? "返回幼儿模式" : "教师模式";
  }
  if (btnTools) {
    btnTools.hidden = !state.teacherMode;
  }
  if (btnPhaseNext) {
    btnPhaseNext.hidden = !state.teacherMode;
  }
  if (!state.teacherMode) {
    setToolSheetOpen(false);
  }
}

function renderResearchPanel() {
  const phases = getResearchPhases();
  const phaseCount = phases.length || 1;
  const safeIndex = Math.max(0, Math.min(state.researchPhase, phaseCount - 1));
  const current = phases[safeIndex] || { label: "研究中", prompt: getCurrentPreset()?.task || "" };

  if (researchPhaseBadgeEl) {
    researchPhaseBadgeEl.textContent = `第 ${safeIndex + 1} 步 · ${current.label}`;
  }
  if (researchTaskEl) {
    researchTaskEl.textContent = current.prompt || getCurrentPreset()?.task || "";
  }
  if (topPanelSummaryBadgeEl) {
    topPanelSummaryBadgeEl.textContent = `第 ${safeIndex + 1} 步`;
  }
  if (topPanelSummaryTextEl) {
    topPanelSummaryTextEl.textContent = `${current.label} · 点按展开`;
  }
  if (researchStepsEl) {
    researchStepsEl.innerHTML = phases
      .map((phase, index) => {
        const cls =
          index === safeIndex ? "research-step is-active" : index < safeIndex ? "research-step is-done" : "research-step";
        return `<span class="${cls}">${index + 1}. ${phase.label}</span>`;
      })
      .join("");
  }
}

function setResearchPhase(nextIndex, { announce = false } = {}) {
  const phases = getResearchPhases();
  const maxIndex = Math.max(0, phases.length - 1);
  const safeIndex = Math.max(0, Math.min(nextIndex, maxIndex));
  state.researchPhase = safeIndex;
  renderResearchPanel();
  if (announce) {
    const current = phases[safeIndex];
    if (current?.prompt) {
      showFeedback(current.prompt, "info", 2200);
    }
  }
}

function advanceResearchPhase() {
  const phases = getResearchPhases();
  if (!phases.length) return;
  const next = Math.min(state.researchPhase + 1, phases.length - 1);
  setResearchPhase(next, { announce: true });
  if (next === phases.length - 1) {
    setToolSheetOpen(false);
  }
}

function syncResearchPhaseFromAction(action) {
  const phases = getResearchPhases();
  if (!phases.length) return;

  if (action === "interact" && state.researchPhase < Math.min(2, phases.length - 1)) {
    setResearchPhase(Math.min(2, phases.length - 1));
  }

  const target = getCurrentPreset()?.target;
  if (target != null && cubes.size === target) {
    setResearchPhase(phases.length - 1);
  }
}

function setTeacherMode(enabled, { announce = true } = {}) {
  if (enabled && state.countingMode) {
    state.countingMode = false;
    clearAllCountedMarks();
    if (!state.contextLost) {
      restoreDefaultFeedback();
    }
  }
  state.teacherMode = enabled;
  syncTeacherModeUI();
  if (enabled) {
    setToolSheetOpen(true);
  } else {
    maybeCollapseTopPanel();
  }
  syncTopPanelVisibility();
  syncCountingModeUI();
  if (announce) {
    showFeedback(
      enabled
        ? "教师模式已开启，可切换任务、视角和研究步骤；也可点「收起」腾出画面。"
        : "已回到幼儿模式，只保留核心操作。",
      enabled ? "success" : "info",
      2200
    );
  }
}

function setCameraButtonActive(nextCamera) {
  state.activeCamera = nextCamera;
  const cameraButtons = {
    front: btnFront,
    side: btnSide,
    freecam: btnFreecam,
  };
  Object.entries(cameraButtons).forEach(([key, button]) => {
    if (!button) return;
    const active = key === nextCamera;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateSceneButtons() {
  sceneButtons.forEach((button) => {
    const active = button.getAttribute("data-scene") === state.currentKey;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", active ? "true" : "false");
  });
}

function updateModeUI() {
  const sheetReadonly = isDiagramSheetKey(state.currentKey);
  const blocked = state.contextLost || state.countingMode || sheetReadonly;
  if (btnPlace) {
    btnPlace.disabled = blocked;
    if (state.countingMode || sheetReadonly) {
      btnPlace.setAttribute("aria-pressed", "false");
    } else {
      btnPlace.setAttribute("aria-pressed", state.mode === "place" ? "true" : "false");
    }
  }
  if (btnRemove) {
    btnRemove.disabled = blocked;
    if (state.countingMode || sheetReadonly) {
      btnRemove.setAttribute("aria-pressed", "false");
    } else {
      btnRemove.setAttribute("aria-pressed", state.mode === "place" ? "false" : "true");
    }
  }
}

function setMode(nextMode, { announce = true } = {}) {
  state.mode = nextMode;
  updateModeUI();
  clearResetConfirm();
  if (announce) {
    showFeedback(
      nextMode === "place"
        ? "现在是放箱子模式，轻点空位置或箱子顶面。"
        : "现在是拿箱子模式，轻点最上面的箱子。",
      nextMode === "place" ? "place" : "remove"
    );
  } else if (!state.contextLost) {
    restoreDefaultFeedback();
  }
}

/** 透视虚化：仅「离当前相机最近的一排」木箱（正面看大 gz；侧面看大 gx），后排保持实体色 */
function isXrayGhostRow(gx, gz) {
  if (state.activeCamera === "side") {
    return gx === GRID - 1;
  }
  return gz === GRID - 1;
}

function applyXrayToGroup(group, xrayOn) {
  const { gx, gz } = group.userData;
  const ghost = !!xrayOn && isXrayGhostRow(gx, gz);

  const applyMat = (material) => {
    if (ghost) {
      if (!material.userData.xraySaved) {
        material.userData.xraySaved = {
          transparent: material.transparent,
          opacity: material.opacity,
          depthWrite: material.depthWrite,
          colorWrite: material.colorWrite,
        };
        if (material.isMeshStandardMaterial) {
          material.userData.xraySaved.emissive = material.emissive.clone();
          material.userData.xraySaved.emissiveIntensity = material.emissiveIntensity;
        }
      }
      material.transparent = false;
      material.opacity = 1;
      material.depthWrite = false;
      material.colorWrite = false;
      if (material.isMeshStandardMaterial) {
        material.emissive.setHex(0);
        material.emissiveIntensity = 0;
      }
    } else if (material.userData.xraySaved) {
      const saved = material.userData.xraySaved;
      material.transparent = saved.transparent;
      material.opacity = saved.opacity;
      material.depthWrite = saved.depthWrite;
      material.colorWrite = saved.colorWrite;
      if (material.isMeshStandardMaterial && saved.emissive) {
        material.emissive.copy(saved.emissive);
        material.emissiveIntensity = saved.emissiveIntensity;
      }
    }
  };
  group.traverse((object) => {
    if (object.name === "crateXrayShell" && object.isMesh && object.material) {
      const sm = object.material;
      object.visible = ghost;
      if (ghost) {
        if (!sm.userData.xrayShellSaved) {
          sm.userData.xrayShellSaved = { depthTest: sm.depthTest };
        }
        sm.depthTest = false;
      } else if (sm.userData.xrayShellSaved) {
        sm.depthTest = sm.userData.xrayShellSaved.depthTest;
      }
      return;
    }
    if (object.isLineSegments && object.material) {
      const m = object.material;
      if (ghost) {
        if (!m.userData.xrayLineSaved) {
          m.userData.xrayLineSaved = {
            transparent: m.transparent,
            opacity: m.opacity,
            color: m.color.clone(),
            depthWrite: m.depthWrite,
            depthTest: m.depthTest,
            polygonOffset: m.polygonOffset,
            polygonOffsetFactor: m.polygonOffsetFactor,
            polygonOffsetUnits: m.polygonOffsetUnits,
          };
        }
        m.transparent = true;
        m.depthWrite = false;
        m.depthTest = false;
        m.opacity = XRAY_LINE_OPACITY;
        m.color.setHex(XRAY_LINE_COLOR);
        m.polygonOffset = true;
        m.polygonOffsetFactor = -1;
        m.polygonOffsetUnits = -1;
        object.renderOrder = 1;
      } else if (m.userData.xrayLineSaved) {
        const s = m.userData.xrayLineSaved;
        m.transparent = s.transparent;
        m.opacity = s.opacity;
        m.color.copy(s.color);
        m.depthWrite = s.depthWrite;
        m.depthTest = s.depthTest;
        m.polygonOffset = s.polygonOffset;
        m.polygonOffsetFactor = s.polygonOffsetFactor;
        m.polygonOffsetUnits = s.polygonOffsetUnits;
        object.renderOrder = 0;
      } else {
        m.transparent = true;
        m.opacity = 0.92;
        m.color.setHex(OUTLINE_COLOR);
        m.depthWrite = true;
        m.depthTest = true;
        m.polygonOffset = false;
        m.polygonOffsetFactor = 0;
        m.polygonOffsetUnits = 0;
        object.renderOrder = 0;
      }
      return;
    }
    if (!object.isMesh || !object.material) return;
    if (object.name === "cratePick") {
      if (ghost) {
        if (!object.userData.xrayShadowSaved) {
          object.userData.xrayShadowSaved = {
            castShadow: object.castShadow,
            receiveShadow: object.receiveShadow,
          };
        }
        object.castShadow = false;
        object.receiveShadow = false;
      } else if (object.userData.xrayShadowSaved) {
        const sh = object.userData.xrayShadowSaved;
        object.castShadow = sh.castShadow;
        object.receiveShadow = sh.receiveShadow;
      }
    }
    if (Array.isArray(object.material)) {
      object.material.forEach(applyMat);
    } else {
      applyMat(object.material);
    }
  });
}

function setXray(enabled, { announce = true } = {}) {
  state.xray = enabled;
  if (btnXray) {
    btnXray.setAttribute("aria-pressed", enabled ? "true" : "false");
    btnXray.textContent = enabled ? "关闭透视" : "打开透视";
  }
  cubes.forEach((group) => applyXrayToGroup(group, enabled));
  if (announce) {
    showFeedback(
      enabled
        ? "透视已打开：只虚化靠外一排，后排仍实体色；每格木箱颜色不同便于辨认。"
        : "透视已关闭，恢复普通观察。",
      enabled ? "success" : "info"
    );
    if (enabled) {
      syncResearchPhaseFromAction("interact");
    }
  }
}

function syncUndoButton() {
  if (!btnUndo) return;
  btnUndo.disabled = state.contextLost || state.historyStack.length === 0;
}

function keyOf(gx, gy, gz) {
  return `${gx},${gy},${gz}`;
}

function heightAt(gx, gz) {
  let height = 0;
  for (let y = 0; y < MAX_H; y += 1) {
    if (cubes.has(keyOf(gx, y, gz))) {
      height = y + 1;
    }
  }
  return height;
}

function worldPos(gx, gy, gz) {
  return new THREE.Vector3(gx * CELL, 0.5 * CELL + gy * CELL, gz * CELL);
}

function buildHintText(key) {
  return `${PRESETS[key].label}。${DEFAULT_HINT}`;
}

function updateCountUI() {
  const count = cubes.size;
  if (elCount) {
    elCount.textContent = String(count);
  }

  if (!elTarget) return;

  const target = PRESETS[state.currentKey]?.target;
  if (target == null) {
    elTarget.textContent = count === 0 ? "自由搭建" : `自由搭建 · 已放 ${count} 箱`;
    return;
  }

  if (count === target) {
    elTarget.textContent = `目标 ${target} 箱 · 已完成`;
    return;
  }

  if (count < target) {
    elTarget.textContent = `目标 ${target} 箱 · 还差 ${target - count}`;
    return;
  }

  elTarget.textContent = `目标 ${target} 箱 · 多出 ${count - target}`;
}

function getCubeCells() {
  return [...cubes.values()]
    .map((group) => [group.userData.gx, group.userData.gy, group.userData.gz])
    .sort((left, right) => left[0] - right[0] || left[2] - right[2] || left[1] - right[1]);
}

function captureState() {
  return {
    key: state.currentKey,
    mode: state.mode,
    xray: state.xray,
    phase: state.researchPhase,
    cells: getCubeCells(),
  };
}

function stateSignature(snapshot) {
  return JSON.stringify(snapshot);
}

function pushHistory(snapshot) {
  const nextSignature = stateSignature(snapshot);
  const previous = state.historyStack[state.historyStack.length - 1];
  if (previous && stateSignature(previous) === nextSignature) {
    syncUndoButton();
    return;
  }
  state.historyStack.push(snapshot);
  if (state.historyStack.length > MAX_HISTORY_ENTRIES) {
    state.historyStack.shift();
  }
  syncUndoButton();
}

function canAddCube(gx, gy, gz) {
  if (gy >= MAX_H) {
    return { ok: false, error: `最高只能叠到 ${MAX_H} 层。` };
  }
  if (cubes.has(keyOf(gx, gy, gz))) {
    return { ok: false, error: "这里已经有箱子了。" };
  }
  if (gy > 0 && !cubes.has(keyOf(gx, gy - 1, gz))) {
    return { ok: false, error: "要先把下面垫稳，才能往上放。" };
  }
  return { ok: true };
}

function addCube(gx, gy, gz) {
  const check = canAddCube(gx, gy, gz);
  if (!check.ok) {
    return check;
  }

  const key = keyOf(gx, gy, gz);
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(boxGeo, createFruitCrateMaterials(gx, gy, gz));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "cratePick";
  group.add(mesh);

  const shell = new THREE.Mesh(boxGeo, createXrayTintShellMaterial(cratePaletteIndex(gx, gz)));
  shell.name = "crateXrayShell";
  shell.scale.setScalar(XRAY_SHELL_SCALE);
  shell.visible = false;
  shell.castShadow = false;
  shell.receiveShadow = false;
  shell.renderOrder = -1;
  shell.raycast = () => {};
  group.add(shell);

  const edges = new THREE.LineSegments(
    edgeGeo,
    new THREE.LineBasicMaterial({
      color: OUTLINE_COLOR,
      transparent: true,
      opacity: 0.92,
    })
  );
  group.add(edges);

  group.position.copy(worldPos(gx, gy, gz));
  group.userData = { gx, gy, gz, key, pickMesh: mesh, counted: false };
  scene.add(group);
  cubes.set(key, group);
  applyXrayToGroup(group, state.xray);
  updateCountUI();
  return { ok: true, key };
}

function canRemoveCube(gx, gy, gz) {
  const key = keyOf(gx, gy, gz);
  if (!cubes.has(key)) {
    return { ok: false, error: "这里没有箱子可以拿。" };
  }
  for (let y = gy + 1; y < MAX_H; y += 1) {
    if (cubes.has(keyOf(gx, y, gz))) {
      return { ok: false, error: "要先拿最上面的箱子。" };
    }
  }
  return { ok: true };
}

function removeCube(gx, gy, gz) {
  const check = canRemoveCube(gx, gy, gz);
  if (!check.ok) {
    return check;
  }

  const key = keyOf(gx, gy, gz);
  const group = cubes.get(key);
  if (!group) {
    return { ok: false, error: "这里没有箱子可以拿。" };
  }

  scene.remove(group);
  cubes.delete(key);
  group.traverse((object) => {
    if (object.geometry && object.geometry !== boxGeo && object.geometry !== edgeGeo) {
      object.geometry.dispose?.();
    }
    if (!object.material) return;
    if (Array.isArray(object.material)) {
      object.material.forEach((material) => material.dispose?.());
    } else {
      object.material.dispose?.();
    }
  });
  updateCountUI();
  return { ok: true, key };
}

function clearAll() {
  clearAllCountedMarks();
  const sorted = [...cubes.keys()]
    .map((key) => key.split(",").map(Number))
    .sort((left, right) => right[1] - left[1]);

  sorted.forEach(([gx, gy, gz]) => {
    removeCube(gx, gy, gz);
  });
}

function getPlaceSuccessText() {
  const target = PRESETS[state.currentKey]?.target;
  if (target == null) {
    return "放好一个箱子。";
  }
  if (cubes.size === target) {
    return "正好达到目标箱数。";
  }
  if (cubes.size < target) {
    return `放好一个箱子，还差 ${target - cubes.size} 箱。`;
  }
  return `放好一个箱子，现在多出 ${cubes.size - target} 箱。`;
}

function getRemoveSuccessText() {
  const target = PRESETS[state.currentKey]?.target;
  if (target == null) {
    return "拿走一个箱子。";
  }
  if (cubes.size === target) {
    return "拿走之后，正好回到目标箱数。";
  }
  if (cubes.size < target) {
    return `拿走一个箱子，还差 ${target - cubes.size} 箱。`;
  }
  return `拿走一个箱子，现在还多出 ${cubes.size - target} 箱。`;
}

function placeCubeWithHistory(gx, gy, gz) {
  if (state.countingMode) {
    showFeedback("数箱子模式下不能再放新箱，请先退出数箱子。", "warn", 2200);
    return false;
  }
  if (isDiagramSheetKey(state.currentKey)) {
    showFeedback("图纸情境下不能放箱，请先切换到「清空·自由堆」等任务。", "warn", 2200);
    return false;
  }
  const snapshot = captureState();
  const result = addCube(gx, gy, gz);
  if (!result.ok) {
    showFeedback(result.error || "这里不能放箱子。", "warn");
    return false;
  }
  pushHistory(snapshot);
  syncResearchPhaseFromAction("interact");
  maybeCollapseTopPanel();
  clearResetConfirm();
  showFeedback(getPlaceSuccessText(), "success", 1500);
  return true;
}

function removeCubeWithHistory(gx, gy, gz) {
  if (state.countingMode) {
    showFeedback("数箱子模式下不能拿走箱子，请先退出数箱子。", "warn", 2200);
    return false;
  }
  if (isDiagramSheetKey(state.currentKey)) {
    showFeedback("图纸情境下不能拿箱，请先切换到「清空·自由堆」等任务。", "warn", 2200);
    return false;
  }
  const snapshot = captureState();
  const result = removeCube(gx, gy, gz);
  if (!result.ok) {
    showFeedback(result.error || "这里不能拿箱子。", "warn");
    return false;
  }
  pushHistory(snapshot);
  syncResearchPhaseFromAction("interact");
  maybeCollapseTopPanel();
  clearResetConfirm();
  showFeedback(getRemoveSuccessText(), "success", 1500);
  return true;
}

function columnHeightsFromCells(cells) {
  const maxGy = new Map();
  cells.forEach(([gx, gy, gz]) => {
    const key = `${gx},${gz}`;
    maxGy.set(key, Math.max(maxGy.get(key) ?? -1, gy));
  });
  const heights = new Map();
  maxGy.forEach((value, key) => {
    heights.set(key, value + 1);
  });
  return heights;
}

function buildSheetDiagramSvg(cells) {
  if (!cells.length) return "";

  const heights = columnHeightsFromCells(cells);
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;

  cells.forEach(([gx, _gy, gz]) => {
    minX = Math.min(minX, gx);
    maxX = Math.max(maxX, gx);
    minZ = Math.min(minZ, gz);
    maxZ = Math.max(maxZ, gz);
  });

  const nx = maxX - minX + 1;
  const nz = maxZ - minZ + 1;
  const cell = 30;
  const gap = 4;
  const marginLeft = 22;
  const marginTop = 18;
  const marginBottom = 16;
  const marginRight = 8;
  const width = marginLeft + nz * (cell + gap) + marginRight;
  const height = marginTop + nx * (cell + gap) + marginBottom;

  const parts = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" class="sheet-svg" role="img" aria-label="搭建俯视图示意图">`,
    '<defs><filter id="sd" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="1" stdDeviation="1" flood-opacity="0.35"/></filter></defs>',
    `<text x="${marginLeft}" y="12" font-size="9" fill="#7a9ab8" font-weight="600">后</text>`,
    `<text x="${width - marginRight - 2}" y="12" font-size="9" fill="#7a9ab8" font-weight="600" text-anchor="end">前</text>`,
  ];

  for (let xi = 0; xi < nx; xi += 1) {
    const gx = minX + xi;
    const labelY = marginTop + xi * (cell + gap) + cell / 2 + 4;
    parts.push(
      `<text x="3" y="${labelY}" font-size="10" fill="#8fa8c0" font-weight="700">${gx + 1}</text>`
    );
  }

  for (let zi = 0; zi < nz; zi += 1) {
    const gz = maxZ - zi;
    for (let xi = 0; xi < nx; xi += 1) {
      const gx = minX + xi;
      const key = `${gx},${gz}`;
      const stackHeight = heights.get(key) || 0;
      const x = marginLeft + zi * (cell + gap);
      const y = marginTop + xi * (cell + gap);
      const fillColor = DIAGRAM_FILLS[(gx + gz) % DIAGRAM_FILLS.length];

      if (stackHeight === 0) {
        parts.push(
          `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="7" fill="rgba(255,255,255,0.06)" stroke="rgba(255,255,255,0.28)" stroke-width="1.2" stroke-dasharray="3 3"/>`
        );
        continue;
      }

      parts.push(
        `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="8" fill="${fillColor}" stroke="#5c3d28" stroke-width="2" filter="url(#sd)"/>`
      );
      parts.push(
        `<text x="${x + cell / 2}" y="${y + cell / 2 + 5}" text-anchor="middle" font-size="13" font-weight="800" fill="#3d2818" font-family="system-ui,sans-serif">${stackHeight}</text>`
      );
    }
  }

  parts.push("</svg>");
  return parts.join("");
}

function isDiagramSheetKey(key) {
  return key === "sheet8" || key === "sheet9" || key === "sheet10" || key === "sheet11";
}

function syncSheetPanel(key) {
  const show = isDiagramSheetKey(key);
  overlayTop?.classList.toggle("overlay__top--diagram", show);
  if (!sheetPanel) return;
  if (!show) {
    sheetPanel.hidden = true;
    return;
  }

  const preset = PRESETS[key];
  sheetPanel.hidden = false;
  if (sheetPanelBadge) {
    sheetPanelBadge.textContent = preset.diagramBadge || "图纸";
  }
  if (sheetPanelCaption) {
    sheetPanelCaption.textContent = preset.diagramCaption || "";
  }
  if (sheetPanelDiagram) {
    sheetPanelDiagram.innerHTML = buildSheetDiagramSvg(preset.cells);
  }
}

function refreshSceneUI() {
  if (elHint) {
    elHint.textContent = buildHintText(state.currentKey);
  }
  renderResearchPanel();
  syncSheetPanel(state.currentKey);
  updateSceneButtons();
  updateCountUI();
  syncCountingModeUI();
}

/** 底部「清空」：撤掉所有箱子，不改变当前情境键（与工具栏「清空·自由堆」不同）。 */
function clearSceneBoxesWithHistory() {
  if (state.contextLost) return;
  setCountingMode(false, { announce: false });
  if (cubes.size === 0) {
    showFeedback("场地已经是空的。", "info", 1200);
    return;
  }
  const snapshot = captureState();
  clearAll();
  state.researchPhase = 0;
  setXray(false, { announce: false });
  setMode("place", { announce: false });
  refreshSceneUI();
  clearResetConfirm();
  pushHistory(snapshot);
  maybeCloseToolSheet();
  maybeCollapseTopPanel();
  showFeedback("已清空所有箱子。", "success", 1600);
}

function applyPresetState(key) {
  const preset = PRESETS[key];
  if (!preset) return false;

  setCountingMode(false, { announce: false });
  state.currentKey = key;
  state.researchPhase = 0;
  clearAll();
  preset.cells.forEach(([gx, gy, gz]) => {
    addCube(gx, gy, gz);
  });
  setXray(false, { announce: false });
  setMode("place", { announce: false });
  applyRecommendedView(key, { announce: false, animate: false });
  refreshSceneUI();
  clearResetConfirm();
  return true;
}

function restoreSnapshot(snapshot) {
  setCountingMode(false, { announce: false });
  state.currentKey = snapshot.key;
  state.researchPhase = snapshot.phase ?? 0;
  clearAll();
  snapshot.cells.forEach(([gx, gy, gz]) => {
    addCube(gx, gy, gz);
  });
  setXray(snapshot.xray, { announce: false });
  setMode(snapshot.mode, { announce: false });
  applyRecommendedView(snapshot.key, { announce: false, animate: false });
  refreshSceneUI();
  clearResetConfirm();
  syncUndoButton();
}

function loadPreset(key, feedbackText) {
  if (state.contextLost) return false;
  const snapshot = captureState();
  const applied = applyPresetState(key);
  if (!applied) return false;
  pushHistory(snapshot);
  maybeCloseToolSheet();
  maybeCollapseTopPanel();
  showFeedback(feedbackText || `已切换到${PRESETS[key].name}。`, "success", 1800);
  return true;
}

function undoLastStep() {
  if (state.contextLost) return;
  if (!state.historyStack.length) {
    showFeedback("已经没有可以撤回的步骤了。", "warn");
    return;
  }
  const snapshot = state.historyStack.pop();
  restoreSnapshot(snapshot);
  showFeedback("已撤回上一步。", "success", 1600);
}

function requestResetCurrent() {
  if (state.contextLost) return;

  const now = Date.now();
  if (state.resetConfirmUntil > now) {
    clearResetConfirm();
    loadPreset(state.currentKey, "已重置本关，回到开始位置。");
    return;
  }

  state.resetConfirmUntil = now + 2200;
  state.resetTimer = window.setTimeout(() => {
    clearResetConfirm();
    restoreDefaultFeedback();
  }, 2200);
  showFeedback("再按一次“重置本关”，就会回到当前情境开头。", "warn", 2200);
}

function pickMeshes() {
  const list = [];
  cubes.forEach((group) => {
    if (group.userData.pickMesh) {
      list.push(group.userData.pickMesh);
    }
  });
  return list;
}

function hitWorldNormal(hit) {
  return worldNormal.copy(hit.face.normal).transformDirection(hit.object.matrixWorld).normalize();
}

function clampGrid(value) {
  return Math.max(0, Math.min(GRID - 1, value));
}

function xzToColumn(px, pz) {
  return {
    gx: clampGrid(Math.round(px / CELL)),
    gz: clampGrid(Math.round(pz / CELL)),
  };
}

function clearAllCountedMarks() {
  cubes.forEach((group) => {
    group.userData.counted = false;
    group.traverse((obj) => {
      if (!obj.isMesh || !obj.material) return;
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => {
        if (m.isMeshStandardMaterial && m.userData.countBaseColor) {
          m.color.copy(m.userData.countBaseColor);
          delete m.userData.countBaseColor;
        }
      });
    });
  });
}

function applyCountedVisualToGroup(group) {
  group.traverse((obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    mats.forEach((m) => {
      if (!m.isMeshStandardMaterial || !m.color) return;
      if (!m.userData.countBaseColor) {
        m.userData.countBaseColor = m.color.clone();
      }
      m.color.copy(m.userData.countBaseColor).lerp(COUNT_MODE_TINT, COUNT_MODE_COLOR_MIX);
    });
  });
}

function countMarkedCubes() {
  let n = 0;
  cubes.forEach((g) => {
    if (g.userData.counted) n += 1;
  });
  return n;
}

function tryMarkCountedFromRay() {
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickMeshes(), false);
  if (!hits.length) {
    showFeedback("请点在箱子上。", "warn", 1600);
    return;
  }
  let root = hits[0].object;
  while (root.parent && root.userData.gx == null) {
    root = root.parent;
  }
  const data = root.userData;
  if (!data || data.gx == null) return;
  const group = cubes.get(keyOf(data.gx, data.gy, data.gz));
  if (!group) return;
  if (group.userData.counted) {
    showFeedback("这只箱子已经数过了。", "info", 1400);
    return;
  }
  group.userData.counted = true;
  applyCountedVisualToGroup(group);
  const marked = countMarkedCubes();
  const total = cubes.size;
  showFeedback(`已标记这一箱。已数标记 ${marked} / ${total} 箱。`, "success", 1800);
}

function setCountingMode(enabled, { announce = true } = {}) {
  if (enabled && state.teacherMode) return;
  if (state.countingMode === enabled) {
    syncCountingModeUI();
    return;
  }
  state.countingMode = enabled;
  if (!enabled) {
    clearAllCountedMarks();
  }
  syncCountingModeUI();
  clearResetConfirm();
  if (announce) {
    if (enabled) {
      showFeedback(
        "已进入数箱子模式：不能再放新箱。请幼儿依次轻点每一只箱子，变色表示已数过。",
        "info",
        3200
      );
    } else {
      showFeedback("已退出数箱子模式。", "success", 2000);
    }
  } else if (!state.contextLost) {
    restoreDefaultFeedback();
  }
}

function syncCountingModeUI() {
  if (btnCountMode) {
    btnCountMode.hidden = state.teacherMode;
    btnCountMode.setAttribute("aria-pressed", state.countingMode ? "true" : "false");
    btnCountMode.classList.toggle("is-active", state.countingMode);
    btnCountMode.title = state.countingMode ? "退出数箱子" : "数箱子";
    btnCountMode.setAttribute(
      "aria-label",
      state.countingMode
        ? "退出数箱子模式，恢复放箱与拿箱"
        : "数箱子：点箱变色表示已数过，不能再放新箱"
    );
  }
  updateModeUI();
}

function ndcFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

function tryPlaceFromRay() {
  if (state.countingMode || isDiagramSheetKey(state.currentKey)) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickMeshes(), false);

  if (hits.length) {
    const hit = hits[0];
    const normal = hitWorldNormal(hit);
    let root = hit.object;
    while (root.parent && root.userData.gx == null) {
      root = root.parent;
    }

    const data = root.userData;
    if (data && data.gx != null) {
      if (normal.y > 0.45) {
        placeCubeWithHistory(data.gx, data.gy + 1, data.gz);
      } else {
        const { gx, gz } = xzToColumn(hit.point.x, hit.point.z);
        placeCubeWithHistory(gx, heightAt(gx, gz), gz);
      }
      return;
    }
  }

  const point = new THREE.Vector3();
  if (raycaster.ray.intersectPlane(planeFloor, point)) {
    const { gx, gz } = xzToColumn(point.x, point.z);
    placeCubeWithHistory(gx, heightAt(gx, gz), gz);
    return;
  }

  showFeedback("请点在仓库地面里。", "warn");
}

function tryRemoveFromRay() {
  if (state.countingMode || isDiagramSheetKey(state.currentKey)) return;
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObjects(pickMeshes(), false);
  if (!hits.length) {
    showFeedback("请直接点箱子。", "warn");
    return;
  }

  let root = hits[0].object;
  while (root.parent && root.userData.gx == null) {
    root = root.parent;
  }
  const data = root.userData;
  if (data && data.gx != null) {
    removeCubeWithHistory(data.gx, data.gy, data.gz);
  }
}

function onPointerDown(event) {
  if (state.contextLost) return;
  if (event.button != null && event.button !== 0) return;
  state.cameraAnimationToken += 1;
  dragStart = { x: event.clientX, y: event.clientY };
}

function onPointerUp(event) {
  if (state.contextLost) return;
  if (event.button != null && event.button !== 0) return;
  if (!dragStart) return;

  const dx = event.clientX - dragStart.x;
  const dy = event.clientY - dragStart.y;
  dragStart = null;

  if (dx * dx + dy * dy > TAP_PX * TAP_PX) {
    setCameraButtonActive("freecam");
    return;
  }

  ndcFromEvent(event);
  if (state.countingMode) {
    tryMarkCountedFromRay();
    return;
  }
  if (isDiagramSheetKey(state.currentKey)) {
    return;
  }
  if (state.mode === "place") {
    tryPlaceFromRay();
  } else {
    tryRemoveFromRay();
  }
}

function animateCameraTo(position, target, duration = 520) {
  const token = ++state.cameraAnimationToken;
  const startPosition = camera.position.clone();
  const startTarget = controls.target.clone();
  const t0 = performance.now();

  function step(now) {
    if (token !== state.cameraAnimationToken) return;
    const u = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - u, 3);
    camera.position.lerpVectors(startPosition, position, eased);
    controls.target.lerpVectors(startTarget, target, eased);
    controls.update();
    if (u < 1) {
      window.requestAnimationFrame(step);
    }
  }

  window.requestAnimationFrame(step);
}

function applyCameraView(view, { announce = true, animate = true } = {}) {
  const target = ORIGIN.clone().add(new THREE.Vector3(0, 1.1, 0));
  const views = {
    front: {
      position: new THREE.Vector3(ORIGIN.x, 5.2, ORIGIN.z + 12.5),
      target,
      message: "已切到正面，方便观察前后遮挡。",
    },
    side: {
      position: new THREE.Vector3(ORIGIN.x + 12.5, 5.2, ORIGIN.z),
      target,
      message: "已切到侧面，方便比较高低。",
    },
    freecam: {
      position: DEFAULT_CAMERA_POSITION.clone(),
      target: DEFAULT_CAMERA_TARGET.clone(),
      message: "已回到自由观察。",
    },
  };
  const next = views[view] || views.freecam;
  setCameraButtonActive(view in views ? view : "freecam");
  if (animate) {
    animateCameraTo(next.position.clone(), next.target.clone());
  } else {
    camera.position.copy(next.position);
    controls.target.copy(next.target);
    controls.update();
  }
  if (state.xray) {
    cubes.forEach((g) => applyXrayToGroup(g, true));
  }
  if (announce) {
    showFeedback(next.message, "success", 1600);
  }
}

function applyRecommendedView(key, options = {}) {
  const preset = PRESETS[key];
  applyCameraView(preset?.recommendedView || "freecam", options);
}

function focusFrontView(options) {
  applyCameraView("front", options);
}

function focusSideView(options) {
  applyCameraView("side", options);
}

function focusFreeView(options) {
  applyCameraView("freecam", options);
}

function fullscreenElement() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

function isStageFullscreen() {
  const element = fullscreenElement();
  return element === stageWrap || state.stageImmersiveFallback === true;
}

function syncFullscreenButton() {
  if (!btnFullscreen) return;
  const active = isStageFullscreen();
  btnFullscreen.setAttribute("aria-pressed", active ? "true" : "false");
  btnFullscreen.textContent = active ? "退出全屏" : "堆箱全屏";
  if (btnExitStageFullscreen) {
    btnExitStageFullscreen.hidden = !active;
  }
}

function syncRendererSize() {
  if (!renderer) return;

  let width = window.innerWidth;
  let height = window.innerHeight;
  const fullElement = fullscreenElement();

  if ((fullElement === stageWrap || state.stageImmersiveFallback) && stageWrap) {
    width = stageWrap.clientWidth || width;
    height = stageWrap.clientHeight || height;
  }

  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
  renderer.setSize(width, height, false);
}

function leaveStageFullscreen() {
  if (state.stageImmersiveFallback && appEl) {
    appEl.classList.remove("app--immersive-stage");
    state.stageImmersiveFallback = false;
  } else if (fullscreenElement()) {
    if (document.exitFullscreen) {
      void document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    }
  }
  syncFullscreenButton();
  syncRendererSize();
}

async function enterStageFullscreen() {
  setToolSheetOpen(false);
  try {
    const request =
      stageWrap.requestFullscreen?.bind(stageWrap) ||
      stageWrap.webkitRequestFullscreen?.bind(stageWrap);
    if (!request) throw new Error("no element fullscreen");
    const result = request();
    if (result && typeof result.then === "function") {
      await result;
    }
    state.stageImmersiveFallback = false;
  } catch {
    if (appEl) {
      appEl.classList.add("app--immersive-stage");
      state.stageImmersiveFallback = true;
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

function renderFrame() {
  if (!state.renderLoopRunning || state.contextLost) return;
  state.renderLoopHandle = window.requestAnimationFrame(renderFrame);
  controls.update();
  renderer.render(scene, camera);
}

function startRenderLoop() {
  if (state.renderLoopRunning || state.contextLost) return;
  state.renderLoopRunning = true;
  renderFrame();
}

function stopRenderLoop() {
  state.renderLoopRunning = false;
  if (state.renderLoopHandle) {
    window.cancelAnimationFrame(state.renderLoopHandle);
    state.renderLoopHandle = 0;
  }
}

function handleContextLost(event) {
  event.preventDefault();
  state.contextLost = true;
  stopRenderLoop();
  setControlsDisabled(true);
  if (bootDiagnostic) {
    bootDiagnostic.mark("webgl", "error", "3D 上下文中断，页面正在尝试恢复。");
  }
  setStageStatus("3D 画面暂时断开，正在重新准备。", "warn");
  showFeedback("3D 画面暂时断开，正在重新准备。", "warn", 0);
}

function handleContextRestored() {
  setStageStatus("3D 画面恢复中，即将重新打开。", "success");
  showFeedback("3D 画面恢复中，即将重新打开。", "success", 0);
  window.setTimeout(() => {
    window.location.reload();
  }, 360);
}

canvas.addEventListener("pointerdown", onPointerDown);
canvas.addEventListener("pointerup", onPointerUp);
canvas.addEventListener("pointercancel", () => {
  dragStart = null;
});
canvas.addEventListener("webglcontextlost", handleContextLost, false);
canvas.addEventListener("webglcontextrestored", handleContextRestored, false);

document.addEventListener("pointerdown", (event) => {
  if (!state.toolSheetOpen || !toolSheet) return;
  const target = event.target;
  if (toolSheet.contains(target) || btnTools?.contains(target)) return;
  setToolSheetOpen(false);
});

sceneButtons.forEach((button) => {
  button.addEventListener("click", () => {
    const nextKey = button.getAttribute("data-scene");
    if (!nextKey || state.contextLost) return;
    loadPreset(nextKey, `已切换到${button.textContent.trim()}。`);
  });
});

btnUndo?.addEventListener("click", () => {
  undoLastStep();
});

btnClear?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  clearSceneBoxesWithHistory();
});

btnXray?.addEventListener("click", () => {
  if (state.contextLost) return;
  setXray(!state.xray);
  maybeCloseToolSheet();
});

btnPlace?.addEventListener("click", () => {
  if (state.contextLost || state.countingMode || isDiagramSheetKey(state.currentKey)) return;
  setMode("place");
});

btnRemove?.addEventListener("click", () => {
  if (state.contextLost || state.countingMode || isDiagramSheetKey(state.currentKey)) return;
  setMode("remove");
});

btnCountMode?.addEventListener("click", () => {
  if (state.contextLost || state.teacherMode) return;
  setCountingMode(!state.countingMode);
});

btnReset?.addEventListener("click", () => {
  requestResetCurrent();
  maybeCloseToolSheet();
});

btnFront?.addEventListener("click", () => {
  if (state.contextLost) return;
  focusFrontView();
  maybeCloseToolSheet();
});

btnSide?.addEventListener("click", () => {
  if (state.contextLost) return;
  focusSideView();
  maybeCloseToolSheet();
});

btnFreecam?.addEventListener("click", () => {
  if (state.contextLost) return;
  focusFreeView();
  maybeCloseToolSheet();
});

btnFullscreen?.addEventListener("click", () => {
  if (state.contextLost) return;
  void toggleStageFullscreen();
});

btnTools?.addEventListener("click", () => {
  if (state.contextLost) return;
  setToolSheetOpen(!state.toolSheetOpen);
});

btnCloseTools?.addEventListener("click", () => {
  setToolSheetOpen(false);
});

btnTeacherMode?.addEventListener("click", () => {
  if (state.contextLost) return;
  setTeacherMode(!state.teacherMode);
});

btnTopPanelToggle?.addEventListener("click", () => {
  if (state.contextLost) return;
  setTopPanelCollapsed(!state.topPanelCollapsed);
});

btnTopPanelSummary?.addEventListener("click", () => {
  if (state.contextLost) return;
  setTopPanelCollapsed(false);
});

btnPhaseNext?.addEventListener("click", () => {
  if (state.contextLost) return;
  advanceResearchPhase();
});

btnExitStageFullscreen?.addEventListener("click", () => {
  leaveStageFullscreen();
});

document.addEventListener("fullscreenchange", () => {
  if (!fullscreenElement()) {
    state.stageImmersiveFallback = false;
  }
  syncFullscreenButton();
  syncRendererSize();
});
document.addEventListener("webkitfullscreenchange", () => {
  if (!fullscreenElement()) {
    state.stageImmersiveFallback = false;
  }
  syncFullscreenButton();
  syncRendererSize();
});

window.addEventListener("resize", () => {
  syncRendererSize();
  syncTopPanelForViewport();
});
window.visualViewport?.addEventListener("resize", () => {
  syncRendererSize();
  syncTopPanelForViewport();
});
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    stopRenderLoop();
    return;
  }
  startRenderLoop();
});

setControlsDisabled(false);
syncCountingModeUI();
syncTeacherModeUI();
setToolSheetOpen(state.toolSheetOpen);
syncTopPanelForViewport();
setCameraButtonActive("freecam");
syncFullscreenButton();
syncRendererSize();
applyPresetState("intro");
state.historyStack.length = 0;
syncUndoButton();
showFeedback("已准备好 4 箱遮挡情境。", "success", 1800);
startRenderLoop();

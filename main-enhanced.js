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
const DEFAULT_HINT =
  "先选主操作，再轻点 3D 画面。单指拖动换方向，双指捏合能看得更清楚。";

const ORIGIN = new THREE.Vector3(
  ((GRID - 1) * CELL) / 2,
  0,
  ((GRID - 1) * CELL) / 2
);
const DEFAULT_CAMERA_TARGET = ORIGIN.clone().add(new THREE.Vector3(0, 1.1, 0));
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(6.6, 5.2, 8.5);

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
      [0, 0, 0],
      [1, 0, 0],
      [2, 0, 0],
      [1, 0, 1],
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
  sheet1: {
    name: "图纸一·6箱",
    label: "图纸一：6 箱平铺（无遮挡）",
    task: "研究任务：照着图纸搭 6 箱，看看每一格是不是都只有 1 层。",
    recommendedView: "freecam",
    phases: [
      { label: "先读图", prompt: "先读图：看看图纸里哪些格子要放箱子。" },
      { label: "先猜想", prompt: "先猜一猜：这张图纸里，每一格会叠几层？" },
      { label: "动手验证", prompt: "动手验证：照着图纸搭出来，看看是不是每格都只有 1 层。" },
      { label: "说说发现", prompt: "说说发现：这张图纸为什么没有遮挡，看起来更容易数？" },
    ],
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
    diagramCaption: "两排各 3 箱，每格都是 1 层高，共 6 箱。",
  },
  sheet2: {
    name: "图纸二·6箱",
    label: "图纸二：6 箱带遮挡，可用透视分层点数",
    task: "研究任务：根据图纸找出被挡住的箱子，需要时再打开透视。",
    recommendedView: "front",
    phases: [
      { label: "先读图", prompt: "先读图：先找一找，哪一格可能会叠到 2 层。" },
      { label: "先猜想", prompt: "先猜一猜：哪些箱子会被前面的箱子挡住？" },
      { label: "动手验证", prompt: "动手验证：搭出来以后换方向观察，需要时再打开透视。" },
      { label: "说说发现", prompt: "说说发现：这张图纸里，哪一箱最容易被忽略？" },
    ],
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
    diagramCaption: "中间靠前那一摞要叠 2 层；虚线格不放箱，共 6 箱。",
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
  topPanelCollapsed: IS_COARSE_POINTER && window.innerWidth <= 560,
  toolSheetOpen: false,
};

const scene = new THREE.Scene();
const SKY = 0x2b4e63;
scene.background = new THREE.Color(SKY);
scene.fog = new THREE.Fog(SKY, 14, 40);

const camera = new THREE.PerspectiveCamera(
  48,
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
controls.minDistance = 5.2;
controls.maxDistance = 18;
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

const floorGeo = new THREE.PlaneGeometry(GRID * CELL + 6, GRID * CELL + 6);
const floorMat = new THREE.MeshStandardMaterial({
  color: 0x24384d,
  roughness: 0.9,
  metalness: 0.04,
});
const floor = new THREE.Mesh(floorGeo, floorMat);
floor.rotation.x = -Math.PI / 2;
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
const OUTLINE_COLOR = 0x5c3d28;
const CARTOON_CRATE_HEX = [
  0xffb088,
  0xffe566,
  0x7ee0b0,
  0xff9ec8,
  0x8fd4ff,
  0xe4b8ff,
];
const DIAGRAM_FILLS = [
  "#ffb088",
  "#ffe566",
  "#7ee0b0",
  "#ff9ec8",
  "#8fd4ff",
  "#e4b8ff",
];

const cubes = new Map();
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const planeFloor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
const worldNormal = new THREE.Vector3();
let dragStart = null;

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
  return state.mode === "place" ? "place" : "remove";
}

function getDefaultFeedback() {
  if (state.contextLost) {
    return "3D 画面恢复中，请稍等。";
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
  if (duration > 0) {
    state.feedbackTimer = window.setTimeout(() => {
      if (!state.contextLost) {
        restoreDefaultFeedback();
      }
    }, duration);
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
  return window.innerWidth <= 560;
}

function syncTopPanelVisibility() {
  const nextCollapsed = state.teacherMode ? false : state.topPanelCollapsed;
  topPanel?.classList.toggle("top-panel--collapsed", nextCollapsed);
  if (topPanel) {
    topPanel.hidden = nextCollapsed;
  }
  if (topPanelDetails) {
    topPanelDetails.hidden = nextCollapsed;
  }
  if (btnTopPanelToggle) {
    const expanded = !nextCollapsed;
    btnTopPanelToggle.hidden = state.teacherMode || nextCollapsed;
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
    btnTopPanelSummary.hidden = state.teacherMode || !nextCollapsed;
    btnTopPanelSummary.setAttribute("aria-expanded", nextCollapsed ? "false" : "true");
  }
}

function setTopPanelCollapsed(collapsed) {
  if (!state.teacherMode) {
    state.topPanelCollapsed = collapsed;
  }
  syncTopPanelVisibility();
}

function maybeCollapseTopPanel() {
  if (isCompactTopPanelViewport() && !state.teacherMode) {
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
  state.teacherMode = enabled;
  syncTeacherModeUI();
  if (enabled) {
    setToolSheetOpen(true);
  } else {
    maybeCollapseTopPanel();
  }
  syncTopPanelVisibility();
  if (announce) {
    showFeedback(
      enabled ? "教师模式已开启，可以切换任务、视角和研究步骤。" : "已回到幼儿模式，只保留核心操作。",
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
  const isPlace = state.mode === "place";
  if (btnPlace) btnPlace.setAttribute("aria-pressed", isPlace ? "true" : "false");
  if (btnRemove) btnRemove.setAttribute("aria-pressed", isPlace ? "false" : "true");
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

function applyXrayToGroup(group, enabled) {
  group.traverse((object) => {
    if (!object.isMesh || !object.material) return;
    const material = object.material;
    material.transparent = enabled;
    material.opacity = enabled ? 0.38 : 1;
    material.depthWrite = !enabled;
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
      enabled ? "透视已打开，可以看到后面的箱子。" : "透视已关闭，恢复普通观察。",
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
  const mesh = new THREE.Mesh(boxGeo, createCartoonCrateMaterial(gx, gy, gz));
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.name = "cratePick";
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

  group.position.copy(worldPos(gx, gy, gz));
  group.userData = { gx, gy, gz, key, pickMesh: mesh };
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

function syncSheetPanel(key) {
  const show = key === "sheet1" || key === "sheet2";
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
}

/** 底部「清空」：撤掉所有箱子，不改变当前情境键（与工具栏「清空·自由堆」不同）。 */
function clearSceneBoxesWithHistory() {
  if (state.contextLost) return;
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

function ndcFromEvent(event) {
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  pointer.set(x, y);
}

function tryPlaceFromRay() {
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
      position: new THREE.Vector3(ORIGIN.x, 4.5, ORIGIN.z + 10.8),
      target,
      message: "已切到正面，方便观察前后遮挡。",
    },
    side: {
      position: new THREE.Vector3(ORIGIN.x + 10.4, 4.6, ORIGIN.z),
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
  if (state.contextLost) return;
  setMode("place");
});

btnRemove?.addEventListener("click", () => {
  if (state.contextLost) return;
  setMode("remove");
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

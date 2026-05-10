const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { resolveTrackerRootDir } = require("./tracker-paths");
const HOST_PID_FILE = "widget-host.pid";
const CONFIG_FILE = "widget-overlays.json";

const DEFAULT_WIDGETS = {
  menubar: { enabled: false, x: 560, y: 16, width: 220, height: 54 },
  summary: { enabled: false, x: 32, y: 32, width: 264, height: 124 },
  heatmap: { enabled: false, x: 32, y: 176, width: 264, height: 124 },
  topModels: { enabled: false, x: 320, y: 32, width: 224, height: 124 },
  limits: { enabled: false, x: 320, y: 176, width: 224, height: 124 },
};

const MENU_BAR_CLAWD_STATES = new Set([
  "idle-living",
  "idle-doze",
  "idle-follow",
  "idle-look",
  "idle-yawn",
  "idle-collapse",
  "working-building",
  "working-carrying",
  "working-conducting",
  "working-confused",
  "working-debugger",
  "working-juggling",
  "working-overheated",
  "working-pushing",
  "working-sweeping",
  "working-thinking",
  "working-typing",
  "working-ultrathink",
  "working-wizard",
  "mini-alert",
  "mini-crabwalk",
  "mini-enter",
  "mini-enter-sleep",
  "mini-happy",
  "mini-idle",
  "mini-peek",
  "mini-sleep",
  "react-double",
  "react-drag",
  "react-left",
  "react-right",
  "collapse-sleep",
  "sleeping",
  "wake",
  "disconnected",
  "error",
  "notification",
  "happy",
  "static-base",
]);

const DEFAULT_MENU_BAR_AUTO_STAGES = [
  { id: "stage-1", min: 0, max: 0, state: "sleeping" },
  { id: "stage-2", min: 0, max: 49_999, state: "idle-living" },
  { id: "stage-3", min: 49_999, max: 199_999, state: "idle-look" },
  { id: "stage-4", min: 199_999, max: 499_999, state: "working-ultrathink" },
  { id: "stage-5", min: 499_999, max: 1_999_999, state: "working-typing" },
  { id: "stage-6", min: 1_999_999, max: null, state: "working-ultrathink" },
];

let autoStageCounter = DEFAULT_MENU_BAR_AUTO_STAGES.length;

function nextAutoStageId() {
  autoStageCounter += 1;
  return `stage-${autoStageCounter}`;
}

function createMenuBarAutoStage(overrides = {}) {
  return {
    id: typeof overrides.id === "string" && overrides.id ? overrides.id : nextAutoStageId(),
    min: Number.isFinite(overrides.min) ? Number(overrides.min) : 0,
    max: overrides.max == null ? null : Number.isFinite(overrides.max) ? Number(overrides.max) : 0,
    state: MENU_BAR_CLAWD_STATES.has(overrides.state) ? overrides.state : "idle-living",
  };
}

function normalizeMenuBarAutoStages(stages) {
  const source = Array.isArray(stages) && stages.length > 0 ? stages : DEFAULT_MENU_BAR_AUTO_STAGES;
  let currentMin = 0;
  return source.map((stage, index) => {
    const safe = createMenuBarAutoStage(stage);
    const isLast = index === source.length - 1;
    const max = isLast
      ? safe.max == null
        ? null
        : Math.max(currentMin, Number(safe.max))
      : Math.max(currentMin, Number.isFinite(safe.max) ? Number(safe.max) : currentMin);
    const normalized = {
      id: safe.id,
      min: currentMin,
      max,
      state: safe.state,
    };
    currentMin = max == null ? currentMin : Number(max);
    return normalized;
  });
}

function defaultMenuBarClawdConfig() {
  return {
    mode: "auto",
    manualState: "idle-living",
    autoStages: normalizeMenuBarAutoStages(DEFAULT_MENU_BAR_AUTO_STAGES),
  };
}

function normalizeMenuBarClawdConfig(input) {
  const base = defaultMenuBarClawdConfig();
  const candidate = input && typeof input === "object" ? input : {};
  return {
    mode: candidate.mode === "manual" ? "manual" : "auto",
    manualState: MENU_BAR_CLAWD_STATES.has(candidate.manualState)
      ? candidate.manualState
      : base.manualState,
    autoStages: normalizeMenuBarAutoStages(candidate.autoStages),
  };
}

function resolveOverlayDir(home = os.homedir()) {
  return path.join(resolveTrackerRootDir(home), "tracker");
}

function resolveOverlayConfigPath(home = os.homedir()) {
  return path.join(resolveOverlayDir(home), CONFIG_FILE);
}

function resolveOverlayPidPath(home = os.homedir()) {
  return path.join(resolveOverlayDir(home), HOST_PID_FILE);
}

function defaultOverlayConfig() {
  return {
    version: 1,
    windows: structuredClone(DEFAULT_WIDGETS),
    appearance: {
      opacity: 1,
      scale: 1,
      clickThrough: false,
    },
    menuBar: {
      items: ["todayTokens", "todayCost"],
      showStats: true,
      animatedIcon: true,
      clawd: defaultMenuBarClawdConfig(),
    },
  };
}

async function readOverlayConfig({ home = os.homedir() } = {}) {
  const configPath = resolveOverlayConfigPath(home);
  try {
    const raw = await fsp.readFile(configPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeOverlayConfig(parsed);
  } catch {
    return defaultOverlayConfig();
  }
}

async function writeOverlayConfig(config, { home = os.homedir() } = {}) {
  const dir = resolveOverlayDir(home);
  await fsp.mkdir(dir, { recursive: true });
  const configPath = resolveOverlayConfigPath(home);
  const tempPath = `${configPath}.tmp`;
  const normalized = normalizeOverlayConfig(config);
  await fsp.writeFile(tempPath, JSON.stringify(normalized, null, 2), "utf8");
  await fsp.rename(tempPath, configPath);
  return normalized;
}

function normalizeOverlayConfig(config) {
  const base = defaultOverlayConfig();
  const windows = { ...base.windows };
  const inputWindows = config?.windows && typeof config.windows === "object" ? config.windows : {};

  for (const [key, defaults] of Object.entries(base.windows)) {
    const candidate = inputWindows[key] && typeof inputWindows[key] === "object" ? inputWindows[key] : {};
    windows[key] = {
      enabled: Boolean(candidate.enabled),
      x: Number.isFinite(candidate.x) ? Math.trunc(candidate.x) : defaults.x,
      y: Number.isFinite(candidate.y) ? Math.trunc(candidate.y) : defaults.y,
      width: Number.isFinite(candidate.width) ? Math.trunc(candidate.width) : defaults.width,
      height: Number.isFinite(candidate.height) ? Math.trunc(candidate.height) : defaults.height,
    };
  }

  const appearance = config?.appearance && typeof config.appearance === "object" ? config.appearance : {};
  const menuBar = config?.menuBar && typeof config.menuBar === "object" ? config.menuBar : {};
  return {
    version: 1,
    windows,
    appearance: {
      opacity:
        Number.isFinite(appearance.opacity) && appearance.opacity > 0 && appearance.opacity <= 1
          ? Number(appearance.opacity)
          : base.appearance.opacity,
      scale:
        Number.isFinite(appearance.scale) && appearance.scale > 0 && appearance.scale <= 2
          ? Number(appearance.scale)
          : base.appearance.scale,
      clickThrough: Boolean(appearance.clickThrough),
    },
    menuBar: {
      items: Array.isArray(menuBar.items) ? menuBar.items.slice(0, 2) : base.menuBar.items,
      showStats: menuBar.showStats !== false,
      animatedIcon: menuBar.animatedIcon !== false,
      clawd: normalizeMenuBarClawdConfig(menuBar.clawd),
    },
  };
}

function anyWidgetEnabled(config) {
  return Object.values(config?.windows || {}).some((windowConfig) => windowConfig?.enabled);
}

async function ensureOverlayHostRunning({
  home = os.homedir(),
  baseUrl = "http://127.0.0.1:7680",
} = {}) {
  const pidPath = resolveOverlayPidPath(home);
  const existingPid = await readPid(pidPath);
  if (existingPid && isProcessAlive(existingPid)) return existingPid;

  const electronBinary = require("electron");
  const hostMain = path.join(__dirname, "../desktop/widget-host-main.js");
  const child = spawn(electronBinary, [hostMain], {
    detached: true,
    stdio: "ignore",
    cwd: path.join(__dirname, "../.."),
    env: {
      ...process.env,
      TOKENTRACKER_WIDGET_BASE_URL: baseUrl,
      TOKENTRACKER_WIDGET_HOME: home,
    },
  });
  child.unref();
  await writePid(pidPath, child.pid);
  return child.pid;
}

async function stopOverlayHost({ home = os.homedir() } = {}) {
  const pidPath = resolveOverlayPidPath(home);
  const pid = await readPid(pidPath);
  if (!pid) return false;
  try {
    process.kill(pid);
  } catch {
    // ignore stale pid
  }
  await removeFile(pidPath);
  return true;
}

async function syncOverlayHost({ home = os.homedir(), baseUrl = "http://127.0.0.1:7680" } = {}) {
  const config = await readOverlayConfig({ home });
  if (anyWidgetEnabled(config)) {
    await ensureOverlayHostRunning({ home, baseUrl });
  } else {
    await stopOverlayHost({ home });
  }
  return config;
}

async function readPid(pidPath) {
  try {
    const raw = await fsp.readFile(pidPath, "utf8");
    const pid = Number(raw.trim());
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  } catch {
    return null;
  }
}

async function writePid(pidPath, pid) {
  const dir = path.dirname(pidPath);
  await fsp.mkdir(dir, { recursive: true });
  await fsp.writeFile(pidPath, String(pid), "utf8");
}

async function removeFile(filePath) {
  try {
    await fsp.rm(filePath, { force: true });
  } catch {
    // ignore
  }
}

function isProcessAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  readOverlayConfig,
  writeOverlayConfig,
  syncOverlayHost,
  stopOverlayHost,
  resolveOverlayConfigPath,
  resolveOverlayPidPath,
  normalizeOverlayConfig,
};

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const HOST_PID_FILE = "widget-host.pid";
const CONFIG_FILE = "widget-overlays.json";

const DEFAULT_WIDGETS = {
  menubar: { enabled: false, x: 560, y: 16, width: 220, height: 54 },
  summary: { enabled: false, x: 32, y: 32, width: 264, height: 124 },
  heatmap: { enabled: false, x: 32, y: 176, width: 264, height: 124 },
  topModels: { enabled: false, x: 320, y: 32, width: 264, height: 124 },
  limits: { enabled: false, x: 320, y: 176, width: 264, height: 124 },
};

function resolveOverlayDir(home = os.homedir()) {
  return path.join(home, ".tokentracker", "tracker");
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

const { app, BrowserWindow, screen } = require("electron");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const {
  readOverlayConfig,
  writeOverlayConfig,
  resolveOverlayConfigPath,
  resolveOverlayPidPath,
} = require("../lib/widget-overlays");

const windows = new Map();
let watcher = null;
let consecutiveHealthFailures = 0;
let persistTimer = null;

const home = process.env.TOKENTRACKER_WIDGET_HOME || process.env.USERPROFILE || process.env.HOME || "";
const baseUrl = process.env.TOKENTRACKER_WIDGET_BASE_URL || "http://127.0.0.1:7680";

function createOverlayWindow(kind, config, appearance) {
  const scale = appearance?.scale || 1;
  const width = Math.round(config.width * scale);
  const height = Math.round(config.height * scale);
  const display = screen.getPrimaryDisplay();
  const bounds = display?.workArea || { width: 1920, height: 1080 };
  const safeX = Math.max(0, Math.min(config.x, Math.max(0, bounds.width - width)));
  const safeY = Math.max(0, Math.min(config.y, Math.max(0, bounds.height - height)));

  const win = new BrowserWindow({
    width,
    height,
    x: safeX,
    y: safeY,
    movable: true,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    resizable: false,
    maximizable: false,
    minimizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    roundedCorners: false,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      backgroundThrottling: false,
    },
  });

  win.setAlwaysOnTop(true, "screen-saver");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  win.setOpacity(1);
  win.setIgnoreMouseEvents(Boolean(appearance?.clickThrough), { forward: true });
  win.loadURL(`${baseUrl}/widget-host/${encodeURIComponent(kind)}`);
  win.once("ready-to-show", () => {
    win.show();
  });
  win.on("moved", () => {
    schedulePersistWindowBounds();
  });
  win.on("closed", () => windows.delete(kind));
  return win;
}

async function applyOverlayConfig() {
  const overlayConfig = await readOverlayConfig({ home });
  const enabledKinds = new Set();

  for (const [kind, widgetConfig] of Object.entries(overlayConfig.windows || {})) {
    if (!widgetConfig?.enabled) {
      const existing = windows.get(kind);
      if (existing) existing.close();
      continue;
    }

    enabledKinds.add(kind);
    const existing = windows.get(kind);
    if (existing && !existing.isDestroyed()) {
      const scale = overlayConfig.appearance?.scale || 1;
      existing.setBounds({
        x: widgetConfig.x,
        y: widgetConfig.y,
        width: Math.round(widgetConfig.width * scale),
        height: Math.round(widgetConfig.height * scale),
      });
      existing.setOpacity(1);
      existing.setIgnoreMouseEvents(Boolean(overlayConfig.appearance?.clickThrough), {
        forward: true,
      });
      continue;
    }

    windows.set(kind, createOverlayWindow(kind, widgetConfig, overlayConfig.appearance));
  }

  for (const [kind, win] of windows.entries()) {
    if (!enabledKinds.has(kind) && win && !win.isDestroyed()) {
      win.close();
    }
  }
}

async function installWatcher() {
  const configPath = resolveOverlayConfigPath(home);
  const dir = path.dirname(configPath);
  await fsp.mkdir(dir, { recursive: true });
  if (!fs.existsSync(configPath)) {
    const { writeOverlayConfig } = require("../lib/widget-overlays");
    await writeOverlayConfig(undefined, { home });
  }

  watcher = fs.watch(dir, { persistent: true }, async (_eventType, filename) => {
    if (filename && String(filename).toLowerCase() !== path.basename(configPath).toLowerCase()) {
      return;
    }
    await applyOverlayConfig();
  });
}

async function cleanup() {
  try {
    watcher?.close();
  } catch {
    // ignore
  }
  const pidPath = resolveOverlayPidPath(home);
  try {
    await fsp.rm(pidPath, { force: true });
  } catch {
    // ignore
  }
}

function schedulePersistWindowBounds() {
  if (persistTimer) {
    clearTimeout(persistTimer);
  }
  persistTimer = setTimeout(() => {
    persistWindowBounds().catch(() => {});
  }, 150);
}

async function persistWindowBounds() {
  const overlayConfig = await readOverlayConfig({ home });
  let changed = false;
  for (const [kind, win] of windows.entries()) {
    if (!win || win.isDestroyed()) continue;
    const current = overlayConfig.windows?.[kind];
    if (!current) continue;
    const bounds = win.getBounds();
    if (current.x !== bounds.x || current.y !== bounds.y) {
      overlayConfig.windows[kind] = {
        ...current,
        x: bounds.x,
        y: bounds.y,
      };
      changed = true;
    }
  }
  if (changed) {
    await writeOverlayConfig(overlayConfig, { home });
  }
}

async function healthcheck() {
  try {
    const response = await fetch(`${baseUrl}/api/local-auth`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    consecutiveHealthFailures = 0;
  } catch {
    consecutiveHealthFailures += 1;
    if (consecutiveHealthFailures >= 3) {
      app.quit();
    }
  }
}

app.whenReady().then(async () => {
  app.setName("TokenUsage Widget Host");
  await applyOverlayConfig();
  await installWatcher();
  setInterval(() => {
    healthcheck().catch(() => {});
  }, 15000);
});

app.on("before-quit", () => {
  cleanup();
});

app.on("window-all-closed", (event) => {
  event.preventDefault();
});

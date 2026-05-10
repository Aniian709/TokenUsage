export const CLAWD_STATE_TO_PATH = {
  "idle-living": "idle/living.svg",
  "idle-doze": "idle/doze.svg",
  "idle-follow": "idle/follow.svg",
  "idle-look": "idle/look.svg",
  "idle-yawn": "idle/yawn.svg",
  "idle-collapse": "idle/collapse.svg",
  "working-building": "working/building.svg",
  "working-carrying": "working/carrying.svg",
  "working-conducting": "working/conducting.svg",
  "working-confused": "working/confused.svg",
  "working-debugger": "working/debugger.svg",
  "working-juggling": "working/juggling.svg",
  "working-overheated": "working/overheated.svg",
  "working-pushing": "working/pushing.svg",
  "working-sweeping": "working/sweeping.svg",
  "working-thinking": "working/thinking.svg",
  "working-typing": "working/typing.svg",
  "working-ultrathink": "working/ultrathink.svg",
  "working-wizard": "working/wizard.svg",
  "mini-alert": "mini/alert.svg",
  "mini-crabwalk": "mini/crabwalk.svg",
  "mini-enter": "mini/enter.svg",
  "mini-enter-sleep": "mini/enter-sleep.svg",
  "mini-happy": "mini/happy.svg",
  "mini-idle": "mini/idle.svg",
  "mini-peek": "mini/peek.svg",
  "mini-sleep": "mini/sleep.svg",
  "react-double": "react/double.svg",
  "react-drag": "react/drag.svg",
  "react-left": "react/left.svg",
  "react-right": "react/right.svg",
  "collapse-sleep": "sleep/collapse-sleep.svg",
  sleeping: "sleep/sleeping.svg",
  wake: "sleep/wake.svg",
  disconnected: "status/disconnected.svg",
  error: "status/error.svg",
  notification: "status/notification.svg",
  happy: "happy.svg",
  "static-base": "static-base.svg",
};

export const CLAWD_STATES = Object.keys(CLAWD_STATE_TO_PATH);
export const CLAWD_SELECTABLE_STATES = CLAWD_STATES.filter(
  (state) => state !== "mini-enter" && state !== "mini-enter-sleep",
);

const DEFAULT_AUTO_STAGES = [
  { id: "stage-1", min: 0, max: 0, state: "sleeping" },
  { id: "stage-2", min: 0, max: 49_999, state: "idle-living" },
  { id: "stage-3", min: 49_999, max: 199_999, state: "idle-look" },
  { id: "stage-4", min: 199_999, max: 499_999, state: "working-ultrathink" },
  { id: "stage-5", min: 499_999, max: 1_999_999, state: "working-typing" },
  { id: "stage-6", min: 1_999_999, max: null, state: "working-ultrathink" },
];

let autoStageCounter = DEFAULT_AUTO_STAGES.length;

function nextAutoStageId() {
  autoStageCounter += 1;
  return `stage-${autoStageCounter}`;
}

export function createMenuBarAutoStage(overrides = {}) {
  return {
    id: typeof overrides.id === "string" && overrides.id ? overrides.id : nextAutoStageId(),
    min: Number.isFinite(overrides.min) ? Number(overrides.min) : 0,
    max: overrides.max == null ? null : Number.isFinite(overrides.max) ? Number(overrides.max) : 0,
    state: CLAWD_STATES.includes(overrides.state) ? overrides.state : "idle-living",
  };
}

export function normalizeMenuBarAutoStages(stages) {
  const source = Array.isArray(stages) && stages.length > 0 ? stages : DEFAULT_AUTO_STAGES;
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

export function defaultMenuBarClawdConfig() {
  return {
    mode: "auto",
    manualState: "idle-living",
    autoStages: normalizeMenuBarAutoStages(DEFAULT_AUTO_STAGES),
  };
}

export function normalizeMenuBarClawdConfig(input) {
  const base = defaultMenuBarClawdConfig();
  const candidate = input && typeof input === "object" ? input : {};
  const mode = candidate.mode === "manual" ? "manual" : "auto";
  const manualState = CLAWD_STATES.includes(candidate.manualState)
    ? candidate.manualState
    : base.manualState;
  const autoStages = normalizeMenuBarAutoStages(candidate.autoStages);
  return { mode, manualState, autoStages };
}

export function resolveAutoMenuBarClawdState(todayTokens, autoStages = []) {
  const normalizedTokens = Number.isFinite(todayTokens) ? todayTokens : 0;
  const stages = normalizeMenuBarAutoStages(autoStages);
  for (const stage of stages) {
    const matches = normalizedTokens >= stage.min && (stage.max == null || normalizedTokens <= stage.max);
    if (matches) {
      return stage.state;
    }
  }
  return "idle-living";
}

export function resolveMenuBarClawdState({
  todayTokens = 0,
  isSyncing = false,
  hasError = false,
  isDisconnected = false,
  config,
} = {}) {
  if (hasError) return "error";
  if (isDisconnected) return "disconnected";
  if (isSyncing) return "working-typing";

  const normalized = normalizeMenuBarClawdConfig(config);
  if (normalized.mode === "manual") return normalized.manualState;
  return resolveAutoMenuBarClawdState(todayTokens, normalized.autoStages);
}

export function formatClawdStateLabel(state) {
  return String(state || "")
    .split("-")
    .map((part) => {
      if (!part) return part;
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

export function getMenuBarClawdPresentation(state) {
  const base = {
    size: 58,
    cropPadding: 10,
    offsetX: 0,
    offsetY: 2,
    scale: 1,
  };

  const overrides = {
    "mini-crabwalk": { size: 62, offsetY: 3, scale: 1.04 },
    "mini-alert": { size: 62, offsetY: 2, scale: 1.04 },
    "mini-peek": { size: 62, offsetY: 3, scale: 1.04 },
    "mini-happy": { size: 62, offsetY: 2, scale: 1.04 },
    "working-confused": { size: 51, offsetX: 3, offsetY: 5, cropPadding: 13, scale: 0.95 },
    "working-juggling": { size: 54, offsetY: 0, cropPadding: 12, scale: 0.97 },
    "working-conducting": { size: 54, offsetY: 5, cropPadding: 12, scale: 0.97 },
    "working-building": { size: 55, offsetY: 4, cropPadding: 11, scale: 0.98 },
    "working-carrying": { size: 55, offsetY: 4, cropPadding: 11, scale: 0.98 },
    "working-wizard": { size: 56, offsetX: -9, offsetY: 1, cropPadding: 12, scale: 1.16 },
    "working-overheated": { size: 54, offsetY: 5, cropPadding: 12, scale: 0.97 },
    "working-pushing": { size: 54, offsetY: 4, cropPadding: 11, scale: 0.98 },
    "working-sweeping": { size: 55, offsetY: 0, cropPadding: 11, scale: 0.98 },
    "react-left": { size: 56, offsetX: 9, offsetY: 8, scale: 0.88 },
    "react-right": { size: 60, offsetY: 8, scale: 1.03 },
    "react-double": { size: 58, offsetY: 6, scale: 1.01 },
    "react-drag": { size: 58, offsetY: 8, scale: 1.01 },
    "idle-collapse": { size: 60, offsetY: 3, scale: 1.04 },
    "collapse-sleep": { size: 60, offsetY: 3, scale: 1.04 },
    wake: { size: 58, offsetY: 5, scale: 1.01 },
    disconnected: { size: 58, offsetY: 5, scale: 1.01 },
    sleeping: { size: 58, offsetY: -1, scale: 1.01 },
  };

  return {
    ...base,
    ...(overrides[state] || {}),
  };
}

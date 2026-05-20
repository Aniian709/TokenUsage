const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { resolveTrackerRootDir } = require("./tracker-paths");

const TOKEN_FIELDS = [
  "input_tokens",
  "cached_input_tokens",
  "cache_creation_input_tokens",
  "output_tokens",
  "reasoning_output_tokens",
  "total_tokens",
];

const CACHE_TTL_MS = 5000;
const SNAPSHOT_VERSION = 2;

let memoryCache = {
  homeDir: null,
  loadedAt: 0,
  rows: null,
};

async function loadSessionUsageRows({ homeDir = os.homedir(), forceRefresh = false } = {}) {
  const now = Date.now();
  if (
    !forceRefresh &&
    memoryCache.rows &&
    memoryCache.homeDir === homeDir &&
    now - memoryCache.loadedAt < CACHE_TTL_MS
  ) {
    return cloneRows(memoryCache.rows);
  }

  const snapshot = await readSnapshot(homeDir);
  await syncSourceFiles({
    files: await collectCodexSessionFiles(homeDir),
    snapshot,
    source: "codex",
    parseFile: parseCodexFile,
  });
  await syncSourceFiles({
    files: await collectClaudeSessionFiles(homeDir),
    snapshot,
    source: "claude",
    parseFile: parseClaudeFile,
  });

  await writeSnapshot(homeDir, snapshot);

  const rows = aggregateEventsToRows(Object.values(snapshot.events || {}));
  memoryCache = {
    homeDir,
    loadedAt: now,
    rows,
  };
  return cloneRows(rows);
}

async function syncSourceFiles({ files, snapshot, source, parseFile }) {
  const seenFiles = new Set(files);
  for (const filePath of files) {
    const stat = await safeStat(filePath);
    if (!stat) continue;

    const fingerprint = {
      size: Number.isFinite(stat.size) ? stat.size : 0,
      mtimeMs: Number.isFinite(stat.mtimeMs) ? Math.trunc(stat.mtimeMs) : 0,
    };

    const previousMeta = snapshot.files[filePath];
    if (
      previousMeta &&
      previousMeta.version === SNAPSHOT_VERSION &&
      previousMeta.size === fingerprint.size &&
      previousMeta.mtimeMs === fingerprint.mtimeMs &&
      previousMeta.missing !== true
    ) {
      continue;
    }

    const events = await parseFile(filePath);
    const eventIds = new Set(Array.isArray(previousMeta?.eventIds) ? previousMeta.eventIds : []);
    for (const event of events) {
      if (!event?.request_id) continue;
      snapshot.events[event.request_id] = event;
      eventIds.add(event.request_id);
    }

    snapshot.files[filePath] = {
      version: SNAPSHOT_VERSION,
      source: source || previousMeta?.source || inferSourceFromFilePath(filePath),
      size: fingerprint.size,
      mtimeMs: fingerprint.mtimeMs,
      eventIds: Array.from(eventIds),
      firstSeenAt: previousMeta?.firstSeenAt || new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      missing: false,
      missingSince: null,
    };
  }

  for (const [filePath, meta] of Object.entries(snapshot.files || {})) {
    if ((meta?.source || inferSourceFromFilePath(filePath)) !== source) continue;
    if (seenFiles.has(filePath)) continue;
    snapshot.files[filePath] = {
      ...meta,
      version: SNAPSHOT_VERSION,
      source: meta?.source || source,
      missing: true,
      missingSince: meta?.missingSince || new Date().toISOString(),
    };
  }
}

async function parseCodexFile(filePath) {
  const content = await safeReadFile(filePath);
  if (!content) return [];

  const events = [];
  const lines = content.split(/\r?\n/).filter(Boolean);
  let currentModel = "unknown";
  let previousTotals = null;
  let sessionId = null;
  let eventIndex = 0;

  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const payload = parsed?.payload;
    if (
      (parsed?.type === "turn_context" || parsed?.type === "session_meta") &&
      payload &&
      typeof payload === "object"
    ) {
      const maybeSessionId =
        typeof payload.session_id === "string"
          ? payload.session_id
          : typeof payload.sessionId === "string"
            ? payload.sessionId
            : typeof payload.id === "string"
              ? payload.id
              : null;
      if (maybeSessionId) sessionId = maybeSessionId.trim() || sessionId;

      const maybeModel =
        typeof payload.model === "string"
          ? payload.model
          : typeof payload?.info?.model === "string"
            ? payload.info.model
            : null;
      if (maybeModel) currentModel = normalizeCodexModel(maybeModel);
      continue;
    }

    const tokenCount = extractTokenCount(parsed);
    if (!tokenCount?.info || !tokenCount?.timestamp) continue;

    const info = tokenCount.info;
    const totalUsage = isNonEmptyObject(info.total_token_usage) ? info.total_token_usage : null;
    const lastUsage = isNonEmptyObject(info.last_token_usage) ? info.last_token_usage : null;
    const maybeModel =
      typeof info.model === "string"
        ? info.model
        : typeof info.model_name === "string"
          ? info.model_name
          : typeof tokenCount.payloadModel === "string"
            ? tokenCount.payloadModel
            : null;
    if (maybeModel) currentModel = normalizeCodexModel(maybeModel);

    const delta = pickCodexDelta(lastUsage, totalUsage, previousTotals);
    if (!delta) {
      if (totalUsage) previousTotals = normalizeRawCodexUsage(totalUsage);
      continue;
    }

    if (totalUsage) previousTotals = normalizeRawCodexUsage(totalUsage);
    const hourStart = toUtcHalfHourStart(tokenCount.timestamp);
    if (!hourStart) continue;

    eventIndex += 1;
    const requestId = buildCodexEventId({ sessionId, filePath, eventIndex });
    events.push({
      request_id: requestId,
      source: "codex",
      model: currentModel || "unknown",
      hour_start: hourStart,
      totals: delta,
      file_path: filePath,
    });
  }

  return events;
}

async function parseClaudeFile(filePath) {
  const content = await safeReadFile(filePath);
  if (!content) return [];

  const lines = content.split(/\r?\n/).filter(Boolean);
  const bestByMessageId = new Map();
  let sequence = 0;

  for (const line of lines) {
    let parsed;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    const usage = parsed?.message?.usage || parsed?.usage;
    if (!isNonEmptyObject(usage)) continue;

    const timestamp = typeof parsed?.timestamp === "string" ? parsed.timestamp : null;
    if (!timestamp) continue;

    const message = parsed?.message && typeof parsed.message === "object" ? parsed.message : {};
    const messageId =
      typeof message.id === "string" && message.id.trim()
        ? message.id.trim()
        : `__anonymous__:${filePath}:${sequence++}`;
    const sessionId =
      typeof parsed?.sessionId === "string" && parsed.sessionId.trim()
        ? parsed.sessionId.trim()
        : typeof parsed?.session_id === "string" && parsed.session_id.trim()
          ? parsed.session_id.trim()
          : "unknown";
    const candidate = {
      request_id: `session:${sessionId}:${messageId}`,
      timestamp,
      stopReason:
        typeof message.stop_reason === "string" && message.stop_reason.trim()
          ? message.stop_reason.trim()
          : null,
      model: normalizeClaudeModel(message.model || parsed?.model || "unknown"),
      totals: normalizeClaudeUsage(usage),
      file_path: filePath,
    };

    const existing = bestByMessageId.get(messageId);
    if (!existing || shouldReplaceClaudeMessage(existing, candidate)) {
      bestByMessageId.set(messageId, candidate);
    }
  }

  return Array.from(bestByMessageId.values())
    .filter((candidate) => candidate.stopReason && candidate.totals.output_tokens > 0)
    .map((candidate) => ({
      request_id: candidate.request_id,
      source: "claude",
      model: candidate.model,
      hour_start: toUtcHalfHourStart(candidate.timestamp),
      totals: candidate.totals,
      file_path: candidate.file_path,
    }))
    .filter((event) => Boolean(event.hour_start));
}

async function collectCodexSessionFiles(homeDir) {
  const files = [];
  await collectJsonlFilesRecursive(path.join(homeDir, ".codex", "sessions"), files);
  await collectJsonlFilesRecursive(path.join(homeDir, ".codex", "archived_sessions"), files);
  return files.sort();
}

async function collectClaudeSessionFiles(homeDir) {
  const files = [];
  await collectJsonlFilesRecursive(path.join(homeDir, ".claude", "projects"), files);
  return files.sort();
}

async function collectJsonlFilesRecursive(dirPath, files) {
  let entries;
  try {
    entries = await fs.readdir(dirPath, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      await collectJsonlFilesRecursive(fullPath, files);
      continue;
    }
    if (entry.isFile() && fullPath.toLowerCase().endsWith(".jsonl")) {
      files.push(fullPath);
    }
  }
}

function aggregateEventsToRows(events) {
  const byBucket = new Map();
  const byEventId = new Map();
  const seenConversationDays = new Set();

  for (const event of events) {
    const eventId = normalizeSnapshotEventId(event?.request_id, event);
    byEventId.set(eventId || event?.request_id || `${byEventId.size}`, {
      ...event,
      request_id: eventId || event?.request_id,
    });
  }

  for (const event of byEventId.values()) {
    const source = event?.source || "unknown";
    const model = event?.model || "unknown";
    const hourStart = event?.hour_start;
    if (!hourStart) continue;

    const key = `${source}|${model}|${hourStart}`;
    if (!byBucket.has(key)) {
      byBucket.set(key, {
        source,
        model,
        hour_start: hourStart,
        input_tokens: 0,
        cached_input_tokens: 0,
        cache_creation_input_tokens: 0,
        output_tokens: 0,
        reasoning_output_tokens: 0,
        total_tokens: 0,
        conversation_count: 0,
      });
    }

    const row = byBucket.get(key);
    for (const field of TOKEN_FIELDS) {
      row[field] += toNonNegativeInt(event?.totals?.[field]);
    }
    const conversationKey = eventConversationDayKey(event);
    if (conversationKey && !seenConversationDays.has(conversationKey)) {
      seenConversationDays.add(conversationKey);
      row.conversation_count += 1;
    }
  }

  return Array.from(byBucket.values()).sort((left, right) => {
    if (left.hour_start !== right.hour_start) return left.hour_start.localeCompare(right.hour_start);
    if (left.source !== right.source) return left.source.localeCompare(right.source);
    return left.model.localeCompare(right.model);
  });
}

function eventConversationDayKey(event) {
  const hourStart = String(event?.hour_start || "");
  if (!hourStart) return null;
  const day = hourStart.slice(0, 10);
  const source = event?.source || inferSourceFromFilePath(event?.file_path);
  const requestId = String(event?.request_id || "");

  if (source === "claude") {
    const match = requestId.match(/^session:([^:]+):/u);
    return match ? `${source}:${match[1]}:${day}` : null;
  }

  if (source === "codex") {
    const match = requestId.match(/^codex_session:(.*):file_[a-f0-9]{12}:\d+$/u);
    return match ? `${source}:${match[1]}:${day}` : null;
  }

  return null;
}

function extractTokenCount(obj) {
  const payload = obj?.payload;
  if (!payload || typeof payload !== "object") return null;
  if (payload.type === "token_count") {
    return {
      info: payload.info,
      timestamp: obj?.timestamp || null,
      payloadModel: payload?.model || null,
    };
  }
  if (payload.msg?.type === "token_count") {
    return {
      info: payload.msg.info,
      timestamp: obj?.timestamp || null,
      payloadModel: payload?.model || payload.msg?.model || null,
    };
  }
  return null;
}

function pickCodexDelta(lastUsage, totalUsage, previousTotals) {
  const hasTotal = isNonEmptyObject(totalUsage);
  const hasPrevious = isNonEmptyObject(previousTotals);

  if (hasTotal && hasPrevious) {
    const current = normalizeRawCodexUsage(totalUsage);
    const previous = normalizeRawCodexUsage(previousTotals);
    if (current.total_tokens < previous.total_tokens) {
      return normalizeCodexUsage(lastUsage || totalUsage);
    }

    const delta = {};
    for (const field of TOKEN_FIELDS) {
      delta[field] = Math.max(
        0,
        toNonNegativeInt(current[field]) - toNonNegativeInt(previous[field]),
      );
    }
    return isAllZeroUsage(delta)
      ? null
      : normalizeCodexUsage(delta, { alreadyNormalizedTotal: true });
  }

  if (isNonEmptyObject(lastUsage)) {
    return normalizeCodexUsage(lastUsage);
  }

  if (hasTotal) {
    return normalizeCodexUsage(totalUsage);
  }

  return null;
}

function normalizeRawCodexUsage(usage) {
  const inputInclusive = toNonNegativeInt(usage?.input_tokens);
  const cached = Math.min(toNonNegativeInt(usage?.cached_input_tokens), inputInclusive);
  const output = toNonNegativeInt(usage?.output_tokens);
  const reasoning = toNonNegativeInt(usage?.reasoning_output_tokens);
  const total = toNonNegativeInt(usage?.total_tokens) || inputInclusive + output;

  return {
    input_tokens: inputInclusive,
    cached_input_tokens: cached,
    cache_creation_input_tokens: 0,
    output_tokens: output,
    reasoning_output_tokens: reasoning,
    total_tokens: total,
  };
}

function normalizeCodexUsage(usage, { alreadyNormalizedTotal = false } = {}) {
  const raw = normalizeRawCodexUsage(usage);
  const nonCachedInput = Math.max(0, raw.input_tokens - raw.cached_input_tokens);
  const total = alreadyNormalizedTotal
    ? raw.total_tokens
    : raw.total_tokens || raw.input_tokens + raw.output_tokens;

  const normalized = {
    input_tokens: nonCachedInput,
    cached_input_tokens: raw.cached_input_tokens,
    cache_creation_input_tokens: 0,
    output_tokens: raw.output_tokens,
    reasoning_output_tokens: raw.reasoning_output_tokens,
    total_tokens: total,
  };

  return isAllZeroUsage(normalized) ? null : normalized;
}

function normalizeClaudeUsage(usage) {
  const inputTokens = toNonNegativeInt(usage?.input_tokens);
  const outputTokens = toNonNegativeInt(usage?.output_tokens);
  const cacheRead = toNonNegativeInt(usage?.cache_read_input_tokens);
  const cacheCreation = toNonNegativeInt(usage?.cache_creation_input_tokens);
  return {
    input_tokens: inputTokens,
    cached_input_tokens: cacheRead,
    cache_creation_input_tokens: cacheCreation,
    output_tokens: outputTokens,
    reasoning_output_tokens: 0,
    total_tokens: inputTokens + outputTokens + cacheRead + cacheCreation,
  };
}

function shouldReplaceClaudeMessage(existing, candidate) {
  if (candidate.stopReason && !existing.stopReason) return true;
  if (!candidate.stopReason && existing.stopReason) return false;
  if (candidate.totals.output_tokens !== existing.totals.output_tokens) {
    return candidate.totals.output_tokens > existing.totals.output_tokens;
  }
  return candidate.totals.total_tokens > existing.totals.total_tokens;
}

function normalizeCodexModel(rawModel) {
  let value = String(rawModel || "unknown").trim().toLowerCase() || "unknown";
  if (value.includes("/")) value = value.slice(value.lastIndexOf("/") + 1);
  value = value.replace(/-\d{4}-\d{2}-\d{2}$/u, "");
  value = value.replace(/-\d{8}$/u, "");
  return value || "unknown";
}

function normalizeClaudeModel(rawModel) {
  let value = String(rawModel || "unknown").trim().toLowerCase() || "unknown";
  if (value.includes("/")) value = value.slice(value.lastIndexOf("/") + 1);
  value = value.replace(/-\d{8}$/u, "");
  return value || "unknown";
}

function toUtcHalfHourStart(timestamp) {
  const date = new Date(timestamp);
  if (!Number.isFinite(date.getTime())) return null;
  const bucketMinute = date.getUTCMinutes() >= 30 ? 30 : 0;
  const bucket = new Date(
    Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
      date.getUTCHours(),
      bucketMinute,
      0,
      0,
    ),
  );
  return bucket.toISOString();
}

async function readSnapshot(homeDir) {
  const snapshotPath = resolveSnapshotPath(homeDir);
  try {
    const raw = await fs.readFile(snapshotPath, "utf8");
    const parsed = JSON.parse(raw);
    return normalizeSnapshot(parsed);
  } catch {
    // fall through
  }
  return createEmptySnapshot();
}

async function writeSnapshot(homeDir, snapshot) {
  const snapshotPath = resolveSnapshotPath(homeDir);
  const dirPath = path.dirname(snapshotPath);
  await fs.mkdir(dirPath, { recursive: true });
  const tempPath = `${snapshotPath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(snapshot), "utf8");
  await fs.rename(tempPath, snapshotPath);
}

function resolveSnapshotPath(homeDir) {
  return path.join(resolveTrackerRootDir(homeDir), "cache", "session-history-cache.json");
}

function createEmptySnapshot() {
  return {
    version: SNAPSHOT_VERSION,
    files: {},
    events: {},
  };
}

function normalizeSnapshot(parsed) {
  if (!parsed || typeof parsed !== "object") {
    return createEmptySnapshot();
  }

  const rawFiles =
    parsed.files && typeof parsed.files === "object" && !Array.isArray(parsed.files)
      ? parsed.files
      : {};
  const rawEvents =
    parsed.events && typeof parsed.events === "object" && !Array.isArray(parsed.events)
      ? parsed.events
      : {};

  const files = {};
  for (const [filePath, meta] of Object.entries(rawFiles)) {
    if (!meta || typeof meta !== "object") continue;
    files[filePath] = {
      version: SNAPSHOT_VERSION,
      source: typeof meta.source === "string" && meta.source.trim()
        ? meta.source.trim()
        : inferSourceFromFilePath(filePath),
      size: toNonNegativeInt(meta.size),
      mtimeMs: toNonNegativeInt(meta.mtimeMs),
      eventIds: Array.from(
        new Set((Array.isArray(meta.eventIds) ? meta.eventIds : []).filter((id) => typeof id === "string" && id)),
      ),
      firstSeenAt: normalizeIsoString(meta.firstSeenAt),
      lastSeenAt: normalizeIsoString(meta.lastSeenAt),
      missing: meta.missing === true,
      missingSince: meta.missing === true ? normalizeIsoString(meta.missingSince) : null,
    };
  }

  const events = {};
  const eventIdMap = new Map();
  for (const [eventId, event] of Object.entries(rawEvents)) {
    if (!event || typeof event !== "object") continue;
    const nextEventId = normalizeSnapshotEventId(eventId, event);
    eventIdMap.set(eventId, nextEventId);
    events[nextEventId] = {
      ...event,
      request_id: nextEventId,
    };
  }

  if (eventIdMap.size > 0) {
    for (const meta of Object.values(files)) {
      meta.eventIds = Array.from(
        new Set(meta.eventIds.map((eventId) => eventIdMap.get(eventId) || eventId)),
      );
    }
  }

  return {
    version: SNAPSHOT_VERSION,
    files,
    events,
  };
}

function inferSourceFromFilePath(filePath) {
  const normalized = String(filePath || "").toLowerCase();
  if (normalized.includes(`${path.sep}.claude${path.sep}`) || normalized.includes("/.claude/")) {
    return "claude";
  }
  return "codex";
}

function buildCodexEventId({ sessionId, filePath, eventIndex }) {
  const sessionPart = String(sessionId || "unknown").trim() || "unknown";
  return `codex_session:${sessionPart}:file_${stablePathHash(filePath)}:${eventIndex}`;
}

function normalizeSnapshotEventId(eventId, event) {
  const source = event?.source || inferSourceFromFilePath(event?.file_path);
  if (source !== "codex") return eventId;
  if (isNewCodexEventId(eventId)) return eventId;

  const parts = String(eventId || "").split(":");
  if (parts[0] !== "codex_session" || !event?.file_path) return eventId;

  let sessionId = null;
  let eventIndex = null;
  if (parts.length === 3) {
    sessionId = parts[1];
    eventIndex = Number(parts[2]);
  } else if (parts.length === 4 && /^[a-f0-9]{12}$/u.test(parts[2])) {
    sessionId = parts[1];
    eventIndex = Number(parts[3]);
  }

  if (!sessionId || !Number.isFinite(eventIndex)) return eventId;

  return buildCodexEventId({
    sessionId,
    filePath: event.file_path,
    eventIndex,
  });
}

function isNewCodexEventId(eventId) {
  return /^codex_session:.*:file_[a-f0-9]{12}:\d+$/u.test(String(eventId || ""));
}

function stablePathHash(filePath) {
  return crypto
    .createHash("sha1")
    .update(String(filePath || "").toLowerCase())
    .digest("hex")
    .slice(0, 12);
}

function normalizeIsoString(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return null;
  return date.toISOString();
}

async function safeStat(filePath) {
  try {
    return await fs.stat(filePath);
  } catch {
    return null;
  }
}

async function safeReadFile(filePath) {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

function cloneRows(rows) {
  return Array.isArray(rows) ? rows.map((row) => ({ ...row })) : [];
}

function isNonEmptyObject(value) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length > 0,
  );
}

function isAllZeroUsage(usage) {
  if (!usage) return true;
  return TOKEN_FIELDS.every((field) => toNonNegativeInt(usage[field]) === 0);
}

function toNonNegativeInt(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

module.exports = {
  loadSessionUsageRows,
  aggregateEventsToRows,
  normalizeCodexModel,
  normalizeClaudeModel,
};

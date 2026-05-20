import React, { useEffect, useMemo, useState } from "react";
import { copy } from "../lib/copy";
import { formatDateLocal, getRangeForPeriod } from "../lib/date-range";
import {
  getBrowserTimeZone,
  getBrowserTimeZoneOffsetMinutes,
} from "../lib/timezone";
import {
  getUsageHeatmap,
  getUsageHourly,
  getUsageLimits,
  getUsageModelBreakdown,
  getUsageSummary,
} from "../lib/api";
import { getOverlayConfig } from "../lib/widget-overlays";
import { buildTopModels } from "../lib/model-breakdown";
import { ClawdAnimated } from "../ui/foundation/ClawdAnimated.jsx";
import {
  getMenuBarClawdPresentation,
  resolveMenuBarClawdState,
} from "../lib/clawd-animations.js";

const MODEL_COLORS = ["#5A8CF2", "#9973E6", "#4DB8A6", "#E68C59"];
const SOURCE_COLORS = {
  claude: "#5A8CF2",
  codex: "#C77DFF",
  cursor: "#FFCC00",
  gemini: "#0A84FF",
};
const BASE_SIZES = {
  menubar: { width: 204, height: 54, radius: 14 },
  card: { width: 264, height: 124, radius: 24 },
};

function formatCompact(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0";
  if (Math.abs(num) >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return String(Math.round(num));
}

function formatUsd(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "$0.00";
  return `$${num.toFixed(2)}`;
}

function middleEllipsis(value, max = 20) {
  const text = String(value || "");
  if (text.length <= max) return text;
  const left = Math.ceil((max - 1) / 2);
  const right = Math.floor((max - 1) / 2);
  return `${text.slice(0, left)}…${text.slice(text.length - right)}`;
}

function usageTokenValue(row) {
  const value = Number(row?.billable_total_tokens ?? row?.total_tokens ?? 0);
  return Number.isFinite(value) ? value : 0;
}

function buildHourlyTrendPoints(hourlyRows) {
  const now = new Date();
  const currentHour = now.getHours();
  const hourly = Array.from({ length: currentHour + 1 }, () => 0);

  for (const row of Array.isArray(hourlyRows) ? hourlyRows : []) {
    const match = String(row?.hour || "").match(/T(\d{2}):/);
    const hour = match ? Number(match[1]) : NaN;
    if (!Number.isInteger(hour) || hour < 0 || hour > currentHour) continue;
    hourly[hour] += usageTokenValue(row);
  }

  const firstActiveHour = hourly.findIndex((value) => value > 0);
  if (firstActiveHour < 0) return [0, 0];

  const cumulative = [0];
  let running = 0;
  for (const value of hourly.slice(firstActiveHour)) {
    running += value;
    cumulative.push(running);
  }
  return cumulative.length >= 2 ? cumulative : [0, 0];
}

function buildSparklinePath(values, width = 264, height = 44, paddingY = 7) {
  const data = Array.isArray(values) && values.length > 0 ? values.map((v) => Number(v) || 0) : [0, 0];
  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min;
  const usableHeight = height - paddingY * 2;
  const points = data.map((value, index) => {
    const x = data.length === 1 ? width / 2 : (index / (data.length - 1)) * width;
    const ratio = span > 0 ? (value - min) / span : 0.5;
    const y = height - paddingY - ratio * usableHeight;
    return [x, y];
  });

  if (points.length === 1) {
    const [, y] = points[0];
    return `M0,${y.toFixed(2)} L${width},${y.toFixed(2)}`;
  }

  let path = `M${points[0][0].toFixed(2)},${points[0][1].toFixed(2)}`;
  for (let index = 1; index < points.length; index += 1) {
    const [prevX, prevY] = points[index - 1];
    const [x, y] = points[index];
    const midX = (prevX + x) / 2;
    path += ` C${midX.toFixed(2)},${prevY.toFixed(2)} ${midX.toFixed(2)},${y.toFixed(2)} ${x.toFixed(2)},${y.toFixed(2)}`;
  }
  return path;
}

function heatmapFillForLevel(level) {
  const normalized = Math.max(0, Math.min(4, Number(level || 0)));
  if (normalized <= 0) return "rgba(255,255,255,0.12)";
  return [
    "rgba(10, 132, 255, 0.28)",
    "rgba(10, 132, 255, 0.50)",
    "rgba(10, 132, 255, 0.75)",
    "#0A84FF",
  ][normalized - 1];
}

function limitBarFill(fraction) {
  if (fraction >= 0.8) return "#E64D4D";
  if (fraction >= 0.7) return "#D9A633";
  return "#33B866";
}

function formatLimitReset(value) {
  if (!value) return "";
  const ts = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (!Number.isFinite(ts)) return "";
  const diff = ts - Date.now();
  if (diff <= 0) return "now";
  const totalMinutes = Math.floor(diff / 60000);
  if (totalMinutes < 60) return `in ${totalMinutes}m`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours < 24) {
    return minutes > 0 ? `in ${hours}h ${minutes}m` : `in ${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  if (remHours > 0 && days < 3) {
    return `in ${days}d ${remHours}h`;
  }
  return `in ${days}d`;
}

function useWidgetHostChrome() {
  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const restore = {
      htmlBg: document.documentElement.style.background,
      bodyBg: document.body.style.background,
      bodyMargin: document.body.style.margin,
      bodyOverflow: document.body.style.overflow,
      scheme: document.documentElement.style.colorScheme,
    };
    document.documentElement.style.background = "transparent";
    document.body.style.background = "transparent";
    document.body.style.margin = "0";
    document.body.style.overflow = "hidden";
    document.documentElement.style.colorScheme = "dark";
    document.documentElement.classList.add("dark");
    return () => {
      document.documentElement.style.background = restore.htmlBg;
      document.body.style.background = restore.bodyBg;
      document.body.style.margin = restore.bodyMargin;
      document.body.style.overflow = restore.bodyOverflow;
      document.documentElement.style.colorScheme = restore.scheme;
      document.documentElement.classList.remove("dark");
    };
  }, []);
}

function useWidgetClock(intervalMs, load) {
  useEffect(() => {
    let active = true;
    const run = async () => {
      try {
        await load(active);
      } catch {
        // ignore widget polling failures
      }
    };
    run();
    const timerId = window.setInterval(run, intervalMs);
    return () => {
      active = false;
      window.clearInterval(timerId);
    };
  }, [intervalMs, load]);
}

function useViewportScale(baseWidth, baseHeight) {
  const calc = () => {
    if (typeof window === "undefined") return 1;
    return Math.min(window.innerWidth / baseWidth, window.innerHeight / baseHeight);
  };
  const [scale, setScale] = useState(calc);
  useEffect(() => {
    const onResize = () => setScale(calc());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [baseHeight, baseWidth]);
  return scale;
}

function useOverlayAppearance() {
  const [appearance, setAppearance] = useState({ opacity: 1, scale: 1, clickThrough: false });

  useWidgetClock(
    1500,
    useMemo(
      () => async (active) => {
        const config = await getOverlayConfig().catch(() => null);
        if (!active || !config?.appearance) return;
        setAppearance(config.appearance);
      },
      [],
    ),
  );

  return appearance;
}

function widgetSurfaceStyle(kind, opacity) {
  const clamped = Number.isFinite(opacity) ? Math.max(0.045, Math.min(1, opacity)) : 1;
  if (kind === "menubar") {
    return {
      border: `1px solid rgba(255,255,255,${0.1 * clamped + 0.04})`,
      background: `linear-gradient(180deg, rgba(38,38,43,${0.72 * clamped + 0.18}) 0%, rgba(31,31,35,${0.82 * clamped + 0.16}) 100%)`,
      boxShadow: `0 10px 22px rgba(0,0,0,${0.36 * clamped}), inset 0 1px 0 rgba(255,255,255,${0.05 * clamped + 0.02})`,
    };
  }
  return {
    border: `1px solid rgba(255,255,255,${0.1 * clamped + 0.04})`,
    background: `linear-gradient(180deg, rgba(37,37,41,${0.74 * clamped + 0.18}) 0%, rgba(28,28,30,${0.84 * clamped + 0.16}) 100%)`,
    boxShadow: `0 18px 36px rgba(0,0,0,${0.38 * clamped}), inset 0 1px 0 rgba(255,255,255,${0.05 * clamped + 0.02})`,
  };
}

function WidgetShell({ kind = "card", appearanceOpacity = 1, children }) {
  const base = kind === "menubar" ? BASE_SIZES.menubar : BASE_SIZES.card;
  const scale = useViewportScale(base.width, base.height);
  const radius = `${base.radius}px`;
  return (
    <div
      className="h-screen w-screen overflow-hidden bg-transparent select-none"
      style={{ WebkitAppRegion: "drag" }}
    >
      <div
        className="origin-top-left"
        style={{
          width: `${base.width}px`,
          height: `${base.height}px`,
          transform: `scale(${scale})`,
          borderRadius: radius,
          overflow: "hidden",
          background: "transparent",
          clipPath: `inset(0 round ${radius})`,
        }}
      >
        <div
          className={kind === "menubar" ? "h-full w-full overflow-hidden rounded-[14px]" : "h-full w-full overflow-hidden rounded-[24px]"}
          style={widgetSurfaceStyle(kind, appearanceOpacity)}
        >
          {children}
        </div>
      </div>
    </div>
  );
}

function useSummaryData() {
  const [summary, setSummary] = useState({
    today: null,
    week: null,
    month: null,
    hourly: [],
  });
  const timeZone = useMemo(() => getBrowserTimeZone(), []);
  const tzOffsetMinutes = useMemo(() => getBrowserTimeZoneOffsetMinutes(), []);

  useWidgetClock(
    5000,
    useMemo(
      () => async (active) => {
        const todayRange = getRangeForPeriod("day", { timeZone, offsetMinutes: tzOffsetMinutes });
        const weekRange = getRangeForPeriod("week", { timeZone, offsetMinutes: tzOffsetMinutes });
        const monthRange = getRangeForPeriod("month", { timeZone, offsetMinutes: tzOffsetMinutes });
        const todayDay = todayRange.to || todayRange.from;

        const [todayRes, weekRes, monthRes, hourlyRes] = await Promise.all([
          getUsageSummary({ ...todayRange, timeZone, tzOffsetMinutes }),
          getUsageSummary({ ...weekRange, timeZone, tzOffsetMinutes }),
          getUsageSummary({ ...monthRange, timeZone, tzOffsetMinutes }),
          getUsageHourly({ day: todayDay, timeZone, tzOffsetMinutes }),
        ]);

        if (!active) return;
        setSummary({
          today: todayRes?.totals || null,
          week: weekRes?.totals || null,
          month: monthRes?.totals || null,
          hourly: Array.isArray(hourlyRes?.data) ? hourlyRes.data : [],
        });
      },
      [timeZone, tzOffsetMinutes],
    ),
  );

  return summary;
}

function SummaryWidgetHost() {
  useWidgetHostChrome();
  const appearance = useOverlayAppearance();
  const summary = useSummaryData();
  const sparklinePath = useMemo(
    () => buildSparklinePath(buildHourlyTrendPoints(summary.hourly)),
    [summary.hourly],
  );

  return (
    <WidgetShell appearanceOpacity={appearance.opacity}>
      <div className="relative flex h-full flex-col justify-between px-[14px] pb-[12px] pt-[12px] text-white">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <div className="text-[8px] font-semibold tracking-[0.08em] text-white/55">TODAY</div>
            <div className="mt-1 text-[21px] font-bold leading-none tracking-[-0.04em]">
              {formatCompact(summary.today?.billable_total_tokens ?? summary.today?.total_tokens)}
            </div>
            <div className="mt-[5px] text-[8px] font-medium text-white/58">
              {formatUsd(summary.today?.total_cost_usd)}
            </div>
          </div>
          <div>
            <div className="text-[8px] font-semibold tracking-[0.08em] text-white/55">7 DAYS</div>
            <div className="mt-1 text-[21px] font-bold leading-none tracking-[-0.04em]">
              {formatCompact(summary.week?.billable_total_tokens ?? summary.week?.total_tokens)}
            </div>
            <div className="mt-[5px] text-[8px] font-medium text-white/58">
              {formatUsd(summary.week?.total_cost_usd)}
            </div>
          </div>
        </div>
        <svg viewBox="0 0 264 44" className="absolute bottom-[8px] left-0 right-0 h-[44px] w-full">
          <path
            d={sparklinePath}
            fill="none"
            stroke="#3478F6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </WidgetShell>
  );
}

function HeatmapWidgetHost() {
  useWidgetHostChrome();
  const appearance = useOverlayAppearance();
  const [cells, setCells] = useState([]);
  const [meta, setMeta] = useState({ activeDays: 0, totalTokens: 0 });

  useWidgetClock(
    5000,
    useMemo(
      () => async (active) => {
        const res = await getUsageHeatmap({ weeks: 4, weekStartsOn: "sun" });
        if (!active) return;
        const nextCells = Array.isArray(res?.weeks) ? res.weeks.flat() : [];
        const totalTokens = nextCells
          .reduce((sum, cell) => sum + Number(cell?.billable_total_tokens ?? cell?.total_tokens ?? 0), 0);
        setCells(nextCells);
        setMeta({ activeDays: nextCells.filter((cell) => usageTokenValue(cell) > 0).length, totalTokens });
      },
      [],
    ),
  );

  const weeks = useMemo(() => {
    const emptyCell = { empty: true, level: 0 };
    const normalized = cells.slice(-28);
    const padded = [
      ...Array.from({ length: Math.max(0, 28 - normalized.length) }, () => emptyCell),
      ...normalized,
    ];
    const grouped = [];
    for (let index = 0; index < padded.length; index += 7) {
      grouped.push(padded.slice(index, index + 7));
    }
    return grouped;
  }, [cells]);

  return (
    <WidgetShell appearanceOpacity={appearance.opacity}>
      <div className="flex h-full flex-col justify-between px-[19px] pb-[15px] pt-[13px] text-white">
        <div className="flex justify-center">
          <div className="grid grid-flow-col grid-rows-7 gap-[1.5px]" style={{ gridAutoColumns: "7.5px" }}>
            {weeks.map((week, weekIndex) =>
              week.map((cell, dayIndex) => (
                <div
                  key={cell?.day || `empty-${weekIndex}-${dayIndex}`}
                  className="h-[7.5px] w-[7.5px] rounded-[1.5px] ring-1 ring-white/[0.03]"
                  style={{ background: heatmapFillForLevel(cell?.level) }}
                  title={cell?.day}
                />
              )),
            )}
          </div>
        </div>
        <div className="whitespace-nowrap text-[8px] leading-none text-white/62">
          <span className="mr-1 text-[10px] font-bold text-white">
            {formatCompact(meta.totalTokens)}
          </span>
          tokens · {meta.activeDays} active days
        </div>
      </div>
    </WidgetShell>
  );
}

function TopModelsWidgetHost() {
  useWidgetHostChrome();
  const appearance = useOverlayAppearance();
  const [models, setModels] = useState([]);

  useWidgetClock(
    5000,
    useMemo(
      () => async (active) => {
        const timeZone = getBrowserTimeZone();
        const tzOffsetMinutes = getBrowserTimeZoneOffsetMinutes();
        const range = getRangeForPeriod("month", { timeZone, offsetMinutes: tzOffsetMinutes });
        const res = await getUsageModelBreakdown({ ...range, timeZone, tzOffsetMinutes });
        if (!active) return;
        setModels(buildTopModels(res, { limit: 4, copyFn: copy }));
      },
      [],
    ),
  );

  return (
    <WidgetShell appearanceOpacity={appearance.opacity}>
      <div className="flex h-full flex-col justify-center px-[15px] py-[12px] text-white">
        <div className="space-y-[7px]">
          {models.slice(0, 4).map((model, index) => {
            const color = MODEL_COLORS[index % MODEL_COLORS.length];
            const pct = Number(model?.percent || 0);
            return (
              <div key={model.id || model.name} className="relative isolate space-y-[4px]">
                <div className="relative z-20 grid grid-cols-[minmax(0,1fr)_47px_30px] items-center gap-[5px] text-[10.5px] leading-[13px]">
                  <div className="flex min-w-0 items-center gap-[6px] py-[1px]">
                  <span
                    className="h-[6px] w-[6px] rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="min-w-0 truncate font-semibold text-white/92 leading-[13px]">
                    {middleEllipsis(model.name, 20)}
                  </span>
                  </div>
                  <span className="shrink-0 font-semibold text-white/84">
                    {formatCompact(model.tokens)}
                  </span>
                  <span className="w-[30px] shrink-0 text-right text-[9.5px] font-medium text-white/58">
                    {pct}%
                  </span>
                </div>
                <div className="relative z-0 ml-[12px] h-[3px] rounded-full bg-white/18">
                  <div
                    className="h-[3px] rounded-full"
                    style={{
                      width: `${Math.max(2, Math.min(100, pct))}%`,
                      background: color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </WidgetShell>
  );
}

function LimitsWidgetHost() {
  useWidgetHostChrome();
  const appearance = useOverlayAppearance();
  const [rows, setRows] = useState([]);

  const buildLimitRows = (res) => {
    const specs = [
      {
        label: "Codex · 5h",
        source: "codex",
        pct: Number(res?.codex?.primary_window?.used_percent || 0),
        reset: formatLimitReset(res?.codex?.primary_window?.reset_at),
      },
      {
        label: "Codex · 7d",
        source: "codex",
        pct: Number(res?.codex?.secondary_window?.used_percent || 0),
        reset: formatLimitReset(res?.codex?.secondary_window?.reset_at),
      },
      {
        label: "Claude · 5h",
        source: "claude",
        pct: Number(res?.claude?.five_hour?.utilization || 0),
        reset: formatLimitReset(res?.claude?.five_hour?.resets_at),
      },
      {
        label: "Claude · 7d",
        source: "claude",
        pct: Number(res?.claude?.seven_day?.utilization || 0),
        reset: formatLimitReset(res?.claude?.seven_day?.resets_at),
      },
    ];

    return specs.map((row) => ({
      ...row,
      pct: Number.isFinite(row.pct) ? row.pct : 0,
      reset: row.reset || "",
    }));
  };

  useWidgetClock(
    5000,
    useMemo(
      () => async (active) => {
        const res = await getUsageLimits();
        if (!active) return;
        setRows(buildLimitRows(res));
      },
      [],
    ),
  );

  return (
    <WidgetShell appearanceOpacity={appearance.opacity}>
      <div className="flex h-full flex-col justify-center px-[16px] py-[14px] text-white">
        {rows.length > 0 ? (
          <div className="space-y-[7px]">
            {rows.map((row, index) => {
              const pct = Math.round(Number(row.pct || 0));
              const fill = limitBarFill(Math.max(0, Math.min(1, pct / 100)));
              return (
                <div key={`${row.label}-${index}`} className="relative isolate space-y-[4px]">
                  <div className="relative z-20 flex items-center gap-[6px] text-[10.5px] leading-[13px]">
                    <span
                      className="h-[6px] w-[6px] rounded-full shrink-0"
                      style={{ background: SOURCE_COLORS[row.source] || "#0A84FF" }}
                    />
                    <span className="min-w-0 flex-1 truncate font-semibold text-white/90">
                      {row.label}
                    </span>
                    <span className="shrink-0 text-[9.5px] font-medium text-white/56">
                      {row.reset}
                    </span>
                    <span className="w-[30px] shrink-0 text-right font-semibold text-white/88">
                      {pct}%
                    </span>
                  </div>
                  <div className="relative z-0 h-[3px] rounded-full bg-white/18">
                    <div
                      className="h-[3px] rounded-full"
                      style={{
                        width: `${Math.max(2, pct)}%`,
                        background: fill,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
            <div className="space-y-[10px]">
            <div className="text-[14px] font-semibold tracking-[-0.02em] text-white">
              No Usage Limits
            </div>
            <div className="max-w-[188px] text-[9px] leading-[1.45] text-white/52">
              Configure providers in the dashboard to show limit windows here.
            </div>
          </div>
        )}
      </div>
    </WidgetShell>
  );
}

function MenuBarWidgetHost() {
  useWidgetHostChrome();
  const appearance = useOverlayAppearance();
  const summary = useSummaryData();
  const [overlayConfig, setOverlayConfig] = useState(null);
  const [limits, setLimits] = useState(null);
  const [clawdMeasure, setClawdMeasure] = useState(null);

  useWidgetClock(
    5000,
    useMemo(
      () => async (active) => {
        const [overlayRes, limitsRes] = await Promise.all([
          getOverlayConfig(),
          getUsageLimits().catch(() => null),
        ]);
        if (!active) return;
        setOverlayConfig(overlayRes);
        setLimits(limitsRes);
      },
      [],
    ),
  );

  const menuBar = overlayConfig?.menuBar || { items: ["todayTokens", "todayCost"], showStats: true, animatedIcon: true };

  const limitValues = {
    claude5h: `${Math.round(Number(limits?.claude?.five_hour?.utilization || 0))}%`,
    claude7d: `${Math.round(Number(limits?.claude?.seven_day?.utilization || 0))}%`,
    codex5h: `${Math.round(Number(limits?.codex?.primary_window?.used_percent || 0))}%`,
    codex7d: `${Math.round(Number(limits?.codex?.secondary_window?.used_percent || 0))}%`,
  };

  const valueMap = {
    todayTokens: { value: formatCompact(summary.today?.billable_total_tokens ?? summary.today?.total_tokens), label: "TOKENS" },
    todayCost: { value: formatUsd(summary.today?.total_cost_usd), label: "COST" },
    last7dTokens: { value: formatCompact(summary.week?.billable_total_tokens ?? summary.week?.total_tokens), label: "7 DAYS" },
    totalTokens: { value: formatCompact(summary.month?.billable_total_tokens ?? summary.month?.total_tokens), label: "30 DAYS" },
    totalCost: { value: formatUsd(summary.month?.total_cost_usd), label: "30D COST" },
    claude5h: { value: limitValues.claude5h, label: "CL 5H" },
    claude7d: { value: limitValues.claude7d, label: "CL 7D" },
    codex5h: { value: limitValues.codex5h, label: "CX 5H" },
    codex7d: { value: limitValues.codex7d, label: "CX 7D" },
  };

  const displayItems = Array.isArray(menuBar.items) && menuBar.items.length > 0
    ? menuBar.items.slice(0, 2)
    : ["todayTokens", "todayCost"];
  const clawdState = resolveMenuBarClawdState({
    todayTokens: Number(summary.today?.billable_total_tokens ?? summary.today?.total_tokens ?? 0),
    isSyncing: false,
    hasError: false,
    isDisconnected: false,
    config: menuBar.clawd,
  });
  const clawdPresentation = getMenuBarClawdPresentation(clawdState);
  const adaptiveScale = useMemo(() => {
    const widthRatio = Number(clawdMeasure?.contentWidthRatio || 1);
    const heightRatio = Number(clawdMeasure?.contentHeightRatio || 1);
    const occupancy = Math.max(widthRatio, heightRatio);
    if (!Number.isFinite(occupancy) || occupancy <= 0) return 1;
    const fitBoost = Math.min(1.45, Math.max(1, 0.84 / occupancy));
    return fitBoost;
  }, [clawdMeasure]);

  return (
    <WidgetShell kind="menubar" appearanceOpacity={appearance.opacity}>
      <div className="flex h-full items-center justify-center px-[10px] text-white">
        <div className="inline-flex items-stretch">
          <div className="relative z-20 flex items-center pl-[6px] pr-[7px]">
            {menuBar.animatedIcon ? (
              <div
                className="flex h-[44px] w-[62px] items-center justify-center overflow-visible"
                style={{
                  transform: `translate(${clawdPresentation.offsetX + 4}px, ${clawdPresentation.offsetY}px) scale(${clawdPresentation.scale * adaptiveScale})`,
                  transformOrigin: "center center",
                }}
              >
                <ClawdAnimated
                  state={clawdState}
                  size={clawdPresentation.size}
                  cropPadding={clawdPresentation.cropPadding}
                  onMeasure={setClawdMeasure}
                  className="shrink-0"
                />
              </div>
            ) : (
              <img
                src="/clawd/mini/idle-tight.svg"
                alt=""
                className="block h-[50px] w-auto shrink-0"
                draggable="false"
                style={{ opacity: 0.92 }}
              />
            )}
          </div>
          {menuBar.showStats ? (
            <div className="relative z-10 inline-flex items-stretch">
              {displayItems.map((itemId, index) => {
                const item = valueMap[itemId] || { value: "--", label: "ITEM" };
                return (
                  <React.Fragment key={itemId}>
                    {index === 0 ? <div className="my-[11px] mr-[7px] w-px bg-white/16" /> : null}
                    {index > 0 ? <div className="my-[11px] mx-[7px] w-px bg-white/16" /> : null}
                    <div
                      className={
                        index === 0
                          ? "flex min-w-[50px] flex-col items-center justify-center pb-[7px] pt-[8px] pr-[2px]"
                          : "flex min-w-[60px] -translate-x-[6px] flex-col items-center justify-center pb-[7px] pt-[8px] pl-[1px] pr-[14px]"
                      }
                    >
                      <div className="text-[15px] font-bold leading-none text-white">{item.value}</div>
                      <div className="mt-[2px] text-[6px] font-semibold uppercase leading-none text-white/72">
                        {item.label}
                      </div>
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </WidgetShell>
  );
}

export function WidgetHostPage({ kind }) {
  if (kind === "menubar") return <MenuBarWidgetHost />;
  if (kind === "heatmap") return <HeatmapWidgetHost />;
  if (kind === "topModels") return <TopModelsWidgetHost />;
  if (kind === "limits") return <LimitsWidgetHost />;
  return <SummaryWidgetHost />;
}

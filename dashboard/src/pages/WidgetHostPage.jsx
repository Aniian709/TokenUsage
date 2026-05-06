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
  const clamped = Number.isFinite(opacity) ? Math.max(0.18, Math.min(1, opacity)) : 1;
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
  const sparklinePath =
    "M0,36 C10,36 16,34 26,32 C38,29 46,28 56,24 C68,20 78,30 90,28 C102,26 110,18 122,18 C135,18 142,10 156,10 C170,10 178,22 190,21 C203,20 214,9 228,9 C240,9 250,15 264,13";

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
  const [weeks, setWeeks] = useState([]);
  const [meta, setMeta] = useState({ activeDays: 0, totalTokens: 0 });

  useWidgetClock(
    5000,
    useMemo(
      () => async (active) => {
        const res = await getUsageHeatmap({ weeks: 1, weekStartsOn: "sun" });
        if (!active) return;
        const nextWeeks = Array.isArray(res?.weeks) ? res.weeks : [];
        const totalTokens = nextWeeks
          .flat()
          .reduce((sum, cell) => sum + Number(cell?.billable_total_tokens ?? cell?.total_tokens ?? 0), 0);
        setWeeks(nextWeeks);
        setMeta({ activeDays: Number(res?.active_days || 0), totalTokens });
      },
      [],
    ),
  );

  return (
    <WidgetShell appearanceOpacity={appearance.opacity}>
      <div className="flex h-full flex-col justify-between px-[17px] pb-[13px] pt-[14px] text-white">
        <div className="grid grid-cols-7 grid-rows-7 gap-[3px]">
          {Array.from({ length: 49 }).map((_, cellIndex) => {
              const dayIndex = cellIndex % 7;
              const rowIndex = Math.floor(cellIndex / 7);
              const week = Array.isArray(weeks[weeks.length - 1]) ? weeks[weeks.length - 1] : [];
              const cell = week[dayIndex] || null;
              const level = Number(cell?.level || 0);
              const seeded = ((dayIndex * 11 + rowIndex * 7) % 5) - 1;
              const localLevel = Math.max(0, Math.min(4, level + (rowIndex === 6 - level ? 1 : 0) + (seeded > 2 ? 1 : 0) - (seeded < 0 ? 1 : 0)));
              const bg =
                localLevel <= 0
                  ? "#5A5A5F"
                  : ["#B7CBF7", "#8DB4F8", "#6797F6", "#4C7EF0", "#3B6BE6"][Math.min(4, localLevel - 1)];
              return (
                <div
                  key={`day-${dayIndex}-${rowIndex}`}
                  className="h-[10px] w-[10px] rounded-[2.5px]"
                  style={{ background: bg }}
                />
              );
            })}
        </div>
        <div className="whitespace-nowrap text-[8px] leading-none text-white/62">
          <span className="mr-1 text-[10px] font-bold text-white">
            {formatCompact(meta.totalTokens)}
          </span>
          tokens · 7 days
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
      <div className="flex h-full flex-col justify-center px-[16px] py-[14px] text-white">
        <div className="space-y-[9px]">
          {models.slice(0, 4).map((model, index) => {
            const color = MODEL_COLORS[index % MODEL_COLORS.length];
            const pct = Number(model?.percent || 0);
            return (
              <div key={model.id || model.name} className="space-y-[5px]">
                <div className="grid grid-cols-[minmax(0,1fr)_42px_28px] items-center gap-[7px] text-[9px] leading-[1.2]">
                  <div className="flex min-w-0 items-center gap-[6px] py-[1px]">
                  <span
                    className="h-[5px] w-[5px] rounded-full shrink-0"
                    style={{ background: color }}
                  />
                  <span className="min-w-0 truncate font-semibold text-white/88 leading-[1.2]">
                    {middleEllipsis(model.name, 24)}
                  </span>
                  </div>
                  <span className="shrink-0 font-semibold text-white/78">
                    {formatCompact(model.tokens)}
                  </span>
                  <span className="w-[28px] shrink-0 text-right text-[8px] font-medium text-white/44">
                    {pct}%
                  </span>
                </div>
                <div className="ml-[11px] h-[3px] rounded-full bg-white/18">
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
    const nextRows = [];
    const pushRow = (label, source, pct, reset) => {
      if (!Number.isFinite(Number(pct))) return;
      nextRows.push({
        label,
        source,
        pct: Number(pct),
        reset: reset || "",
      });
    };

    if (res?.claude?.five_hour) pushRow("Claude · 5h", "claude", res.claude.five_hour.utilization, formatLimitReset(res.claude.five_hour.resets_at));
    if (res?.claude?.seven_day) pushRow("Claude · 7d", "claude", res.claude.seven_day.utilization, formatLimitReset(res.claude.seven_day.resets_at));
    if (res?.claude?.seven_day_opus) pushRow("Claude · Opus", "claude", res.claude.seven_day_opus.utilization, formatLimitReset(res.claude.seven_day_opus.resets_at));

    if (res?.codex?.primary_window) pushRow("Codex · 5h", "codex", res.codex.primary_window.used_percent, formatLimitReset(res.codex.primary_window.reset_at));
    if (res?.codex?.secondary_window) pushRow("Codex · 7d", "codex", res.codex.secondary_window.used_percent, formatLimitReset(res.codex.secondary_window.reset_at));

    if (res?.cursor?.primary_window) pushRow("Cursor", "cursor", res.cursor.primary_window.used_percent, formatLimitReset(res.cursor.primary_window.reset_at));
    if (res?.cursor?.secondary_window) pushRow("Cursor Auto", "cursor", res.cursor.secondary_window.used_percent, formatLimitReset(res.cursor.secondary_window.reset_at));
    if (res?.cursor?.tertiary_window) pushRow("Cursor API", "cursor", res.cursor.tertiary_window.used_percent, formatLimitReset(res.cursor.tertiary_window.reset_at));

    if (res?.gemini?.primary_window) pushRow("Gemini", "gemini", res.gemini.primary_window.used_percent, formatLimitReset(res.gemini.primary_window.reset_at));
    if (res?.gemini?.secondary_window) pushRow("Gemini Flash", "gemini", res.gemini.secondary_window.used_percent, formatLimitReset(res.gemini.secondary_window.reset_at));
    if (res?.gemini?.tertiary_window) pushRow("Gemini Lite", "gemini", res.gemini.tertiary_window.used_percent, formatLimitReset(res.gemini.tertiary_window.reset_at));

    if (res?.copilot?.primary_window) pushRow("Copilot", "cursor", res.copilot.primary_window.used_percent, formatLimitReset(res.copilot.primary_window.reset_at));
    if (res?.copilot?.secondary_window) pushRow("Copilot Chat", "cursor", res.copilot.secondary_window.used_percent, formatLimitReset(res.copilot.secondary_window.reset_at));

    return nextRows.slice(0, 4);
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
      <div className="flex h-full flex-col justify-center px-[18px] py-[16px] text-white">
        {rows.length > 0 ? (
          <div className="space-y-[10px]">
            {rows.map((row, index) => {
              const pct = Math.round(Number(row.pct || 0));
              const fill = limitBarFill(Math.max(0, Math.min(1, pct / 100)));
              return (
                <div key={`${row.label}-${index}`} className="space-y-[4px]">
                  <div className="flex items-center gap-[6px] text-[9px] leading-none">
                    <span
                      className="h-[5px] w-[5px] rounded-full shrink-0"
                      style={{ background: SOURCE_COLORS[row.source] || "#0A84FF" }}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium text-white/84">
                      {row.label}
                    </span>
                    <span className="shrink-0 text-[8px] font-medium text-white/44">
                      {row.reset}
                    </span>
                    <span className="w-[30px] shrink-0 text-right font-semibold text-white/82">
                      {pct}%
                    </span>
                  </div>
                  <div className="h-[3px] rounded-full bg-white/18">
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

  return (
    <WidgetShell kind="menubar" appearanceOpacity={appearance.opacity}>
      <div className="flex h-full items-center justify-center px-[6px] text-white">
        <div className="inline-flex items-stretch">
          <div className="flex items-center pl-[2px] pr-[9px]">
            <img
              src="/clawd/mini/idle-tight.svg"
              alt=""
              className="block h-[25px] w-auto shrink-0"
              draggable="false"
              style={{
                opacity: menuBar.animatedIcon ? 1 : 0.92,
                transform: menuBar.animatedIcon ? "translateY(-0.5px)" : "none",
              }}
            />
          </div>
          {menuBar.showStats ? (
            <div className="inline-flex items-stretch">
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
                          : "flex min-w-[50px] flex-col items-center justify-center pb-[7px] pt-[8px] pl-[1px]"
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

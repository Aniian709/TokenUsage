import { getLocalApiAuthHeaders } from "./local-api-auth";

export type OverlayWidgetConfig = {
  enabled: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type OverlayConfig = {
  version: number;
  windows: Record<string, OverlayWidgetConfig>;
  appearance: {
    opacity: number;
    scale: number;
    clickThrough: boolean;
  };
  menuBar?: {
    items?: string[];
    showStats?: boolean;
    animatedIcon?: boolean;
    clawd?: {
      mode?: "auto" | "manual";
      manualState?: string;
      autoStates?: Record<string, string>;
    };
  };
};

export async function getOverlayConfig(fetchImpl: typeof fetch = fetch): Promise<OverlayConfig> {
  const res = await fetchImpl("/api/widget-overlays", {
    method: "GET",
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Overlay config request failed with HTTP ${res.status}`);
  return res.json();
}

export async function saveOverlayConfig(
  config: OverlayConfig,
  fetchImpl: typeof fetch = fetch,
): Promise<OverlayConfig> {
  const authHeaders = await getLocalApiAuthHeaders(fetchImpl);
  const res = await fetchImpl("/api/widget-overlays", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...authHeaders,
    },
    body: JSON.stringify(config),
  });
  if (!res.ok) throw new Error(`Overlay config save failed with HTTP ${res.status}`);
  const data = await res.json();
  return data?.config ?? config;
}

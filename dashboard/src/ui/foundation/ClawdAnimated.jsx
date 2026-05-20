import React, { useState, useEffect, useRef } from "react";
import { CLAWD_STATE_TO_PATH, CLAWD_STATES } from "../../lib/clawd-animations.js";

/** Module-level SVG text cache */
const svgCache = new Map();

async function fetchSvg(path) {
  if (svgCache.has(path)) return svgCache.get(path);
  const resp = await fetch(`/clawd/${path}`);
  if (!resp.ok) return null;
  const raw = await resp.text();
  // Strip fixed width/height so SVG scales to container, keep viewBox
  const result = raw.replace(/<svg([^>]*)>/, (_match, attrs) => {
    const cleaned = attrs
      .replace(/\s+width="[^"]*"/g, "")
      .replace(/\s+height="[^"]*"/g, "");
    return `<svg${cleaned} width="100%" height="100%">`;
  });
  svgCache.set(path, result);
  return result;
}

/**
 * Clawd animated SVG component.
 * Inlines SVG so CSS @keyframes animations work natively.
 *
 * @param {string} state - Animation state name (e.g. "idle-living", "working-typing")
 * @param {number} size - Display size in pixels
 * @param {string} className - Additional CSS classes
 */
export function ClawdAnimated({
  state = "idle-living",
  size = 48,
  className = "",
  crop = true,
  cropPadding = 2,
  onMeasure,
  respectReducedMotion = true,
}) {
  const [svgHtml, setSvgHtml] = useState("");
  const containerRef = useRef(null);
  const reducedMotion = useReducedMotion();

  const effectiveState = respectReducedMotion && reducedMotion ? "static-base" : state;
  const path = CLAWD_STATE_TO_PATH[effectiveState] || CLAWD_STATE_TO_PATH["static-base"];

  useEffect(() => {
    let cancelled = false;
    fetchSvg(path).then((html) => {
      if (!cancelled && html) setSvgHtml(html);
    });
    return () => { cancelled = true; };
  }, [path]);

  // Crop viewBox to actual content bbox so the character fills the container
  useEffect(() => {
    const svg = containerRef.current?.querySelector("svg");
    if (!svg) return;
    try {
      const bbox = svg.getBBox();
      const originalViewBox = svg.getAttribute("viewBox");
      let viewWidth = 0;
      let viewHeight = 0;
      if (originalViewBox) {
        const parts = originalViewBox.trim().split(/\s+/).map(Number);
        viewWidth = Number(parts[2] || 0);
        viewHeight = Number(parts[3] || 0);
      }
      if (bbox.width > 0 && bbox.height > 0 && crop) {
        svg.setAttribute(
          "viewBox",
          `${bbox.x - cropPadding} ${bbox.y - cropPadding} ${bbox.width + cropPadding * 2} ${bbox.height + cropPadding * 2}`,
        );
      }
      if (typeof onMeasure === "function" && bbox.width > 0 && bbox.height > 0) {
        onMeasure({
          bbox,
          viewWidth,
          viewHeight,
          contentWidthRatio: viewWidth > 0 ? bbox.width / viewWidth : 1,
          contentHeightRatio: viewHeight > 0 ? bbox.height / viewHeight : 1,
        });
      }
    } catch {
      // Some SVGs do not expose getBBox until fully rendered.
    }
    return undefined;
  }, [crop, cropPadding, onMeasure, svgHtml]);

  return (
    <div
      ref={containerRef}
      className={`clawd-animated ${className}`}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
      dangerouslySetInnerHTML={{ __html: svgHtml }}
    />
  );
}

/** All available animation state names */
export { CLAWD_STATES };

function useReducedMotion() {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = (e) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}

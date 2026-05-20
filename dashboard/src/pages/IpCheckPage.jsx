import React, { useState } from "react";

const CLAUDE_IP_CHECK_URL = "https://ip.net.coffee/claude/";

export default function IpCheckPage() {
  const [loaded, setLoaded] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  React.useEffect(() => {
    if (loaded) return undefined;
    const timer = window.setTimeout(() => setTimedOut(true), 5000);
    return () => window.clearTimeout(timer);
  }, [loaded]);

  return (
    <div className="h-full relative overflow-hidden dark:bg-[#050505]">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-oai-gray-200 bg-white/95 p-5 text-center shadow-sm dark:border-oai-gray-800 dark:bg-oai-gray-900/95">
            <div className="mx-auto mb-4 h-9 w-9 animate-pulse rounded-full bg-oai-gray-200 dark:bg-oai-gray-800" />
            <div className="text-sm font-semibold text-oai-black dark:text-white">
              正在加载 Claude IP 检查
            </div>
            <div className="mt-2 text-xs leading-5 text-oai-gray-500 dark:text-oai-gray-400">
              如果内嵌页面被浏览器或第三方站点策略拦截，可以直接在新标签页打开。
            </div>
            {timedOut ? (
              <a
                href={CLAUDE_IP_CHECK_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex rounded-lg bg-oai-black px-3 py-2 text-xs font-semibold text-white transition-opacity hover:opacity-85 dark:bg-white dark:text-oai-black"
              >
                新标签页打开 ip.net.coffee
              </a>
            ) : null}
          </div>
        </div>
      )}
      <iframe
        src={CLAUDE_IP_CHECK_URL}
        title="Cloud AI IP Check"
        className={`w-full h-full dark:invert dark:hue-rotate-180 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ border: "none" }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

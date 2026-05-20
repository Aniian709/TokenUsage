import React, { useState } from "react";

const IP_CHECK_URL = "/api/ip-check/claude";

export default function IpCheckPage() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="h-full relative overflow-hidden dark:bg-[#050505]">
      {!loaded && (
        <div className="absolute inset-0 z-10 flex items-center justify-center p-6">
          <div className="w-full max-w-md rounded-2xl border border-oai-gray-200 bg-white/95 p-5 text-center shadow-sm dark:border-oai-gray-800 dark:bg-oai-gray-900/95">
            <div className="mx-auto mb-4 h-9 w-9 animate-pulse rounded-full bg-oai-gray-200 dark:bg-oai-gray-800" />
            <div className="text-sm font-semibold text-oai-black dark:text-white">
              正在加载 IP 检测
            </div>
            <div className="mt-2 text-xs leading-5 text-oai-gray-500 dark:text-oai-gray-400">
              正在通过本地代理加载 ip.net.coffee，避免第三方页面拒绝 iframe 嵌入。
            </div>
          </div>
        </div>
      )}
      <iframe
        src={IP_CHECK_URL}
        title="IP Check"
        className={`w-full h-full dark:invert dark:hue-rotate-180 transition-opacity duration-300 ${loaded ? "opacity-100" : "opacity-0"}`}
        style={{ border: "none" }}
        onLoad={() => setLoaded(true)}
      />
    </div>
  );
}

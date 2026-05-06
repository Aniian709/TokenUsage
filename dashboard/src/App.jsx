import React, { useMemo } from "react";
import { useLocation } from "react-router-dom";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ErrorBoundary } from "./components/ErrorBoundary.jsx";
import { LoginModalProvider } from "./contexts/LoginModalContext.jsx";
import { useLocale } from "./hooks/useLocale.js";
import { ThemeProvider } from "./ui/foundation/ThemeProvider.jsx";
import { getBackendBaseUrl } from "./lib/config";
import { isScreenshotModeEnabled } from "./lib/screenshot-mode";
import { DashboardPage } from "./pages/DashboardPage.jsx";
import IpCheckPage from "./pages/IpCheckPage.jsx";
import { LimitsPage } from "./pages/LimitsPage.jsx";
import { SettingsPage } from "./pages/SettingsPage.jsx";
import { SkillsPage } from "./pages/SkillsPage.jsx";
import { WidgetHostPage } from "./pages/WidgetHostPage.jsx";
import { AppLayout } from "./ui/openai/components/Sidebar.jsx";
import { WidgetsPage } from "./pages/WidgetsPage.jsx";

export default function App() {
  const { resolvedLocale } = useLocale();
  const location = useLocation();
  const pathname = location?.pathname || "/";
  const normalizedPath = pathname.replace(/\/+$/, "") || "/";
  const screenshotMode = useMemo(() => {
    if (typeof window === "undefined") return false;
    return isScreenshotModeEnabled(window.location.search);
  }, []);
  const baseUrl = getBackendBaseUrl();

  const isLimitsPath = normalizedPath === "/limits";
  const isSettingsPath = normalizedPath === "/settings";
  const isSkillsPath = normalizedPath === "/skills";
  const isWidgetsPath = normalizedPath === "/widgets";
  const widgetHostMatch = normalizedPath.match(/^\/widget-host\/([^/]+)$/i);
  const widgetHostKind = widgetHostMatch ? widgetHostMatch[1] : null;
  const isIpCheckPath = normalizedPath === "/ip-check";

  let PageComponent = DashboardPage;
  if (widgetHostKind) {
    PageComponent = null;
  } else if (isLimitsPath) {
    PageComponent = LimitsPage;
  } else if (isSettingsPath) {
    PageComponent = SettingsPage;
  } else if (isSkillsPath) {
    PageComponent = SkillsPage;
  } else if (isWidgetsPath) {
    PageComponent = WidgetsPage;
  } else if (isIpCheckPath) {
    PageComponent = IpCheckPage;
  }

  const content = widgetHostKind ? (
    <WidgetHostPage kind={widgetHostKind} />
  ) : (
    <AppLayout>
      <PageComponent
        key={resolvedLocale}
        baseUrl={baseUrl}
        auth={null}
        signedIn
        sessionSoftExpired={false}
        signOut={() => Promise.resolve()}
        publicMode={false}
        publicToken={null}
        signInUrl="/dashboard"
        signUpUrl="/dashboard"
        screenshotMode={screenshotMode}
      />
    </AppLayout>
  );

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <LoginModalProvider>
          {content}
          <Analytics />
          <SpeedInsights />
        </LoginModalProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

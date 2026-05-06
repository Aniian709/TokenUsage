# TokenUsage

Local token usage dashboard for `Codex` and `Claude Code`, adapted for Windows desktop use.

This repository contains the version currently used locally:
- local-only dashboard
- no login flow
- no leaderboard
- historical usage persistence
- Windows desktop floating widgets

## GitHub

- Repository: [Aniian709/TokenUsage](https://github.com/Aniian709/TokenUsage)
- Issues: [GitHub Issues](https://github.com/Aniian709/TokenUsage/issues)

## Requirements

- Windows
- Node.js 20+

## Quick Start

1. Install dependencies in the project root:

```powershell
npm install
```

2. Start the local dashboard:

```powershell
node .\bin\tracker.js serve
```

3. Open in your browser:

```text
http://127.0.0.1:7680
```

## Optional Frontend Rebuild

The built dashboard is already included. Rebuild only if you modify frontend code:

```powershell
cd dashboard
npm install
npm run build
```

## Notes

- The app reads local session history from Codex and Claude Code.
- Desktop widgets are managed from the web dashboard.
- DNS, proxy, and network configuration are not required for the app itself, but may affect external AI tools.

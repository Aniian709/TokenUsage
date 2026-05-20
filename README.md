# TokenUsage

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.6.2-22c55e?style=for-the-badge" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0ea5e9?style=for-the-badge" />
  <img alt="Mode" src="https://img.shields.io/badge/mode-local--first-f97316?style=for-the-badge" />
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

`TokenUsage` is a local Windows dashboard for monitoring AI coding token usage. It reads local session history from tools such as `Codex` and `Claude Code`, stores a persistent local snapshot, and displays usage totals, cost estimates, model breakdowns, trend charts, heatmaps, usage limits, and desktop widgets.

This project is a Windows-focused adaptation and reconstruction inspired by [mm7894215/TokenTracker](https://github.com/mm7894215/TokenTracker).

Repository: [Aniian709/TokenUsage](https://github.com/Aniian709/TokenUsage)

Issues: [GitHub Issues](https://github.com/Aniian709/TokenUsage/issues)

## Contents

- [Features](#features)
- [System Requirements](#system-requirements)
- [Data and Privacy](#data-and-privacy)
- [Installation](#installation)
- [Startup Methods](#startup-methods)
- [Usage Guide](#usage-guide)
- [Configuration](#configuration)
- [File and Data Locations](#file-and-data-locations)
- [Common Commands](#common-commands)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Features

- Local token usage dashboard for Windows.
- `1d`, `7d`, `30d`, and all-time usage ranges.
- Token totals and estimated cost.
- Model usage ranking and percentage breakdown.
- Daily activity heatmap and trend chart.
- Local persistent history snapshot under `~/.tokenusage`.
- Windows desktop overlay widgets controlled from the dashboard.
- Optional usage limit display for supported providers when local credentials are available.
- Prebuilt frontend included in `dashboard/dist`, so normal users do not need to build the frontend.

## System Requirements

### Required

- Windows 10 or Windows 11.
- Node.js 20 or newer.
- npm, included with Node.js.

Check your versions:

```powershell
node -v
npm -v
```

### Recommended

- Latest stable Node.js 20 LTS or newer.
- A terminal that can run PowerShell or Command Prompt.
- Existing local history from `Codex` or `Claude Code` if you want usage data to appear immediately.

## Data and Privacy

TokenUsage is local-first.

- Usage data is read from local files on your machine.
- The local snapshot is stored under `C:\Users\<you>\.tokenusage`.
- The dashboard runs on `http://127.0.0.1:7680` by default.
- If a source session file is deleted after TokenUsage has scanned it, the recorded history remains in the local snapshot.
- If a source session file was deleted before TokenUsage ever scanned it, TokenUsage cannot recover that missing history from the local filesystem.

Typical local source locations:

```text
C:\Users\<you>\.codex\sessions\...
C:\Users\<you>\.codex\archived_sessions\...
C:\Users\<you>\.claude\projects\...
```

## Installation

### 1. Install Node.js

Install Node.js 20 or newer from:

[https://nodejs.org](https://nodejs.org)

After installation, reopen your terminal and verify:

```powershell
node -v
npm -v
```

### 2. Download TokenUsage

Use Git:

```powershell
git clone https://github.com/Aniian709/TokenUsage.git
cd TokenUsage
```

Or download the repository ZIP from GitHub, extract it, then open a terminal in the extracted `TokenUsage` folder.

### 3. Install Dependencies

Run this in the project root:

```powershell
npm install
```

This installs the local backend and desktop widget dependencies.

### 4. Optional: Create Desktop Shortcuts

Double-click:

```text
CreateDesktopShortcuts.cmd
```

This creates two shortcuts on your Windows desktop:

- `Token`: starts TokenUsage.
- `TokenStop`: stops the local service and desktop widget host.

If you move the project folder later, run `CreateDesktopShortcuts.cmd` again so the shortcuts point to the new location.

## Startup Methods

### Method 1: Start from Desktop Shortcut

If you created shortcuts:

```text
Double-click Token
```

To stop:

```text
Double-click TokenStop
```

### Method 2: Start from Project Folder

Double-click:

```text
TokenUsage.cmd
```

This starts TokenUsage in a normal Windows terminal window.

### Method 3: Start from Terminal

Run this in the project root:

```powershell
node .\bin\tracker.js serve
```

Then open:

```text
http://127.0.0.1:7680
```

### Use a Different Port

```powershell
node .\bin\tracker.js serve --port 7681
```

Then open:

```text
http://127.0.0.1:7681
```

## Usage Guide

### Dashboard

Open the dashboard in your browser:

```text
http://127.0.0.1:7680
```

The main dashboard shows:

- Token usage summary.
- Estimated cost.
- `1d`, `7d`, `30d`, and all-time range switching.
- Usage trend chart.
- Activity heatmap.
- Top model ranking.
- Daily detail table.

### Desktop Widgets

Open the `Widgets` page in the dashboard.

Available widget types include:

- Summary widget.
- Heatmap widget.
- Top Models widget.
- Usage Limits widget.
- Menu bar style floating widget.

The widgets are controlled from the web dashboard and displayed as Windows desktop overlays.

### Usage Limits

The usage limits panel depends on local provider/account data and network access.

Codex limits may require:

- Existing local Codex authentication.
- Working network access from Node.js.
- Proxy or DNS settings that allow the required API requests.

If credentials or network access are unavailable, usage statistics can still work while the limits panel may show an error.

### Historical Snapshot

TokenUsage scans local session files and stores parsed events in:

```text
C:\Users\<you>\.tokenusage\cache\session-history-cache.json
```

This snapshot is append/merge based. It is designed to preserve already-scanned history even if the original session files are later deleted.

## Configuration

### Required Configuration

For basic local usage statistics, there is usually no manual configuration.

TokenUsage automatically creates:

```text
C:\Users\<you>\.tokenusage\
C:\Users\<you>\.tokenusage\cache\
C:\Users\<you>\.tokenusage\tracker\
```

### Source Data Requirements

TokenUsage can only show usage that exists in local source files or has already been saved into the local snapshot.

Expected source examples:

```text
C:\Users\<you>\.codex\sessions\...
C:\Users\<you>\.codex\archived_sessions\...
C:\Users\<you>\.claude\projects\...
```

### Optional Environment Variables

Normal users usually do not need environment variables.

Advanced users may use standard Windows proxy variables if their network requires a proxy:

```powershell
setx HTTP_PROXY http://127.0.0.1:7890
setx HTTPS_PROXY http://127.0.0.1:7890
```

Restart the terminal after changing environment variables.

## File and Data Locations

### Project Files

```text
TokenUsage\
  bin\                         CLI entrypoint
  src\                         Local backend, parsers, pricing, widgets
  dashboard\src\               Frontend source code
  dashboard\dist\              Prebuilt frontend used at runtime
  CreateDesktopShortcuts.cmd   Creates Token and TokenStop desktop shortcuts
  TokenUsage.cmd               Starts TokenUsage from the project folder
  TokenUsageStop.cmd           Stops TokenUsage service and widget host
  package.json                 Node package metadata and scripts
  README.md                    English documentation
  README.zh-CN.md              Chinese documentation
```

### Runtime Data

```text
C:\Users\<you>\.tokenusage\
  cache\session-history-cache.json   Persistent local usage snapshot
  tracker\queue.jsonl                Local tracker queue/runtime data
  tracker\widget-host.pid            Desktop widget host process id
```

Runtime data is generated automatically. Do not commit it to Git.

## Common Commands

Start local dashboard:

```powershell
node .\bin\tracker.js serve
```

Start without opening the browser automatically:

```powershell
node .\bin\tracker.js serve --no-open
```

Use another port:

```powershell
node .\bin\tracker.js serve --port 7681
```

Sync local data manually:

```powershell
node .\bin\tracker.js sync
```

Check status:

```powershell
node .\bin\tracker.js status
```

Run diagnostics:

```powershell
node .\bin\tracker.js diagnostics
```

## Troubleshooting

### `npm install` Is Not Recognized

Node.js or npm is not installed, or the terminal was opened before Node.js was added to `PATH`.

Fix:

1. Install Node.js 20 or newer.
2. Close and reopen the terminal.
3. Run `node -v` and `npm -v` again.

### Dashboard Does Not Open

Try opening the URL manually:

```text
http://127.0.0.1:7680
```

If it still fails, start from terminal so you can read the error:

```powershell
node .\bin\tracker.js serve
```

### Port 7680 Is Already in Use

Start on another port:

```powershell
node .\bin\tracker.js serve --port 7681
```

Or run `TokenStop` if you created the desktop shortcut.

### No Usage Data Appears

Check these points:

- You have used `Codex` or `Claude Code` on this Windows account.
- Local history files exist under `.codex` or `.claude`.
- You started TokenUsage after those history files were created.
- The source files were not deleted before TokenUsage scanned them.

### Usage Numbers Differ from an API Gateway

TokenUsage reads local session history and local snapshots. A gateway may count requests at the API proxy layer. These two methods can differ because they observe different sources.

Common causes:

- Some conversations were deleted before TokenUsage scanned them.
- The gateway counts requests that are not present in local session files.
- The local tool records cached tokens, reasoning tokens, or model names differently.
- Pricing tables may differ between tools.

### `Codex` Usage Limits Show `fetch failed`

Common causes:

- Local Codex authentication is missing or expired.
- Node.js cannot reach the required API endpoint.
- Proxy, DNS, or firewall settings block the request.

Basic usage statistics can still work even if usage limits fail.

### Desktop Shortcut Opens the Wrong Folder

Run this again from the current project folder:

```text
CreateDesktopShortcuts.cmd
```

Windows shortcuts store absolute paths, so they must be recreated after moving the project folder.

## Development

### Frontend Development

The repository includes prebuilt frontend files in `dashboard/dist`.

Only rebuild the frontend if you edit files under `dashboard/src`:

```powershell
cd dashboard
npm install
npm run build
cd ..
```

### Release Checklist

Before publishing updates:

1. Update source files under `src` and `dashboard/src`.
2. Rebuild `dashboard/dist` if frontend code changed.
3. Run a basic local startup check.
4. Run `npm pack --dry-run` and confirm required files are included.
5. Commit source files and built assets together.

## License

MIT

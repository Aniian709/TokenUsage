# TokenUsage

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.6.2-22c55e?style=for-the-badge" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0ea5e9?style=for-the-badge" />
  <img alt="Mode" src="https://img.shields.io/badge/mode-local--first-f97316?style=for-the-badge" />
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

`TokenUsage` is a Windows-first local dashboard for tracking token usage from `Codex` and `Claude Code`.

It keeps the visual style of the original TokenUsage dashboard, but this repository is focused on local use:
- no login flow
- no leaderboard
- persisted local history
- Windows desktop floating widgets
- local usage limits, model breakdown, heatmap, and trend views

## Version Notes

- `v0.6.2` - Windows-first local dashboard, persisted history, widget overlays, and no login / no leaderboard.

Repository:
- [Aniian709/TokenUsage](https://github.com/Aniian709/TokenUsage)

Issues:
- [GitHub Issues](https://github.com/Aniian709/TokenUsage/issues)

## What This Project Does

`TokenUsage` reads local session history from tools such as:
- `Codex`
- `Claude Code`

It then renders:
- total token usage
- daily, 7-day, 30-day, and all-time views
- model usage ranking
- activity heatmap
- usage trend chart
- usage limits
- Windows desktop widgets

The project is local-first. Your dashboard data is read from local files on your machine.

## Supported Platform

- Windows 10 or Windows 11
- Node.js 20 or newer

## Folder Structure

Important folders:

- `bin/`
  CLI entry script
- `src/`
  local backend, session parsing, usage aggregation, widget host logic
- `dashboard/src/`
  frontend source code
- `dashboard/dist/`
  prebuilt frontend files included in this repository

## Install

### 1. Clone the repository

```powershell
git clone https://github.com/Aniian709/TokenUsage.git
cd TokenUsage
```

### 2. Install root dependencies

```powershell
npm install
```

This installs the local backend and desktop widget host dependencies.

### 3. Frontend dependencies

The repository already includes a built `dashboard/dist`, so for normal use you do not need to build the frontend again.

Only run this if you want to modify frontend code yourself:

```powershell
cd dashboard
npm install
npm run build
cd ..
```

## Start the App

Recommended for normal users:

```text
Double-click TokenUsage.cmd
```

It starts the local dashboard in a normal Windows terminal window and works regardless of where you place the project folder.

Manual alternative:

Run:

```powershell
node .\bin\tracker.js serve
```

Then open:

```text
http://127.0.0.1:7680
```

## How to Use

### Dashboard

After opening the local dashboard, you can view:
- `1d` usage
- `7d` usage
- `30d` usage
- all-time usage
- model breakdown
- daily detail table
- heatmap
- trend chart

### Desktop Widgets

Open the `Widgets` page in the dashboard.

From there you can enable:
- Summary widget
- Heatmap widget
- Top Models widget
- Usage Limits widget
- floating menu bar style widget

The widgets are Windows desktop overlays controlled from the web dashboard.

### Usage Limits

If your local environment has available provider/account data, the dashboard can display usage limits.

For `Codex`, limits may depend on local authentication and whether your local Node service can reach the required API through your network/proxy environment.

## Data Sources

This project reads local history from your machine and keeps local snapshots to preserve historical usage even if some original chat/session files are deleted later.

Examples of local sources include:
- `~/.codex/...`
- `~/.claude/...`
- local tracker cache under `~/.tokenusage/...`

## Rebuild the Frontend

If you edit frontend files in `dashboard/src`, rebuild with:

```powershell
cd dashboard
npm run build
cd ..
```

This updates:
- `dashboard/dist/index.html`
- `dashboard/dist/share.html`
- `dashboard/dist/assets/...`

## Common Commands

Start local dashboard:

```powershell
node .\bin\tracker.js serve
```

Sync local data manually:

```powershell
node .\bin\tracker.js sync
```

Check status:

```powershell
node .\bin\tracker.js status
```

## Troubleshooting

### Port 7680 is already in use

If you see a port conflict:

```text
Port 7680 is still in use after cleanup
```

Either close the old process or run on another port:

```powershell
node .\bin\tracker.js serve --port 7681
```

### Codex usage limits show `fetch failed`

This usually means one of these:
- local Codex authentication is missing or expired
- the local Node service cannot reach the required endpoint
- your Windows proxy or network tool is blocking that request

Check:
- whether your Codex local auth file exists
- whether your network/proxy settings allow the request
- whether restarting the local dashboard service fixes it

### No historical data appears

Check whether your local `Codex` or `Claude Code` history exists on disk. If you deleted old source session files before TokenUsage saved a local snapshot, those older records may not be recoverable.

## For Contributors

If you want to keep using this repository as a runnable project for other users:

1. update source code in `src/` and `dashboard/src/`
2. rebuild `dashboard/dist`
3. commit both source files and built assets together

That ensures users can clone the repository and use it directly without having to fix missing frontend output.

## License

MIT

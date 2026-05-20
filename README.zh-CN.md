# TokenUsage

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.6.2-22c55e?style=for-the-badge" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0ea5e9?style=for-the-badge" />
  <img alt="Mode" src="https://img.shields.io/badge/mode-local--first-f97316?style=for-the-badge" />
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

`TokenUsage` 是一个面向 Windows 本地环境的 AI Coding Token 用量监测面板。它会读取 `Codex`、`Claude Code` 等工具在本机生成的会话历史，保存本地历史快照，并展示 Token 总量、费用估算、模型占比、趋势图、热力图、使用限制和桌面小组件。

本项目参考并改造自 [mm7894215/TokenTracker](https://github.com/mm7894215/TokenTracker)，并针对 Windows 本地使用场景重新整理和实现。

仓库地址：[Aniian709/TokenUsage](https://github.com/Aniian709/TokenUsage)

问题反馈：[GitHub Issues](https://github.com/Aniian709/TokenUsage/issues)

## 目录

- [功能概览](#功能概览)
- [运行环境](#运行环境)
- [数据与隐私](#数据与隐私)
- [安装步骤](#安装步骤)
- [启动方式](#启动方式)
- [使用说明](#使用说明)
- [配置说明](#配置说明)
- [文件与数据目录](#文件与数据目录)
- [常用命令](#常用命令)
- [常见问题](#常见问题)
- [开发说明](#开发说明)
- [许可证](#许可证)

## 功能概览

- Windows 本地 Token 用量仪表盘。
- 支持 `1d`、`7d`、`30d`、总计等时间范围。
- 展示 Token 总量和预估费用。
- 展示模型用量排行和占比。
- 展示每日活跃热力图和使用趋势图。
- 在 `~/.tokenusage` 下保存本地历史快照。
- 支持由网页端控制的 Windows 桌面悬浮小组件。
- 本机具备相关账号数据和网络条件时，可显示部分 provider 的使用限制。
- 仓库已包含 `dashboard/dist` 构建产物，普通用户无需自行构建前端。

## 运行环境

### 必需环境

- Windows 10 或 Windows 11。
- Node.js 20 或更高版本。
- npm，随 Node.js 一起安装。

检查版本：

```powershell
node -v
npm -v
```

### 推荐环境

- 最新稳定版 Node.js 20 LTS 或更高版本。
- 可运行 PowerShell 或命令提示符的终端。
- 如果希望立刻看到统计数据，本机需要已有 `Codex` 或 `Claude Code` 的历史会话文件。

## 数据与隐私

TokenUsage 以本地使用为主。

- 用量数据从你电脑上的本地文件读取。
- 本地快照保存在 `C:\Users\<你的用户名>\.tokenusage`。
- 默认仪表盘地址为 `http://127.0.0.1:7680`。
- 如果某个原始会话文件已经被 TokenUsage 扫描过，之后你删除该文件，已记录的历史仍会保留在本地快照中。
- 如果某个原始会话文件在 TokenUsage 扫描之前就已经被删除，仅靠本地文件无法恢复这部分历史。

常见本地来源：

```text
C:\Users\<你的用户名>\.codex\sessions\...
C:\Users\<你的用户名>\.codex\archived_sessions\...
C:\Users\<你的用户名>\.claude\projects\...
```

## 安装步骤

### 1. 安装 Node.js

从以下地址安装 Node.js 20 或更高版本：

[https://nodejs.org](https://nodejs.org)

安装后重新打开终端，验证：

```powershell
node -v
npm -v
```

### 2. 下载 TokenUsage

使用 Git：

```powershell
git clone https://github.com/Aniian709/TokenUsage.git
cd TokenUsage
```

也可以在 GitHub 下载 ZIP，解压后在解压出的 `TokenUsage` 文件夹中打开终端。

### 3. 安装依赖

在项目根目录运行：

```powershell
npm install
```

这一步会安装本地后端和桌面小组件所需的依赖。

### 4. 可选：创建桌面快捷方式

双击：

```text
CreateDesktopShortcuts.cmd
```

它会在 Windows 桌面生成两个快捷方式：

- `Token`：启动 TokenUsage。
- `TokenStop`：停止本地服务和桌面小组件宿主。

如果以后移动了项目文件夹，请重新运行 `CreateDesktopShortcuts.cmd`，让快捷方式指向新的位置。

## 启动方式

### 方式一：桌面快捷方式启动

如果已经创建桌面快捷方式：

```text
双击 Token
```

停止：

```text
双击 TokenStop
```

### 方式二：项目文件夹内启动

双击：

```text
TokenUsage.cmd
```

它会用正常的 Windows 终端窗口启动 TokenUsage。

### 方式三：终端启动

在项目根目录运行：

```powershell
node .\bin\tracker.js serve
```

然后打开：

```text
http://127.0.0.1:7680
```

### 使用其他端口

```powershell
node .\bin\tracker.js serve --port 7681
```

然后打开：

```text
http://127.0.0.1:7681
```

## 使用说明

### 仪表盘

在浏览器中打开：

```text
http://127.0.0.1:7680
```

主仪表盘会展示：

- Token 用量概览。
- 预估费用。
- `1d`、`7d`、`30d`、总计范围切换。
- 使用趋势图。
- 活跃热力图。
- 热门模型排行。
- 每日明细表。

### 桌面小组件

进入仪表盘中的 `Widgets` 页面。

可用组件包括：

- Summary 概览组件。
- Heatmap 热力图组件。
- Top Models 热门模型组件。
- Usage Limits 使用限制组件。
- 菜单栏风格悬浮组件。

这些组件由网页端控制，实际以 Windows 桌面悬浮层形式显示。

### 使用限制

使用限制面板依赖本机 provider / account 数据和网络访问能力。

Codex 限额可能需要：

- 本机已有 Codex 认证。
- Node.js 能正常访问所需接口。
- 代理或 DNS 设置允许相关 API 请求。

如果认证或网络不可用，基础用量统计仍可工作，但使用限制面板可能显示错误。

### 历史快照

TokenUsage 会扫描本地会话文件，并把解析后的事件保存到：

```text
C:\Users\<你的用户名>\.tokenusage\cache\session-history-cache.json
```

该快照采用增量合并方式保存。已经扫描进入快照的历史，即使原始会话文件之后被删除，也会继续保留。

## 配置说明

### 必需配置

基础本地用量统计通常不需要手动配置。

TokenUsage 会自动创建：

```text
C:\Users\<你的用户名>\.tokenusage\
C:\Users\<你的用户名>\.tokenusage\cache\
C:\Users\<你的用户名>\.tokenusage\tracker\
```

### 数据来源要求

TokenUsage 只能展示本机源文件中存在的用量，或已经保存到本地快照中的用量。

常见源文件位置：

```text
C:\Users\<你的用户名>\.codex\sessions\...
C:\Users\<你的用户名>\.codex\archived_sessions\...
C:\Users\<你的用户名>\.claude\projects\...
```

### 可选环境变量

普通用户通常不需要配置环境变量。

如果你的网络必须经过代理，可以使用 Windows 标准代理变量：

```powershell
setx HTTP_PROXY http://127.0.0.1:7890
setx HTTPS_PROXY http://127.0.0.1:7890
```

修改环境变量后需要重新打开终端。

## 文件与数据目录

### 项目文件

```text
TokenUsage\
  bin\                         CLI 入口
  src\                         本地后端、解析器、价格、桌面组件逻辑
  dashboard\src\               前端源码
  dashboard\dist\              运行时使用的已构建前端
  CreateDesktopShortcuts.cmd   创建 Token 和 TokenStop 桌面快捷方式
  TokenUsage.cmd               从项目文件夹启动 TokenUsage
  TokenUsageStop.cmd           停止 TokenUsage 服务和小组件宿主
  package.json                 Node 包信息和脚本
  README.md                    英文文档
  README.zh-CN.md              中文文档
```

### 运行时数据

```text
C:\Users\<你的用户名>\.tokenusage\
  cache\session-history-cache.json   本地持久化用量快照
  tracker\queue.jsonl                本地 tracker 队列和运行时数据
  tracker\widget-host.pid            桌面小组件宿主进程 ID
```

运行时数据会自动生成，不应提交到 Git。

## 常用命令

启动本地仪表盘：

```powershell
node .\bin\tracker.js serve
```

启动但不自动打开浏览器：

```powershell
node .\bin\tracker.js serve --no-open
```

使用其他端口：

```powershell
node .\bin\tracker.js serve --port 7681
```

手动同步本地数据：

```powershell
node .\bin\tracker.js sync
```

查看状态：

```powershell
node .\bin\tracker.js status
```

运行诊断：

```powershell
node .\bin\tracker.js diagnostics
```

## 常见问题

### `npm install` 无法识别

通常是 Node.js / npm 未安装，或安装后终端没有重新打开。

处理方式：

1. 安装 Node.js 20 或更高版本。
2. 关闭并重新打开终端。
3. 再次运行 `node -v` 和 `npm -v`。

### 仪表盘打不开

先手动打开：

```text
http://127.0.0.1:7680
```

如果仍然失败，用终端启动以查看错误：

```powershell
node .\bin\tracker.js serve
```

### 7680 端口被占用

换一个端口启动：

```powershell
node .\bin\tracker.js serve --port 7681
```

如果已经创建桌面快捷方式，也可以运行 `TokenStop` 停止旧服务。

### 没有显示用量数据

检查以下内容：

- 当前 Windows 用户是否使用过 `Codex` 或 `Claude Code`。
- `.codex` 或 `.claude` 下是否存在本地历史文件。
- TokenUsage 是否在这些历史文件生成后启动过。
- 源文件是否在 TokenUsage 扫描前就已经被删除。

### 用量数字和 API 网关不同

TokenUsage 读取的是本地会话历史和本地快照。API 网关通常在代理层统计请求。两者观察的数据来源不同，因此可能出现差异。

常见原因：

- 某些对话在 TokenUsage 扫描前已被删除。
- 网关统计到了本地会话文件里不存在的请求。
- 本地工具对缓存 Token、推理 Token、模型名的记录方式不同。
- 不同工具使用的价格表不同。

### `Codex` 使用限制显示 `fetch failed`

常见原因：

- 本机 Codex 认证缺失或过期。
- Node.js 无法访问所需 API。
- 代理、DNS 或防火墙拦截了请求。

即使使用限制读取失败，基础用量统计仍可继续使用。

### 桌面快捷方式指向了旧文件夹

在当前项目文件夹中重新运行：

```text
CreateDesktopShortcuts.cmd
```

Windows 快捷方式保存的是绝对路径，移动项目文件夹后需要重新生成。

## 开发说明

### 前端开发

仓库已包含 `dashboard/dist` 构建产物。

只有修改 `dashboard/src` 下的前端源码后，才需要重建前端：

```powershell
cd dashboard
npm install
npm run build
cd ..
```

### 发布检查

发布更新前建议按以下顺序检查：

1. 修改 `src` 和 `dashboard/src` 源码。
2. 如果改了前端，重建 `dashboard/dist`。
3. 本地启动一次确认可运行。
4. 运行 `npm pack --dry-run`，确认必要文件会进入发布包。
5. 将源码和构建产物一起提交。

## 许可证

MIT

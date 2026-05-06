# TokenUsage

这是一个适配 Windows 本地使用的 `Codex` / `Claude Code` Token 用量监测面板。

当前仓库保留的是这套本地版功能：
- 纯本地 Dashboard
- 无登录流程
- 无排行榜
- 历史用量持久化
- Windows 桌面悬浮小组件

## GitHub

- 仓库：[Aniian709/TokenUsage](https://github.com/Aniian709/TokenUsage)
- 问题反馈：[GitHub Issues](https://github.com/Aniian709/TokenUsage/issues)

## 运行要求

- Windows
- Node.js 20+

## 快速开始

1. 在项目根目录安装依赖：

```powershell
npm install
```

2. 启动本地仪表盘：

```powershell
node .\bin\tracker.js serve
```

3. 浏览器打开：

```text
http://127.0.0.1:7680
```

## 可选：重建前端

仓库里已经包含构建好的前端。只有你修改前端源码时，才需要重新构建：

```powershell
cd dashboard
npm install
npm run build
```

## 说明

- 程序会读取本机 `Codex` 和 `Claude Code` 的历史会话数据。
- 桌面小组件通过网页端控制。
- 程序本身不依赖特定 DNS 或代理配置，但你的外部 AI 工具网络环境会影响采集来源。

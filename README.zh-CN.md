# TokenUsage

<p align="center">
  <img alt="Version" src="https://img.shields.io/badge/version-0.6.2-22c55e?style=for-the-badge" />
  <img alt="Platform" src="https://img.shields.io/badge/platform-Windows-0ea5e9?style=for-the-badge" />
  <img alt="Mode" src="https://img.shields.io/badge/mode-local--first-f97316?style=for-the-badge" />
</p>

<p align="center">
  <a href="./README.md">English</a> · <a href="./README.zh-CN.md">中文</a>
</p>

`TokenUsage` 是一个以 Windows 本地使用为主的 `Codex` / `Claude Code` Token 用量监测面板。

它保留了原始 TokenUsage 的整体视觉风格，但仓库当前面向的是本地使用场景：
- 无登录流程
- 无排行榜
- 本地历史持久化
- Windows 桌面悬浮小组件
- 本地限额、模型占比、热力图、趋势图等能力

## 版本说明

- `v0.6.2`：Windows 本地优先版，支持历史持久化、桌面悬浮小组件，并移除了登录和排行榜。

仓库地址：
- [Aniian709/TokenUsage](https://github.com/Aniian709/TokenUsage)

问题反馈：
- [GitHub Issues](https://github.com/Aniian709/TokenUsage/issues)

## 项目功能

`TokenUsage` 会读取你本机上的 `Codex`、`Claude Code` 等工具的本地历史数据，然后展示：
- 总 Token 用量
- `1d / 7d / 30d / 总计` 视图
- 热门模型排行
- 活跃热力图
- 使用趋势图
- 每日明细
- 使用限制
- Windows 桌面小组件

这是一个本地优先项目，仪表盘展示的数据主要来自你自己电脑上的本地文件。

## 运行平台

- Windows 10 或 Windows 11
- Node.js 20 及以上

## 目录说明

核心目录：

- `bin/`
  命令行入口
- `src/`
  本地后端、历史解析、聚合逻辑、小组件宿主逻辑
- `dashboard/src/`
  前端源码
- `dashboard/dist/`
  已构建好的前端产物，仓库已包含

## 安装步骤

### 1. 克隆仓库

```powershell
git clone https://github.com/Aniian709/TokenUsage.git
cd TokenUsage
```

### 2. 安装根目录依赖

```powershell
npm install
```

这一步会安装本地后端与桌面小组件宿主所需依赖。

可选：创建桌面快捷方式：

```text
双击 CreateDesktopShortcuts.cmd
```

它会在 Windows 桌面生成两个快捷方式：

- `Token` 用来启动 TokenUsage。
- `TokenStop` 用来停止本地服务和桌面小组件宿主。

如果以后移动了项目文件夹，重新运行一次 `CreateDesktopShortcuts.cmd`，让快捷方式指向新的路径。

### 3. 前端依赖

仓库里已经包含可直接运行的 `dashboard/dist`，所以普通使用者通常不需要再次构建前端。

只有在你准备自行修改前端源码时，才需要执行：

```powershell
cd dashboard
npm install
npm run build
cd ..
```

## 启动方式

普通用户推荐直接：

```text
双击 TokenUsage.cmd
```

它会用正常的 Windows 终端窗口启动本地仪表盘，而且不依赖你把项目放在哪个文件夹。

如果已经创建了桌面快捷方式，也可以用桌面的 `Token` 启动，用 `TokenStop` 停止。

手动方式也可以：

运行：

```powershell
node .\bin\tracker.js serve
```

然后在浏览器中打开：

```text
http://127.0.0.1:7680
```

如果你本地另外做了 `token` 之类的启动别名，也可以继续使用你自己的别名启动。

## 使用说明

### 仪表盘

打开本地仪表盘后，可以查看：
- `1d` 用量
- `7d` 用量
- `30d` 用量
- 总计用量
- 模型占比
- 每日细目
- 热力图
- 趋势图

### 桌面小组件

进入网页端的 `Widgets` 页面后，可以开启：
- Summary 概览组件
- Heatmap 热力图组件
- Top Models 热门模型组件
- Usage Limits 使用限制组件
- 菜单栏风格悬浮组件

这些桌面组件由网页端控制，但实际显示为 Windows 桌面悬浮层。

### 使用限制

如果你本机存在可读取的 provider / account 数据，仪表盘可以显示使用限制。

对于 `Codex`，限额读取通常还会受到以下因素影响：
- 本地认证是否存在
- 本地 Node 服务是否能访问相关接口
- Windows 代理 / 网络工具是否拦截了请求

## 数据来源

项目会从你本机读取历史数据，并把扫描结果保存到本地快照里。这样即使你后来删掉一部分原始对话文件，已经保存下来的统计历史也能尽量保留下来。

常见来源包括：
- `~/.codex/...`
- `~/.claude/...`
- `~/.tokenusage/...`

## 重建前端

如果你修改了 `dashboard/src` 里的前端代码，重建命令如下：

```powershell
cd dashboard
npm run build
cd ..
```

重建后会更新：
- `dashboard/dist/index.html`
- `dashboard/dist/share.html`
- `dashboard/dist/assets/...`

## 常用命令

启动本地仪表盘：

```powershell
node .\bin\tracker.js serve
```

手动同步本地数据：

```powershell
node .\bin\tracker.js sync
```

查看状态：

```powershell
node .\bin\tracker.js status
```

## 常见问题

### 7680 端口被占用

如果看到：

```text
Port 7680 is still in use after cleanup
```

可以先关闭旧进程，或者换端口运行：

```powershell
node .\bin\tracker.js serve --port 7681
```

### Codex 限额显示 `fetch failed`

这通常意味着以下几种情况之一：
- 本地 Codex 认证缺失或过期
- 本地 Node 服务无法访问所需接口
- 你的 Windows 代理或网络工具拦住了请求

建议检查：
- 本地 Codex 认证文件是否存在
- 代理 / 网络设置是否允许访问
- 重新启动本地 dashboard 服务后是否恢复

### 没有读到历史数据

请确认你本机上的 `Codex` / `Claude Code` 历史文件仍然存在。  
如果你在 TokenUsage 保存快照之前就已经删除了原始会话文件，那么更早的那部分历史可能无法恢复。

## 给维护者的说明

如果你想继续把这个仓库作为“别人 clone 下来就能直接运行”的项目来维护，推荐始终按这个顺序：

1. 修改 `src/` 和 `dashboard/src/` 源码
2. 重建 `dashboard/dist`
3. 把源码和构建产物一起提交

这样别人在下载仓库后，不会因为缺少前端构建结果而无法直接运行。

## 许可证

MIT

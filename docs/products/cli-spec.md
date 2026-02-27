# ezagent CLI Specification v0.1.1

> **状态**：Architecture Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-py-spec-v0.9.1
> **作者**：Allen & Claude collaborative design
> **历史**：从 ezagent-py-spec v0.8 §8 提取为独立文档

---

## §1 概述

ezagent CLI 是基于 Python typer 实现的命令行工具，通过 ezagent-py SDK 与 Engine 交互。CLI 随 `pip install ezagent` 一同安装。

```
ezagent-py SDK (PyO3)
       │
       ▼
  CLI (typer)  ← 本文档定义的命令接口
```

---

## §2 命令结构

### §2.1 Identity 管理

```bash
ezagent init --relay <relay_domain> --name <local_part>  # 首次注册身份
ezagent init --relay relay.local --name alice --ca-cert ./ca.pem  # 本地 Relay

ezagent identity whoami            # 当前 Entity 信息
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent init` | `--relay` (必需), `--name` (必需), `--ca-cert` (可选) | 生成密钥对 + 向 Relay 注册 |
| `ezagent identity whoami` | 无 | 显示当前 Entity ID、Relay、公钥指纹 |

### §2.2 Room 操作

```bash
ezagent rooms                      # 列出 Room
ezagent room create --name "..."   # 创建 Room
ezagent room show <room_id>        # 查看 Room 详情
ezagent room invite <room_id> <entity_id>  # 邀请成员
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent rooms` | `--json`, `--quiet` | 列出已加入的 Room |
| `ezagent room create` | `--name` (必需) | 创建新 Room |
| `ezagent room show` | `<room_id>` (位置参数) | 显示 Room config + 成员列表 |
| `ezagent room invite` | `<room_id>` `<entity_id>` | 邀请 Entity 加入 Room |

### §2.3 消息操作

```bash
ezagent send <room_id> --body "Hello"   # 发送消息
ezagent messages <room_id>              # 列出消息
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent send` | `<room_id>`, `--body` (必需), `--format` (默认 text/plain) | 发送消息 |
| `ezagent messages` | `<room_id>`, `--limit` (默认 20), `--before` | 列出消息（分页） |

### §2.4 事件监听

```bash
ezagent events                     # 监听所有事件
ezagent events --room <room_id>    # 按 Room 过滤
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent events` | `--room` (可选), `--json` | 实时输出事件流（Ctrl+C 退出） |

### §2.5 系统操作

```bash
ezagent status                     # 节点状态

# 前台运行（开发/调试用，Ctrl+C 退出）
ezagent start                      # 前台启动 API server，日志输出到 stdout
ezagent start --port 9000          # 自定义端口

# 后台 daemon（生产用，Tray/LaunchAgent 调用）
ezagent serve                      # 启动后台 daemon
ezagent serve --stop               # 停止 daemon
ezagent serve --status             # 检查 daemon 状态
ezagent serve --port 9000          # 自定义端口
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent status` | 无 | 显示连接状态、已同步 Room 数量、Relay 状态 |
| `ezagent start` | `--port` (默认 8847) | 前台启动 API server，日志输出 stdout，Ctrl+C 退出。用于开发调试 |
| `ezagent serve` | `--port` (默认 8847) | 后台 daemon 模式启动 API server。由 LaunchAgent 或 ezagent.app 调用 |
| `ezagent serve --stop` | 无 | 停止后台 daemon (发送 SIGTERM) |
| `ezagent serve --status` | 无 | 显示 daemon 状态：running/stopped, PID, uptime, port |

### §2.6 Command（EXT-15）

```bash
ezagent commands                          # 列出所有可用命令
ezagent commands --room <room_id>         # 按 Room 过滤
ezagent exec <room_id> /ta:claim task-42  # 执行命令
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent commands` | `--room` (可选), `--json` | 列出所有可用的斜杠命令（聚合所有 Socialware 的 command_manifest） |
| `ezagent exec` | `<room_id>` (必需), `<command>` (必需) | 在指定 Room 中执行斜杠命令 |

`ezagent exec` 等价于发送一条带 `ext.command` 的 Message。命令执行结果通过 Event Stream 返回并在终端显示。

### §2.7 Socialware 管理

```bash
ezagent socialware list                          # 列出已安装 Socialware
ezagent socialware start <sw_id>                 # 启动 Socialware
ezagent socialware stop <sw_id>                  # 停止 Socialware
ezagent socialware install <path_or_url>         # 安装 Socialware
ezagent socialware uninstall <sw_id>             # 卸载 Socialware
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent socialware list` | `--json`, `--quiet` | 列出已安装 Socialware 及其状态 |
| `ezagent socialware start` | `<sw_id>` (必需) | 启动指定 Socialware |
| `ezagent socialware stop` | `<sw_id>` (必需) | 停止指定 Socialware |
| `ezagent socialware install` | `<path_or_url>` (必需) | 安装 Socialware 包 |
| `ezagent socialware uninstall` | `<sw_id>` (必需), `--keep-data` (可选) | 卸载 Socialware |

### §2.8 Agent 管理（AgentForge）

```bash
ezagent agent list                               # 列出所有 Agent 实例
ezagent agent spawn --template code-reviewer \
    --name "Review-Bot" --room <room_id>          # 创建 Agent
ezagent agent destroy "Review-Bot"                # 销毁 Agent
ezagent agent wake "Review-Bot"                   # 唤醒 Agent
ezagent agent sleep "Review-Bot"                  # 休眠 Agent
ezagent agent templates                           # 列出 Agent 模板
ezagent agent config "Review-Bot" --key model \
    --value "opus"                                # 修改 Agent 配置
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent agent list` | `--status` (可选: active/sleeping/all), `--json` | 列出 Agent 实例 |
| `ezagent agent spawn` | `--template`, `--name` (必需), `--room` (可选) | 创建并启动 Agent |
| `ezagent agent destroy` | `<name>` (必需) | 销毁 Agent 实例 |
| `ezagent agent wake` | `<name>` (必需) | 手动唤醒休眠中的 Agent |
| `ezagent agent sleep` | `<name>` (必需) | 手动休眠 Agent |
| `ezagent agent templates` | `--json` | 列出可用 Agent 模板 |
| `ezagent agent config` | `<name>`, `--key`, `--value` | 修改 Agent 运行时配置 |

> `ezagent agent spawn/destroy/wake/sleep` 等价于在 Room 中执行对应的 `/af:*` 命令。CLI 方式适合自动化脚本和批量操作。

### §2.9 Extension 管理

```bash
ezagent ext list                              # 列出已安装 Extension 及状态
ezagent ext info <ext_name>                   # 查看 Extension manifest 详情
ezagent ext install <name_or_path>            # 安装 Extension
ezagent ext remove <ext_name>                 # 卸载 Extension
```

| 命令 | 参数 | 说明 |
|------|------|------|
| `ezagent ext list` | `--json`, `--quiet` | 列出 `~/.ezagent/extensions/` 下所有 Extension 及加载状态 |
| `ezagent ext info` | `<ext_name>` (必需) | 显示 manifest.toml 内容：version, api_version, datatypes, hooks, dependencies |
| `ezagent ext install` | `<name_or_path>` (必需) | 安装 Extension（从 registry 下载或本地路径） |
| `ezagent ext remove` | `<ext_name>` (必需), `--keep-data` (可选) | 卸载 Extension，删除 `~/.ezagent/extensions/{name}/` |

### §2.10 Daemon 管理

```bash
# PID 文件位置
~/.ezagent/ezagent.pid

# macOS LaunchAgent
~/Library/LaunchAgents/dev.ezagent.daemon.plist

# Linux systemd (future)
~/.config/systemd/user/ezagent.service
```

默认端口从 `8000` 改为 `8847`（避免与常见开发服务冲突）。App 启动时连接此端口，无需用户配置。

---

## §3 输出格式

```bash
ezagent rooms                     # 默认 table 格式
ezagent rooms --json              # JSON 格式
ezagent rooms --quiet             # 只输出 ID
```

所有列表类命令支持三种输出格式：

| 格式 | Flag | 适用场景 |
|------|------|---------|
| table | (默认) | 人类阅读 |
| json | `--json` | 程序解析、管道 |
| quiet | `--quiet` | 只输出 ID，方便 shell 脚本 |

---

## §4 配置文件

```toml
# ~/.ezagent/config.toml

[identity]
keyfile = "~/.ezagent/identity.key"
entity_id = "@alice:relay.ezagent.dev"   # ezagent init 时写入

[network]
listen_port = 7447                        # Zenoh peer 监听端口
scouting = true                           # multicast scouting（默认 true）

[relay]                                   # 可选：无此 section 时纯 P2P 模式
endpoint = "tls/relay.ezagent.dev:7448"   # ezagent init 时写入
ca_cert = ""                              # 自签 CA 证书路径（公网 Relay 留空）

[storage]
data_dir = "~/.ezagent/data"              # 本地 RocksDB 持久化路径
```

### §4.1 配置优先级

```
命令行参数 > 环境变量 (EZAGENT_*) > 配置文件 > 默认值
```

### §4.2 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 一般错误 |
| 2 | 参数错误 |
| 3 | 连接失败（Relay 不可达） |
| 4 | 认证失败（密钥不匹配） |
| 5 | 权限不足 |

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.1.2 | 2026-02-27 | §2.5 重写（start 前台 / serve daemon，端口 8847）；新增 §2.9 Extension 管理、§2.10 Daemon 管理 |
| 0.1.1 | 2026-02-26 | 新增 §2.6 Command, §2.7 Socialware 管理, §2.8 Agent 管理 (AgentForge) |
| 0.1 | 2026-02-25 | 从 ezagent-py-spec v0.8 §8 提取为独立文档 |

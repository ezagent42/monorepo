# ezagent-py — Python Binding Specification v0.9.1

> **状态**：Architecture Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-protocol-v0.8, ezagent-bus-spec-v0.9.1, ezagent-extensions-spec-v0.9.1
> **拆分文档**：ezagent-cli-spec, ezagent-http-spec, ezagent-app-prd
> **作者**：Allen & Claude collaborative design

**注意**：本文档仅包含 SDK 绑定规范（PyO3 桥接层）。CLI 接口定义见 cli-spec.md，HTTP API 接口定义见 http-spec.md，Chat App 产品需求见 app-prd.md。

---

## §1 Introduction & Design Goals

### §1.1 PyO3 唯一桥接原则

ezagent-py 是 Rust Engine 的**唯一外部接口**。所有面向用户的界面（CLI、HTTP Server、Desktop App）均在 Python 层基于此 SDK 实现。

```
┌──────────────────────────────────────────────────────┐
│              Engine API (Rust, Layer 0)                │
└──────────────────────────┬───────────────────────────┘
                           │ PyO3 (唯一出口)
┌──────────────────────────┴───────────────────────────┐
│              ezagent-py (Python SDK)                  │
└───┬──────────────┬──────────────┬────────────────────┘
    │              │              │
┌───┴────┐  ┌─────┴──────┐  ┌───┴──────────┐
│  CLI   │  │ HTTP Server│  │ Desktop App  │
│ typer  │  │ FastAPI    │  │ 内嵌 Python  │
│        │  │ + React UI │  │ + WebView    │
└────────┘  └────────────┘  └──────────────┘
```

### §1.2 pip install ezagent

```bash
pip install ezagent          # 安装 SDK + CLI
ezagent --help               # CLI 可用
python -c "import ezagent"   # SDK 可用
ezagent start                # 启动 HTTP Server + Chat UI
```

### §1.3 协议层与用户接口层的边界

| 层 | 属于协议 spec | 语言 | 行为一致性 |
|----|-------------|------|-----------|
| Engine + Built-in + Extensions | ✅ | Rust | 所有 peer MUST 一致 |
| ezagent-py SDK (PyO3 binding) | ✅ | Rust + Python | 从声明派生，确定性 |
| Socialware Hook | ✅ | Python | 每个 Socialware 可不同 |
| CLI / HTTP / Desktop | ❌ | Python | 实现细节 |

---

## §2 Engine Python API

### §2.1 Bus API

```python
import ezagent

# 首次使用：向 Public Relay 注册身份（一次性操作）
await ezagent.init(
    relay="relay.ezagent.dev",       # MUST: Relay 域名
    name="alice",                     # MUST: 用户名（local_part）
    ca_cert=None,                     # MAY: 自签 CA 证书路径（本地 Relay 时使用）
)
# → 生成 Ed25519 keypair
# → 通过 TLS 连接 Relay 并注册
# → 保存到 ~/.ezagent/identity.key + ~/.ezagent/config.toml

# 日常启动 Engine（relay 可选，P2P 模式无需 relay）
bus = await ezagent.start(
    relay=None,                       # MAY: 覆盖配置中的 relay endpoint
    listen_port=7447,                 # MAY: Zenoh peer 监听端口
    scouting=True,                    # MAY: 启用 multicast scouting（默认 True）
    data_dir="~/.ezagent/data",       # MAY: 本地持久化路径
)

# Identity
me = await bus.identity.whoami()
pubkey = await bus.identity.pubkey("@bob:relay.example.com")

# Room
room = await bus.rooms.create(name="Project Alpha", policy="invite")
rooms = await bus.rooms.list()
config = await bus.rooms[room_id].get()
await bus.rooms[room_id].config.update(name="New Name")
await bus.rooms[room_id].join()
await bus.rooms[room_id].leave()
await bus.rooms[room_id].invite("@bob:relay.example.com")
members = await bus.rooms[room_id].members()

# Timeline / Message
messages = await bus.rooms[room_id].messages.list(before=cursor, limit=50)
ref = await bus.rooms[room_id].messages[ref_id].get()
new_ref = await bus.rooms[room_id].messages.send(body="Hello!")
await bus.rooms[room_id].messages[ref_id].delete()

# Status
status = await bus.status()
```

### §2.2 Annotation API

```python
# Read annotations on a ref
annots = await bus.rooms[room_id].messages[ref_id].annotations.list()

# Add annotation
await bus.rooms[room_id].messages[ref_id].annotations.add(
    type="task_status",
    value={"status": "in_progress", "progress": 0.7}
)

# Remove own annotation
await bus.rooms[room_id].messages[ref_id].annotations.remove("task_status")

# Room Config annotations
config_annots = await bus.rooms[room_id].config.annotations.list()
```

### §2.3 Event Stream

```python
# Global event stream
async for event in bus.events():
    print(event.type, event.room_id, event.data)

# Filtered by room
async for event in bus.events(rooms=[room_id]):
    ...

# With cursor for reconnection
async for event in bus.events(cursor=last_event_id):
    ...
```

### §2.4 Status / Config

```python
status = await bus.status()
# StatusInfo(entity_id="@alice:...", relay="tls/...", relay_connected=True, connected_peers=3, scouting_active=True, ...)
```

---

## §3 Type Mapping

### §3.1 Rust → Python 类型对应表

| Rust 类型 | Python 类型 |
|-----------|------------|
| `String` | `str` |
| `Vec<u8>` | `bytes` |
| `i64` | `int` |
| `f64` | `float` |
| `bool` | `bool` |
| `Option<T>` | `Optional[T]` |
| `Vec<T>` | `list[T]` |
| `HashMap<K, V>` | `dict[K, V]` |
| `UUIDv7` | `str` (formatted) |
| `ULID` | `str` (formatted) |
| `DateTime` | `datetime.datetime` |

### §3.2 Python dataclass 定义

```python
@dataclass
class Room:
    room_id: str
    name: str
    created_by: str
    created_at: datetime
    membership_policy: str
    members: dict[str, str]  # entity_id → role
    enabled_extensions: list[str]

@dataclass
class Ref:
    ref_id: str
    author: str
    content_type: str
    content_id: str
    created_at: datetime
    status: str
    body: Optional[str]          # resolved by after_read hook
    extensions: dict[str, Any]   # ext.* fields

@dataclass
class Event:
    type: str
    id: int
    room_id: Optional[str]
    data: dict[str, Any]

@dataclass
class StatusInfo:
    entity_id: str
    relay: Optional[str]              # None if no relay configured
    relay_connected: bool             # TLS connection to relay active
    connected_peers: int              # number of P2P connected peers
    scouting_active: bool             # multicast scouting enabled
    uptime_seconds: int
```

### §3.3 Error hierarchy

```python
class EzagentError(Exception): pass
class NotFoundError(EzagentError): pass
class PermissionDeniedError(EzagentError): pass
class NotAMemberError(EzagentError): pass
class ExtensionDisabledError(EzagentError): pass
class ValidationError(EzagentError): pass
class ConflictError(EzagentError): pass
class SignatureError(EzagentError): pass
class PriorityError(EzagentError): pass
class InternalError(EzagentError): pass

# EXT-15 Command errors
class CommandError(EzagentError): pass
class CommandNsNotFoundError(CommandError): pass
class CommandActionNotFoundError(CommandError): pass
class CommandParamsInvalidError(CommandError): pass
class CommandTimeoutError(CommandError): pass
```

---

## §4 Socialware Hook Callback Protocol

### §4.1 @hook decorator 注册

```python
from ezagent import hook

@hook(phase="pre_send", trigger="timeline_index.insert", priority=100)
async def validate_task(event, ctx):
    """Socialware-level validation before message is written"""
    if not event.data.get("task_id"):
        raise ValidationError("task_id required")

@hook(phase="after_write", trigger="timeline_index.insert", priority=100)
async def on_message(event, ctx):
    """React to new messages"""
    await ctx.messages.send(room_id=event.room_id, body="Acknowledged")
```

### §4.2 priority >= 100 约束

- [MUST] Socialware Hook 的 priority MUST >= 100。
- [MUST] 尝试注册 priority < 100 的 Hook MUST raise `PriorityError`。
- 0-99 保留给 Built-in (0-9) 和 Extension (10-99) Hook。

### §4.3 执行模型 (GIL management)

```
pre_send phase:
  Rust Hook 0..99 → 释放 GIL → 获取 GIL → Python Hook 100+ → 释放 GIL → 签名

after_write phase:
  Rust Hook 0..99 → tokio::spawn_blocking → Python Hook 100+ (异步)

after_read phase:
  Rust Hook 0..99 → 释放 GIL → 获取 GIL → Python Hook 100+ → 释放 GIL → 返回
```

### §4.4 async / sync hook 处理

- [SHOULD] Hook callback SHOULD 为 async function（`async def`）。
- [MAY] 同步函数也可注册，Engine 将其包装在 `asyncio.to_thread` 中执行。

### §4.5 与 Extension Hook 的执行顺序

同一阶段内，Hook 按 priority 排序执行。Socialware Hook (100+) 始终在所有 Extension Hook (10-99) 之后执行。

---

## §5 Async Bridge (tokio ↔ asyncio)

### §5.1 Event loop 集成策略

ezagent-py 在 Python 进程中嵌入 tokio runtime。Python asyncio 事件循环通过 pyo3-async-runtimes 与 tokio 桥接。

```
Python asyncio event loop
    ↕ pyo3-async-runtimes
Rust tokio runtime (内嵌)
    ↕ direct call
Engine + yrs + Zenoh
```

### §5.2 pyo3-async-runtimes 使用

- [MUST] 所有 Rust async fn 通过 `pyo3_async_runtimes::tokio::future_into_py` 转换为 Python awaitable。
- [MUST] Python callback 通过 `pyo3_async_runtimes::tokio::into_future` 转换为 Rust Future。

---

## §6 Extension API 自动生成规则

### §6.1 从统一声明格式派生 Python API

每个 Extension 的统一声明格式（Bus Spec §3.5）包含四类信息，各类信息按以下规则映射为 Python API：

| 原语 | 声明信息 | 生成的 Python API |
|------|---------|------------------|
| Datatype | storage_type + key_pattern | Typed accessor class |
| Hook | trigger + phase | @hook decorator 注册点 |
| Annotation | on_ref schema | `ref.annotations.{type}` typed read/write |
| Index | operation_id | `await bus.rooms[id].{method}(...)` |

### §6.2 operation_id → Python 属性链映射规则

```
operation_id 的 namespace → Python 属性链:

  "room.create"         → bus.rooms.create(...)
  "reactions.add"       → bus.rooms[id].messages[ref].reactions.add(...)
  "profile.get"         → bus.profiles[entity_id].get()
  "watch.set"           → bus.rooms[id].messages[ref].watch.set(...)

命名约定:
  创建型操作 → .create() / .add() / .send()
  读取型操作 → .get() / .list()
  更新型操作 → .update() / .set()
  删除型操作 → .delete() / .remove() / .unset()
  流式操作   → async for ... in ...
```

### §6.3 storage_type → accessor 类型映射

| storage_type | Python accessor |
|-------------|----------------|
| crdt_map | Typed dict-like accessor |
| crdt_array | Typed list-like accessor |
| crdt_text | str accessor |
| blob | bytes accessor |
| ephemeral | pub/sub accessor |

### §6.4 annotation schema → typed read/write

```python
# From extension declaration:
#   annotations:
#     on_ref:
#       "watch:@{entity_id}": "{ reason, on_reply, on_thread, on_reaction }"

# Generated API:
watch_info = await bus.rooms[id].messages[ref].watch.get()
# → WatchAnnotation(reason="...", on_reply=True, ...)
```

### §6.5 index operation_id → Python method 签名

每个 Index 的 `operation_id` 直接映射为 Python async method。参数由 Index 的 `input` 和 `transform` 推导。

### §6.6 生成方式

两种可选方式（实现决定）：

1. **编译时生成**（推荐）：Rust macro 读取声明格式 → 生成 PyO3 `#[pymethods]` → 编译进 .so
2. **运行时生成**：Python 启动时读取声明 → 动态创建 class + method

---

## §7 Socialware DSL

### §7.1 @socialware decorator

```python
from ezagent import socialware, hook

@socialware("event-weaver")
class EventWeaver:
    """Socialware 声明"""

    @hook(phase="after_write", trigger="timeline_index.insert", priority=100)
    async def on_new_message(self, event, ctx):
        ...
```

### §7.2 四原语 Python 实现

Role、Arena、Commitment、Flow 四原语通过 Python class 声明，存储为 Annotation 或 Extension Datatype 字段。详见 ezagent-socialware-spec。

### §7.3 ctx 对象

Hook callback 接收 `ctx` 参数，提供对 Engine API + Extension API 的完整访问：

```python
async def on_message(event, ctx):
    # Engine API
    await ctx.messages.send(room_id=..., body=...)
    await ctx.rooms[id].members()

    # Extension API (auto-generated)
    await ctx.rooms[id].messages[ref].reactions.add("👍")
    await ctx.rooms[id].messages[ref].watch.set(on_reply=True)

    # Annotation API
    await ctx.rooms[id].messages[ref].annotations.add(
        type="task_status", value={"status": "done"})

    # EXT-15 Command API (Socialware Hook 中使用)
    await ctx.command.result(
        invoke_id="uuid:...",
        status="success",                    # "success" | "error" | "pending"
        result={"task_id": "t-42"},          # 任意 JSON-compatible
        error=None                           # status="error" 时使用
    )
```

### §7.4 EXT-15 Command 便捷 API

Socialware Hook 中通过 `ctx.command` 访问命令相关操作：

```python
# 写入命令执行结果（简写：自动从 event 推导 invoke_id 和 ref）
await ctx.command.result(event.ref.ext.command.invoke_id,
    status="success", result={"key": "value"})

# 读取命令信息
cmd = event.ref.ext.command
print(cmd.ns, cmd.action, cmd.params, cmd.invoke_id)

# 查询所有可用命令
commands = await ctx.command.list_available()
# → [CommandManifest(ns="ta", commands=[...]), CommandManifest(ns="ew", commands=[...])]
```

- [MUST] `ctx.command.result()` 内部通过 Annotation API 写入 `command_result:{invoke_id}` Annotation。
- [MUST] `ctx.command.list_available()` 内部查询 `command_manifest_registry` Index。

### §6.7 Renderer 声明的传递

Extension 声明中的 `renderer` 字段（参见 ezagent-bus-spec §3.5.2）MUST 通过 PyO3 暴露给 Python 层。

```python
# renderer 声明可通过 SDK 读取
ext_decl = await bus.extensions.get_declaration("reactions")
print(ext_decl.renderer)
# → { "ref_decorators": [{ "source": "ext.reactions", "position": "below", ... }] }
```

- [MUST] `bus.extensions.get_declaration(ext_id)` 返回包含 `renderer` 字段的完整声明。
- [MUST] HTTP Server 实现 SHOULD 通过 `GET /api/renderers` endpoint 将所有 renderer 声明聚合提供给前端。详见 ezagent-http-spec。
- [MUST] Socialware 的 UI Manifest（Part C）通过相同机制传递。

---

## §8 Socialware Management API

### §8.1 安装与生命周期

```python
# Socialware 管理（由 CLI / HTTP Server 调用）
from ezagent import Socialware

# 列出已安装 Socialware
installed = await bus.socialware.list()
# → [SocialwareInfo(id="event-weaver", version="0.9.1", status="running"), ...]

# 启动/停止 Socialware
await bus.socialware.start("task-arena")
await bus.socialware.stop("task-arena")

# 安装/卸载
await bus.socialware.install(path="/path/to/task-arena-package")
await bus.socialware.uninstall("task-arena")
```

### §8.2 数据类

```python
@dataclass
class SocialwareInfo:
    id: str
    name: str
    version: str
    status: str              # "running" | "stopped" | "error"
    identity: str            # Entity ID
    auto_start: bool
    commands: list[str]      # 注册的命令动作列表（如 ["claim", "post-task"]）
    dependencies: dict       # extensions + socialware 依赖
```

---

## §9 AgentAdapter Protocol

### §9.1 概述

AgentForge 的 Agent 适配器通过 Python Protocol 定义。任何实现此 Protocol 的类都可以桥接外部 Agent 能力到 ezagent。

### §9.2 Protocol 定义

```python
from typing import Protocol, AsyncIterator, Any, Optional
from dataclasses import dataclass

@dataclass
class AgentMessage:
    content: str                          # 用户消息内容
    author: str                           # 发送者 Entity ID
    room_id: str                          # Room ID
    ref_id: str                           # 触发消息的 Ref ID
    command: Optional[dict] = None        # ext.command 信息（命令触发时）

@dataclass
class AgentContext:
    segment: list[dict]                   # Conversation Segment 消息列表
    room_members: list[dict]              # Room 成员列表（含 Role）
    working_dir: Optional[str] = None     # 工作目录（沙箱）
    system_prompt: str = ""               # soul.md 内容
    max_tokens: int = 4096                # 最大输出 token

@dataclass
class AgentChunk:
    type: str      # "text" | "tool_use" | "tool_result" | "done" | "error"
    content: Any   # text → str, tool_use → dict, error → str

@dataclass
class AgentCapabilities:
    streaming: bool = True                # 是否支持流式输出
    tool_use: bool = False                # 是否支持工具调用
    max_context_tokens: int = 8000        # 建议的最大上下文 token 数


class AgentAdapter(Protocol):
    """Agent 适配器协议。所有 Agent 实现必须遵循。"""

    async def handle_message(
        self,
        message: AgentMessage,
        context: AgentContext
    ) -> AsyncIterator[AgentChunk]:
        """处理一条消息，流式返回结果"""
        ...

    async def handle_tool_result(
        self,
        tool_use_id: str,
        result: Any
    ) -> AsyncIterator[AgentChunk]:
        """处理工具调用结果（仅支持 tool_use 的 Adapter 需要实现）"""
        ...

    def capabilities(self) -> AgentCapabilities:
        """声明 Adapter 能力"""
        ...
```

### §9.3 内置 Adapter

| Adapter | 说明 | 通信方式 |
|---------|------|---------|
| `AnthropicAPIAdapter` | 通过 Anthropic Messages API 调用 Claude | HTTPS API |
| `ClaudeCodeAdapter` | 复制 Claude Code 行为（API + 工具调用） | HTTPS API |
| `SubprocessAdapter` | 通过 subprocess `--print` 模式调用 CLI Agent | stdin/stdout |
| `CustomAdapter` | 用户自定义 Adapter 基类 | 用户实现 |

### §9.4 注册自定义 Adapter

```python
from ezagent.agent import register_adapter, AgentAdapter

class MyCustomAdapter(AgentAdapter):
    async def handle_message(self, message, context):
        # 调用自定义 LLM API
        response = await my_llm_api.chat(message.content)
        yield AgentChunk(type="text", content=response)
        yield AgentChunk(type="done", content=None)

    def capabilities(self):
        return AgentCapabilities(streaming=True, tool_use=False)

# 注册到 AgentForge
register_adapter("my-custom", MyCustomAdapter)
```

注册后可在模板中引用：

```toml
# templates/my-agent.toml
[adapter]
type = "my-custom"
```

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.9.1 | 2026-02-26 | 新增 §7.4 EXT-15 Command 便捷 API、§8 Socialware Management API、§9 AgentAdapter Protocol。Command 相关 Error 类型 |
| 0.8 | 2026-02-25 | 拆分：§8 CLI → cli-spec.md、§9 HTTP → http-spec.md、§10-§11 Desktop/Packaging → app-prd.md。新增 §6.7 Renderer 声明传递 |
| 0.7 | 2026-02-25 | 初始版本。PyO3 唯一桥接架构。Engine Python API、类型映射、Socialware Hook 协议、Extension API 自动生成规则 |

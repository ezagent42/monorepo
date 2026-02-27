# ezagent Chat UI Specification v0.1.1

> **状态**：Architecture Draft
> **日期**：2026-02-26
> **前置文档**：ezagent-bus-spec-v0.9.1, ezagent-extensions-spec-v0.9.1, ezagent-socialware-spec-v0.9.1
> **作者**：Allen & Claude collaborative design

---

## §1 概述

### §1.1 文档范围

本文档定义 ezagent Chat UI 的渲染架构，包括 Render Pipeline（四原语到 UI 的映射规则）、Progressive Override（三级渲染策略）和 Widget SDK（自定义组件接口）。

本文档**不**定义用户旅程和信息架构（见 app-prd）、HTTP API（见 http-spec）、Extension 数据模型（见 extensions-spec）。

### §1.2 核心设计原则

**原语投影**：UI 不是独立系统，而是四原语（DataType、Hook、Annotation、Index）+ Socialware 四原语（Role、Arena、Commitment、Flow）的渲染投影。不引入"浮空"的 UI 概念。

**Progressive Override**：渲染策略分三级 fallback chain——从 schema 自动生成（Level 0）、声明式定制（Level 1）、到自定义组件（Level 2）。后者覆盖前者。

**CRDT-reactive**：所有 UI 由 CRDT 数据驱动。数据变更 → UI 自动更新，无需手动刷新。

---

## §2 Render Pipeline

### §2.1 四层渲染模型

一条消息从 CRDT 数据到屏幕像素的完整路径：

```
                 CRDT 数据层
                     │
    ┌────────────────┼──────────────────────────┐
    │                │                          │
    ▼                ▼                          ▼
 DataType        Annotations                Flow State
 (content)       (decorations)              (status + transitions)
    │                │                          │
    │ renderer       │ renderer                 │ renderer
    ▼                ▼                          ▼
 Layer 1          Layer 2                    Layer 3
 Content          Decorators                 Actions
 Renderer         (priority-ordered)         (role-filtered)
    │                │                          │
    └────────────────┼──────────────────────────┘
                     │
                     ▼
              ┌─────────────┐
              │  消息气泡     │     单条消息的渲染结果
              └─────────────┘
                     │
                     │ 多条消息 via Index
                     ▼
              ┌─────────────┐
              │  Room Tab    │     Layer 4: 视图级渲染
              │  (layout)    │
              └─────────────┘
```

### §2.2 各层职责

| 层 | 来源 | 职责 | 对标产品 |
|----|------|------|---------|
| **Layer 1: Content Renderer** | DataType.renderer | 消息 body 区域的结构化渲染 | Slack Block Kit, Discord Embed |
| **Layer 2: Decorator** | Annotation.renderer | 消息气泡外围叠加的附加信息 | reactions, reply quote, pin, edit tag |
| **Layer 3: Actions** | Flow.renderer + Role | 消息内的可点击交互按钮 | Slack action buttons, Telegram inline keyboard |
| **Layer 4: Room Tab** | Index.renderer | Room 级别的视图切换 | Slack Tabs, Matrix Widget, Notion view |

---

## §3 Layer 1: Content Renderer

### §3.1 职责

Content Renderer 决定消息 body 区域的渲染方式。不同 DataType 的消息可以有完全不同的 body 布局。

### §3.2 声明方式

在 DataType 声明的 `renderer` 字段中指定（参见 bus-spec §3.5.2）：

```yaml
DataType:
  id: "ta_task"
  storage_type: crdt_map
  # ... 其他字段 ...
  
  renderer:
    type: structured_card            # 预定义渲染器类型
    field_mapping:
      header: "title"
      metadata:
        - { field: "reward", format: "{value} {currency}", icon: "coin" }
        - { field: "deadline", format: "relative_time", icon: "clock" }
      badge: { field: "status", source: "flow:ta:task_lifecycle" }
```

### §3.3 预定义 Content Renderer 类型

| renderer.type | 渲染效果 | 适用场景 |
|---------------|---------|---------|
| `text` | 纯文本/Markdown 气泡 | Message built-in 默认 |
| `structured_card` | 标题 + 字段行 + badge | 任务、事件、资源等结构化数据 |
| `media_message` | 图片/视频/音频内嵌预览 | EXT-10 Media |
| `code_block` | 语法高亮代码块 | 代码消息 |
| `document_link` | 文档标题 + 摘要 + 打开按钮 | EXT-01 Mutable / EXT-02 Collab |
| `embed` | URL 预览卡片 | 外部链接 unfurl |
| `composite` | 多个子 renderer 垂直排列 | 混合内容消息 |

### §3.4 structured_card field_mapping

```yaml
field_mapping:
  header:     string            # 字段名 → 卡片标题
  body:       string | null     # 字段名 → 正文文本
  metadata:                     # 元数据行
    - field:   string           # 字段名
      format:  string           # 格式化模板（可选）
      icon:    string           # 图标名（可选）
  badge:                        # 状态标记
    field:     string           # 字段名
    source:    string           # "flow:{flow_id}" 时从 Flow renderer 取颜色
  thumbnail:  string | null     # 字段名 → 缩略图（可选）
```

---

## §4 Layer 2: Decorator

### §4.1 职责

Decorator 在已有消息气泡上叠加装饰信息，不改变消息本体。

### §4.2 声明方式

在 Annotation 声明的 `renderer` 字段中指定：

```yaml
annotations:
  on_ref:
    ext.reactions: "Y.Map<'{emoji}:{entity_id}', unix_ms>"
    renderer:
      position: below
      type: emoji_bar
      interaction:
        click: toggle_own
        long_press: show_who
```

### §4.3 Decorator Position

| position | 位置 | 适用 |
|----------|------|------|
| `above` | 消息气泡上方 | reply_to 引用条 |
| `below` | 消息气泡下方 | reactions, thread indicator, channel tags |
| `inline` | 紧跟时间戳 | "(edited)" 标记 |
| `badge` | 气泡角标 | pin 图标 |
| `overlay` | 覆盖整个气泡 | moderation redact |

### §4.4 预定义 Decorator 类型

| type | 渲染效果 | 交互 |
|------|---------|------|
| `emoji_bar` | emoji + 计数，横向排列 | click toggle, long press show who |
| `quote_preview` | 原消息作者 + 截断内容 | click scroll to ref |
| `text_tag` | 简短文字标签 | click 可选操作 |
| `thread_indicator` | 回复数 + 参与者头像 + 最后回复时间 | click open thread |
| `tag_list` | 标签列表 (#channel-name) | click filter |
| `redact_overlay` | 遮罩 + "消息已被隐藏" | 管理员可点击查看原文 |
| `presence_dot` | 在线状态圆点 | 无 |
| `typing_indicator` | "bob is typing..." 动画 | 无 |

### §4.5 渲染顺序

Decorator 的渲染顺序由对应 after_read Hook 的 `priority` 决定，从小到大叠加：

```
  ┌──────────────────────────────────────┐
  │  [reply_to quote]     ← priority 30  │  above
  │                                      │
  │  alice: Hello world!                 │  body (Content Renderer)
  │  10:01 AM (edited)    ← priority 35  │  inline
  │                                      │
  │  👍2 ❤️1              ← priority 40  │  below
  │  💬 3 replies          ← priority 45  │  below
  │  #code-review          ← priority 50  │  below
  └──────────────────────────────────────┘
  ┌ moderation overlay ──────────────────┐
  │  [redacted by admin]  ← priority 60  │  overlay
  └──────────────────────────────────────┘
```

---

## §5 Layer 3: Actions

### §5.1 职责

Actions 在消息内提供可点击的按钮，触发 Flow state transition 或 Annotation 写入。按钮的可见性由 viewer 当前 Role 决定。

### §5.2 声明方式

在 Flow 声明的 `renderer` 字段中指定：

```yaml
flows:
  - id: ta:task_lifecycle
    states: [draft, open, claimed, ...]
    transitions:
      open --[Worker claims]--> claimed
    
    renderer:
      actions:
        - transition: "open → claimed"
          label: "Claim Task"
          icon: "hand-raised"
          style: primary
          visible_to: "role:ta:worker"
          confirm: false

        - transition: "under_review → approved"
          label: "Approve"
          icon: "check"
          style: primary
          visible_to: "role:ta:reviewer"
          confirm: true
          confirm_message: "确认批准这个提交？"
      
      badge:
        draft: { color: "gray", label: "Draft" }
        open: { color: "blue", label: "Open" }
        claimed: { color: "yellow", label: "Claimed" }
        in_progress: { color: "orange", label: "In Progress" }
        approved: { color: "green", label: "Approved" }
        rejected: { color: "red", label: "Rejected" }
```

### §5.3 Action 定义格式

```yaml
ActionDef:
  transition:    string              # "state_a → state_b"
  label:         string              # 按钮文字
  icon:          string | null       # 图标名
  style:         enum                # primary | secondary | danger
  visible_to:    role_expr           # 角色可见性表达式
  confirm:       boolean             # 是否需要确认弹窗
  confirm_message: string | null     # 确认消息
  mutation:                          # 点击后的数据变更（默认推导自 transition）
    type:        enum                # annotation_write | message_send | flow_advance
    target:      string
    payload:     map | null
```

### §5.4 可见性规则

```
用户点击消息 → 判断当前 Flow state → 找到可用 transitions →
对每个 transition：检查 visible_to 中的 role_expr →
viewer 有对应 Role → 显示按钮 / viewer 无对应 Role → 隐藏
```

### §5.5 点击执行流程

```
用户点击 [Approve] →
(confirm=true) → 弹窗确认 →
写入 Annotation 推进 Flow state (under_review → approved) →
CRDT 同步到所有 peer →
所有用户的 UI 自动更新 badge 颜色 + 按钮可见性
```

---

## §6 Layer 4: Room Tab

### §6.1 职责

Room Tab 在 Room 级别提供多种内容展示方式，用户在 tab 间切换。同一份 CRDT 数据通过不同 Index + Layout 呈现不同视角。

### §6.2 声明方式

在 Index 声明的 `renderer` 字段中指定：

```yaml
indexes:
  - id: "ta:task_board"
    input: "ta_task messages in room"
    transform: "group by ta:task_lifecycle.state"
    renderer:
      as_room_tab: true
      tab_label: "Board"
      tab_icon: "columns"
      layout: kanban
      layout_config:
        columns_from: "flow:ta:task_lifecycle.states"
        card_renderer: "ta_task"
        drag_drop: true
        drag_transitions:
          "open → claimed": { require_role: "ta:worker" }
```

### §6.3 Room Tab 来源

Room 的可用 Tab 由以下声明自动汇聚：

```
Built-in Timeline Tab (始终存在，默认 tab)
  + Extension Index 中 as_room_tab=true 的声明
  + Socialware UI Manifest 中 views 的声明
  → 合并为 Room Header 中的 tab 列表
```

### §6.4 预定义 Layout 类型

| layout | 渲染效果 | 适用场景 |
|--------|---------|---------|
| `message_list` | 时间线消息列表 | Timeline 默认 view |
| `kanban` | 看板（列 = Flow states） | 任务管理 |
| `grid` | 网格布局 | 媒体图库 |
| `table` | 结构化数据表格 | 资源列表 |
| `calendar` | 日历 | 事件日程 |
| `document` | 富文本编辑器 | 协同文档 |
| `split_pane` | 左右分栏 | 代码评审 |
| `graph` | 节点-边图 | DAG 可视化 |

### §6.5 Layout 配置示例

**kanban layout_config**:

```yaml
layout_config:
  columns_from: "flow:{flow_id}.states"  # 或 explicit list
  card_renderer: "{datatype_id}"          # 引用 DataType 的 Content Renderer
  drag_drop: true                         # 拖拽触发 Flow transition
  drag_transitions:                       # 拖拽映射
    "{from_state} → {to_state}": { require_role: "..." }
```

**grid layout_config**:

```yaml
layout_config:
  source_index: "{index_id}"
  columns: 3 | 4 | auto
  preview_size: small | medium | large
```

**calendar layout_config**:

```yaml
layout_config:
  date_field: "{field_name}"
  title_field: "{field_name}"
  color_from: "flow:{flow_id}.state"
  default_view: month | week | day
```

---

## §7 Progressive Override

### §7.1 原则

三级渲染策略构成一条 fallback chain。渲染时优先使用高级别，找不到则回退：

```
Level 2 (Custom Component)  →  有就用它
         ↓ 未注册
Level 1 (Renderer Declaration)  →  有就用它
         ↓ 无 renderer 字段
Level 0 (Schema-derived)  →  自动生成
```

### §7.2 Level 0: Schema-derived (零配置)

**触发条件**：DataType 没有 `renderer` 字段。

**自动推导规则**：

| schema 字段类型 | 渲染为 |
|----------------|--------|
| string | 文本行 |
| number | 数字显示 |
| boolean | ✅ / ❌ |
| datetime | 格式化时间 |
| array | 逗号分隔列表 |
| object | 嵌套 key:value |

**Content Renderer (消息气泡)**：

```
┌──────────────────────────────┐
│  {datatype_id}               │  ← DataType ID 作为标题
│  field_a: value_a            │  ← 逐字段 key:value
│  field_b: value_b            │
└──────────────────────────────┘
```

**Room Tab (自动生成)**：可排序的数据表格，列 = schema 字段。

**质量**：功能完整但无设计感，适合开发调试。类比 Django Admin。

### §7.3 Level 1: Renderer Declaration (声明式)

**触发条件**：四原语声明中存在 `renderer` 字段。

**开发者工作量**：写 YAML/JSON 声明，不写前端代码。选择预定义渲染器类型 + 指定 field mapping + 配置交互行为。

**质量**：80% 场景产品级。类比 Retool 拖拽配置。

### §7.4 Level 2: Custom Component (自定义)

**触发条件**：通过 Widget SDK 调用 `registerRenderer()` 注册自定义 React 组件。

**开发者工作量**：写 TypeScript/React 代码。

**质量**：无限制。适用于复杂交互场景（如协同编辑器、DAG 可视化）。

### §7.5 Override 粒度

同一个 Extension / Socialware 的不同渲染位置可以独立使用不同 Level：

```
EXT-11 Threads:
  Layer 2 Decorator (thread indicator)  → Level 0 足够
  Layer 4 Room Tab (thread panel)       → Level 1 声明式

TaskArena:
  Layer 1 Content (task card)           → Level 1 声明式
  Layer 3 Actions (buttons)             → Level 1 声明式
  Layer 4 Board Tab                     → Level 1 声明式
  Layer 4 Review Panel                  → Level 2 自定义
```

### §7.6 各 Extension 推荐 Level

| Extension | 推荐 Level | 理由 |
|-----------|-----------|------|
| EXT-03 Reactions | Level 0 | emoji bar 可自动生成 |
| EXT-04 Reply To | Level 0 | quote preview 可自动生成 |
| EXT-08 Read Receipts | Level 0 | check mark 可自动生成 |
| EXT-09 Presence | Level 0 | 圆点 + typing 可自动生成 |
| EXT-12 Drafts | Level 0 | 对用户透明 |
| EXT-01 Mutable | Level 1 | 需声明 edit 按钮位置 |
| EXT-06 Channels | Level 1 | 需声明 sidebar section |
| EXT-07 Moderation | Level 1 | 需声明 overlay 样式 |
| EXT-10 Media | Level 1 | 需声明 gallery layout |
| EXT-11 Threads | Level 1 | 需声明 thread panel |
| EXT-13 Profile | Level 1 | 需声明 profile card 字段 |
| EXT-05 Cross-Room | Level 1 | 跨 Room 预览卡片 |
| EXT-02 Collab | Level 2 | 实时协同编辑器必须自定义 |

---

## §8 Widget SDK

### §8.1 适用场景

Widget SDK 供 Level 2 自定义组件开发者使用。当 Level 0/1 无法满足交互需求时（如协同编辑器、DAG 可视化），开发者编写 React 组件并通过 SDK 注册。

### §8.2 注册接口

```typescript
import { registerRenderer } from '@ezagent/ui-sdk';

// 注册自定义 Content Renderer (替代 Level 0/1)
registerRenderer({
  id: 'sw:ew:dag_view',
  type: 'room_view',              // inline_widget | room_view | panel_widget
  subscriptions: {
    datatypes: ['ew_event'],
    annotations: ['ew:causality'],
    indexes: ['ew:dag_index'],
  },
  component: DagViewComponent,
});
```

### §8.3 组件 Props

```typescript
interface WidgetProps {
  // 数据（根据 subscriptions 自动填充）
  data: {
    ref?: RefData;                 // 当前消息 ref (inline_widget)
    room?: RoomData;               // 当前 room (room_view)
    query_results?: any;           // Index 查询结果
    annotations?: Record<string, any>;
  };
  
  // 上下文
  context: {
    viewer: { entityId: string; displayName: string };
    viewer_roles: string[];
    room_config: RoomConfig;
  };
  
  // 安全操作 API
  actions: {
    sendMessage: (params: SendParams) => Promise<void>;
    writeAnnotation: (params: AnnotationParams) => Promise<void>;
    advanceFlow: (params: FlowParams) => Promise<void>;
    navigate: (params: NavigateParams) => void;
  };
}
```

### §8.4 安全沙箱

自定义组件运行在受限环境中：

| 允许 | 禁止 |
|------|------|
| ✅ 读取声明的 DataType/Annotation/Index 数据 | ❌ 直接操作 CRDT |
| ✅ 通过 actions API 执行操作（受 Role 控制） | ❌ 访问其他 Room 的数据 |
| ✅ 渲染任意 React UI | ❌ 发起外部网络请求 |
| ✅ 使用 scoped CSS | ❌ 读取未声明的数据 |

---

## §9 Extension → 四层映射速查表

| Extension | Layer 1 Content | Layer 2 Decorator | Layer 3 Actions | Layer 4 Room Tab |
|-----------|----------------|-------------------|-----------------|-----------------|
| EXT-01 Mutable | document_link | "(edited)" tag | [Edit] | version history |
| EXT-02 Collab | document_link | collaborator 头像 | [Join Edit] | document editor |
| EXT-03 Reactions | — | emoji_bar | click toggle | — |
| EXT-04 Reply To | — | quote_preview | — | — |
| EXT-05 Cross-Room | — | cross_room card | [Jump] | — |
| EXT-06 Channels | — | #tag badges | — | sidebar section |
| EXT-07 Moderation | — | redact overlay | [Redact][Pin] | — |
| EXT-08 Read Receipts | — | read indicator | — | — |
| EXT-09 Presence | — | typing indicator | — | online users panel |
| EXT-10 Media | media_message | — | — | gallery tab |
| EXT-11 Threads | — | thread indicator | — | thread panel |
| EXT-12 Drafts | — | — | — | — (透明) |
| EXT-13 Profile | — | avatar + name | — | profile card |
| EXT-14 Watch | — | — | — | — (Agent 内部) |
| EXT-15 Command | command_badge | command_result card | — | — (autocomplete source) |

---

## §10 Command 交互 UI（EXT-15）

### §10.1 斜杠命令自动补全

用户在输入框输入 `/` 时触发命令自动补全菜单。数据源为 `command_manifest_registry` Index。

**交互流程**：

```
用户输入 "/" →
  弹出命令菜单（按命名空间分组显示）:
    ┌─────────────────────────────────┐
    │ TaskArena (ta)                   │
    │   /ta:claim      认领任务        │
    │   /ta:post-task  发布新任务      │
    │   /ta:submit     提交成果        │
    │ EventWeaver (ew)                 │
    │   /ew:branch     创建分支        │
    │   /ew:history    查询事件历史    │
    │ AgentForge (af)                  │
    │   /af:spawn      创建 Agent      │
    │   /af:list       列出 Agent      │
    └─────────────────────────────────┘

用户选择 "/ta:claim" →
  输入框变为: /ta:claim [task_id: ___]
  显示参数提示（从 ParamDef 推导）

用户输入参数 → 回车 → 发送命令消息
```

**声明来源**：

```yaml
# extensions-spec §16 附录 I
indexes:
  command_manifest_registry:
    renderer:
      as_autocomplete_source: true
```

### §10.2 Command 消息渲染

#### Layer 1: Content Renderer — command_badge

包含 `ext.command` 的消息在 body 区域额外显示命令标识：

```
┌──────────────────────────────────────┐
│  alice:                               │
│  /ta:claim task-42                   │  ← body 文本
│  ┌──────────────────┐                │
│  │ 🔧 ta:claim      │                │  ← command_badge (inline)
│  │ task_id: task-42  │                │
│  └──────────────────┘                │
└──────────────────────────────────────┘
```

#### Layer 2: Decorator — command_result_card

`command_result` Annotation 渲染为消息下方的结果卡片：

```
┌──────────────────────────────────────┐
│  alice: /ta:claim task-42            │
│  ┌──────────────────────────────┐   │
│  │ ✅ Success                    │   │  ← command_result (position: below)
│  │ Task task-42 → claimed       │   │
│  │ Handler: @task-arena          │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘

错误状态：
┌──────────────────────────────────────┐
│  alice: /ta:claim task-99            │
│  ┌──────────────────────────────┐   │
│  │ ❌ Error                      │   │  ← 红色背景
│  │ Task task-99 not found       │   │
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘

等待状态：
┌──────────────────────────────────────┐
│  alice: /af:spawn --name Bot         │
│  ┌──────────────────────────────┐   │
│  │ ⏳ Pending...                 │   │  ← 灰色 + spinner
│  └──────────────────────────────┘   │
└──────────────────────────────────────┘
```

### §10.3 推荐 Override Level

| 组件 | Level | 理由 |
|------|-------|------|
| 命令自动补全菜单 | Level 1 | 声明式足够（数据来自 Index） |
| command_badge | Level 0 | Schema 自动生成即可 |
| command_result card | Level 1 | 需声明 success/error/pending 样式 |

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.1.1 | 2026-02-26 | 新增 §10 Command 交互 UI（斜杠命令自动补全、command_badge、command_result card），Extension 映射表增加 EXT-15 |
| 0.1 | 2026-02-25 | 初始版本。Render Pipeline 四层模型、Progressive Override、Widget SDK、Extension 映射表 |

# Phase 0: 技术验证

> 从 implementation-plan.md §3 提取
> **版本**：0.9
> **目标**：yrs + Zenoh + PyO3 可行性验证
> **预估周期**：2 周

---

**目标**：验证 yrs + Zenoh 组合的基本可行性。

### TC-0-SYNC-001: 基本 Y.Map 同步

```
GIVEN  两个 Peer (P1=E-alice, P2=E-bob) 连接到 RELAY-A
       Room = R-minimal
       P1 和 P2 各持有同一 Y.Doc 的本地副本（初始为空）

WHEN   P1 在 Y.Map 上执行 set("key1", "value1")
       P1 将 update 通过 Zenoh publish 到 ezagent/room/R-minimal/config/updates

THEN   P2 在 <2s 内收到 update
       P2 的 Y.Map.get("key1") == "value1"
       P1 和 P2 的 Y.Doc state vector 一致
```

### TC-0-SYNC-002: 并发写入不同 Key

```
GIVEN  P1, P2 连接到 RELAY-A，同步 R-minimal 的 Y.Doc

WHEN   P1 执行 set("name", "Alice") 与 P2 执行 set("age", "30") 几乎同时

THEN   两端最终一致：Y.Map 包含 {"name": "Alice", "age": "30"}
```

### TC-0-SYNC-003: 并发写入相同 Key（LWW）

```
GIVEN  P1, P2 连接到 RELAY-A，同步 R-minimal 的 Y.Doc

WHEN   P1 执行 set("color", "red") 与 P2 执行 set("color", "blue") 几乎同时

THEN   两端收敛到相同值（LWW：时间戳更晚的胜出）
       P1.get("color") == P2.get("color")
```

### TC-0-SYNC-004: Y.Array 插入顺序

```
GIVEN  P1, P2 连接到 RELAY-A

WHEN   P1 在 Y.Array index 0 插入 "A"
       P2 在 Y.Array index 0 插入 "B"（并发）

THEN   两端收敛到相同顺序（YATA 算法确定性排序）
       P1.toArray() == P2.toArray()
```

### TC-0-SYNC-005: 离线 → 重连 → 数据恢复

```
GIVEN  P1 连接到 RELAY-A，P2 断线
       Y.Map 初始 = {"x": "1"}

WHEN   P2 断线期间，P1 执行 set("x", "2") 和 set("y", "3")
       P2 重连

THEN   P2 通过 state query 获取差量
       P2 的 Y.Map == {"x": "2", "y": "3"}
```

### TC-0-SYNC-006: Router Storage 持久化

```
GIVEN  P1 连接到 RELAY-A，写入 set("persist", "true")
       P1 断开，RELAY-A 的 storage 保留数据

WHEN   新 Peer P3 首次连接到 RELAY-A
       P3 对 ezagent/room/R-minimal/config/state 发起 query

THEN   P3 收到完整 state，包含 {"persist": "true"}
```

### TC-0-SYNC-007: Y.Text 协作编辑

```
GIVEN  P1, P2 同步一个 Y.Text（初始为空）

WHEN   P1 在 index 0 插入 "Hello "
       P2 在 index 0 插入 "World"（并发）

THEN   两端收敛到相同文本（"Hello World" 或 "WorldHello "，取决于 YATA）
       P1.toString() == P2.toString()
```

### TC-0-SYNC-008: Zenoh Pub/Sub QoS

```
GIVEN  P1 publish update 到 ezagent/room/R-minimal/config/updates
       QoS: priority=Data, congestion_control=Block, reliability=Reliable

WHEN   网络正常

THEN   P2 收到 update，且不丢失
```

### TC-0-P2P-001: LAN Scouting 直连同步

```
GIVEN  P1 (E-alice), P2 (E-bob) 在同一 LAN 内
       两者均以 peer mode 启动，scouting enabled
       无 Public Relay

WHEN   P1 和 P2 通过 multicast scouting 互相发现
       P1 在 R-minimal 的 Y.Map 上执行 set("hello", "world")

THEN   P2 在 <2s 内收到 update
       P2 的 Y.Map.get("hello") == "world"
       无任何流量经过外部 Relay
```

### TC-0-P2P-002: Peer-as-Queryable State Recovery

```
GIVEN  P1 已持有 R-minimal 的完整 Y.Doc（含 5 条消息）
       P1 已对该 doc 注册 Zenoh queryable
       P3 新启动，LAN 可达 P1，无 Relay

WHEN   P3 对 R-minimal 发起 initial sync query

THEN   P1 回复完整 state
       P3 成功恢复 Y.Doc（包含 5 条消息）
       P3 的 state vector 与 P1 一致
```

### TC-0-P2P-003: P2P + Relay Fallback

```
GIVEN  P1 (E-alice) 在 LAN-A
       P2 (E-bob) 在 LAN-B
       Public Relay R 可达两者
       P1 和 P2 不在同一 LAN（scouting 不互通）

WHEN   P1 发送消息到 R-minimal

THEN   消息经 Relay R 中转到达 P2
       P2 收到消息，内容正确
```

---


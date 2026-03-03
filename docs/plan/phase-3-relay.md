# Phase 3: Relay 实现

> **版本**：0.9
> **目标**：Relay 作为独立服务完整可运行（Level 1 / Level 2 / Level 3）
> **预估周期**：3-4 周
> **前置依赖**：Phase 2 (Extensions) + Phase 2.5 (Python Binding) 完成
> **Spec 依赖**：bus-spec §6, relay-spec §4–§10

---

## 验收标准（分 Level 1 / Level 2 / Level 3 三个 Gate）

**Level 1: Bridge — 基础桥接服务**
- Zenoh Router 启动并正确中继 CRDT 文档同步
- TLS 加密通信端到端工作
- CRDT 文档持久化与跨节点同步协议可用
- Entity 公钥注册和查询可用
- 全局 Blob Store 和 GC 可用
- 多 Relay 跨域数据路由可用

**Level 2: Managed — 管理型服务**
- Room/Entity 维度 Access Control 可用
- 存储/带宽配额管理端到端工作
- Admin API 认证 + CRUD 端点可用
- Prometheus 指标和健康检查端点可用

**Level 3: Public — 公共服务**
- Discovery 索引（Profile 搜索）可用
- Web Fallback（ezagent URI → HTML 预览）可用

**Gate 规则**：Level 1 Gate 是 Phase 4 的前置条件；Level 2 / Level 3 可与 Phase 4 并行推进。

---

## §1 Zenoh Router + TLS（Level 1: Bridge）

> **Spec 引用**：bus-spec §6.2, §6.3; relay-spec §10

### TC-3-BRIDGE-001: Relay 启动与端口监听

```
GIVEN  relay.toml 配置：
       listen = "tls/0.0.0.0:7448"
       domain = "relay-a.example.com"

WHEN   启动 Relay 服务

THEN   Zenoh Router 在 tls/0.0.0.0:7448 监听
       日志输出 "Relay relay-a.example.com started on tls/0.0.0.0:7448"
       健康检查端点 /healthz 返回 200
```

### TC-3-BRIDGE-002: TLS 握手与证书验证

```
GIVEN  Relay 使用 Let's Encrypt 签发的证书
       证书 CN = relay-a.example.com

WHEN   Peer 连接 tls/relay-a.example.com:7448

THEN   TLS 1.3 握手成功
       Peer 验证证书链有效
       连接建立
```

### TC-3-BRIDGE-003: TLS 自签证书支持

```
GIVEN  Relay 配置自签 CA 证书
       Peer 配置 ca_cert 指向该 CA

WHEN   Peer 连接 Relay

THEN   TLS 握手成功（自签 CA 通过自定义验证）
       连接正常工作
```

### TC-3-BRIDGE-004: TLS 证书过期拒绝

```
GIVEN  Relay 证书已过期

WHEN   Peer 尝试连接

THEN   TLS 握手失败
       Peer 日志输出证书过期错误
       连接不建立
```

### TC-3-BRIDGE-005: Peer 连接后 CRDT 文档路由

```
GIVEN  Peer-A 和 Peer-B 都连接到 Relay-A
       Peer-A 和 Peer-B 属于同一 Room

WHEN   Peer-A 发送 CRDT 更新（消息写入）

THEN   Relay 路由更新到 Peer-B
       Peer-B 收到完整 CRDT 更新
       延迟 < 100ms
```

### TC-3-BRIDGE-006: 跨网段 Peer 只通过 Relay 通信

```
GIVEN  Peer-A 在网段 A，Peer-B 在网段 B
       两者无法直接 P2P 连接
       两者都连接到 Relay-A

WHEN   Peer-A 发送消息

THEN   消息通过 Relay-A 路由到 Peer-B
       无 P2P 直连尝试（multicast scouting 失败不阻塞）
```

### TC-3-BRIDGE-007: Relay 拒绝未认证连接

```
GIVEN  Relay 配置 require_auth = true

WHEN   匿名 Peer（无 Ed25519 签名）尝试连接

THEN   连接拒绝
       日志记录拒绝原因
```

---

## §2 CRDT 持久化与 Sync Protocol（Level 1）

> **Spec 引用**：bus-spec §4.5, §4.6; relay-spec §4.1, §4.2

### TC-3-STORE-001: CRDT 文档持久化到磁盘

```
GIVEN  Relay 运行中，Room R-alpha 有 CRDT 文档
       storage_path = /var/relay/data/

WHEN   Peer-A 写入消息 → CRDT 更新到达 Relay

THEN   CRDT 文档写入 /var/relay/data/rooms/{room_id}/
       重启 Relay 后文档可恢复
```

### TC-3-STORE-002: 离线 Peer 重连后同步

```
GIVEN  Peer-A 在线时发送了 3 条消息
       Peer-B 离线期间未收到

WHEN   Peer-B 重连到 Relay

THEN   Peer-B 收到离线期间的 3 条消息
       CRDT 状态最终一致
       无消息丢失
```

### TC-3-STORE-003: 并发写入 CRDT 自动合并

```
GIVEN  Peer-A 和 Peer-B 同时在线

WHEN   Peer-A 发送 "Hello" 同时 Peer-B 发送 "World"

THEN   Relay 正确处理并发 CRDT 更新
       两条消息都被持久化
       两端最终看到相同的消息列表
```

### TC-3-STORE-004: Timeline Index 分片同步

```
GIVEN  Room R-alpha 的 Timeline Index 有多个分片（shard）

WHEN   Peer 首次加入 Room

THEN   Relay 按需同步相关分片
       Peer 获得完整的消息历史（或指定范围）
```

### TC-3-STORE-005: Content Object 按需拉取

```
GIVEN  Peer 已获取 Timeline Index（含 ref 列表）

WHEN   Peer 请求特定 ref 的 Content Object

THEN   Relay 返回对应的 CRDT 文档
       单次请求延迟 < 50ms
```

### TC-3-STORE-006: Room Config 同步

```
GIVEN  Admin 修改了 Room R-alpha 的 config（如 name 变更）

WHEN   CRDT 更新到达 Relay

THEN   Config 变更持久化
       其他 Peer 收到 Room config 更新事件
```

### TC-3-STORE-007: 存储目录结构正确

```
GIVEN  Relay 运行一段时间后

WHEN   检查存储目录

THEN   目录结构符合 relay-spec §4.2：
       /var/relay/data/
         rooms/{room_id}/index/{shard_id}.yrs
         rooms/{room_id}/content/{ref_id}.yrs
         entities/{entity_id}/identity.json
         blobs/{hash_prefix}/{hash}.blob
```

### TC-3-STORE-008: 签名验证

```
GIVEN  Peer-A 发送的 CRDT 更新包含 Signed Envelope

WHEN   Relay 接收更新

THEN   验证 Ed25519 签名正确
       验证 author 与 envelope signer_id 一致
       签名无效的更新被拒绝
```

### TC-3-STORE-009: 伪造 author 拒绝

```
GIVEN  Peer-A 发送 CRDT 更新，但 author 字段填写了 Peer-B 的 entity_id
       签名仍然是 Peer-A 的

WHEN   Relay 验证

THEN   签名验证失败（signer ≠ author）
       更新被拒绝
       日志记录伪造尝试
```

### TC-3-STORE-010: 大文档同步性能

```
GIVEN  Room R-large 有 10000 条消息

WHEN   新 Peer 首次同步该 Room

THEN   完整同步完成时间 < 30s
       内存使用合理（增量同步，不一次加载全部）
```

### TC-3-STORE-011: Relay 重启后数据完整

```
GIVEN  Relay 运行中，持久化了 5 个 Room 的数据

WHEN   Relay 进程重启

THEN   所有 5 个 Room 数据完整可用
       已连接的 Peer 重连后无数据丢失
       重启到可用时间 < 10s
```

---

## §3 身份注册与公钥服务（Level 1）

> **Spec 引用**：bus-spec §6.2; relay-spec §6

### TC-3-IDENT-001: Entity 注册

```
GIVEN  新用户 Alice 生成 Ed25519 密钥对

WHEN   Alice 向 Relay-A 注册：
       entity_id = "@alice:relay-a.example.com"
       pubkey = <Ed25519 公钥>

THEN   Relay 存储公钥映射
       注册成功返回确认
       后续 Alice 的签名可被 Relay 验证
```

### TC-3-IDENT-002: Entity 重复注册拒绝

```
GIVEN  @alice:relay-a.example.com 已注册

WHEN   另一个密钥对尝试注册同一 entity_id

THEN   注册被拒绝
       返回 ENTITY_EXISTS 错误
       原有公钥不变
```

### TC-3-IDENT-003: 公钥查询

```
GIVEN  @alice:relay-a.example.com 已注册

WHEN   Peer-B 查询 @alice 的公钥

THEN   返回 Alice 的 Ed25519 公钥
       Peer-B 可用该公钥验证 Alice 的签名
```

### TC-3-IDENT-004: 不存在的 Entity 查询

```
WHEN   查询 @unknown:relay-a.example.com 的公钥

THEN   返回 ENTITY_NOT_FOUND 错误
```

### TC-3-IDENT-005: Entity ID 格式验证

```
WHEN   注册 entity_id = "invalid-no-at-sign"

THEN   注册拒绝
       返回 INVALID_ENTITY_ID 错误
       entity_id 必须符合 @name:domain 格式
```

### TC-3-IDENT-006: Entity ID 域名匹配

```
GIVEN  Relay-A 的 domain = "relay-a.example.com"

WHEN   注册 entity_id = "@alice:relay-b.example.com"（域名不匹配）

THEN   注册拒绝
       返回 DOMAIN_MISMATCH 错误
       实体只能在自己的 home relay 注册
```

### TC-3-IDENT-007: Entity 列表查询

```
GIVEN  Relay-A 上注册了 @alice, @bob, @agent-r1

WHEN   Admin 查询所有注册 Entity

THEN   返回 3 个 Entity 的信息列表
       每个含 entity_id, pubkey_fingerprint, registered_at
```

### TC-3-IDENT-008: 密钥轮换

```
GIVEN  @alice:relay-a.example.com 已注册

WHEN   Alice 用旧密钥签名"密钥更新请求"+ 新公钥

THEN   Relay 验证旧密钥签名
       公钥更新为新公钥
       后续使用新密钥验证
```

---

## §4 全局 Blob Store 与 GC（Level 1）

> **Spec 引用**：relay-spec §4.3, §4.4

### TC-3-BLOB-001: Blob 上传

```
GIVEN  Peer-A 已认证

WHEN   上传二进制文件（如 PNG 图片，2MB）

THEN   Relay 存储到 blobs/{hash_prefix}/{sha256_hash}.blob
       返回 blob_hash = "sha256_{hex}"
       后续可通过 hash 下载
```

### TC-3-BLOB-002: Blob 下载

```
GIVEN  blob sha256_abc123 已存储

WHEN   Peer-B 请求下载 sha256_abc123

THEN   返回原始二进制数据
       内容与上传一致（SHA256 验证）
```

### TC-3-BLOB-003: Blob 去重

```
GIVEN  Peer-A 上传了 file.png（hash = sha256_abc123）

WHEN   Peer-B 上传完全相同的文件

THEN   Relay 检测到 hash 已存在
       不重复存储
       返回相同的 blob_hash
```

### TC-3-BLOB-004: Blob 不存在返回错误

```
WHEN   请求下载 sha256_nonexistent

THEN   返回 BLOB_NOT_FOUND 错误
```

### TC-3-BLOB-005: Blob 大小限制

```
GIVEN  Relay 配置 max_blob_size = 50MB

WHEN   Peer 尝试上传 60MB 文件

THEN   上传拒绝
       返回 BLOB_TOO_LARGE 错误
       建议分片上传（Future Work）
```

### TC-3-BLOB-006: Blob GC — 基于引用计数

```
GIVEN  blob sha256_abc123 被 M-001 和 M-002 引用

WHEN   M-001 被删除（tombstone），M-002 仍存在

THEN   blob 不被 GC（引用计数 > 0）

WHEN   M-002 也被删除

THEN   下次 GC 周期时 blob 被回收
```

### TC-3-BLOB-007: Blob GC — 孤儿 blob 清理

```
GIVEN  blob sha256_orphan 存在但无任何消息引用

WHEN   GC 运行（orphan_retention_days = 7，blob 已存在 10 天）

THEN   blob 被删除
       释放存储空间
```

### TC-3-BLOB-008: Blob GC — 保留期内不删除

```
GIVEN  blob sha256_recent 为孤儿但仅存在 3 天
       orphan_retention_days = 7

WHEN   GC 运行

THEN   blob 不被删除（未超过保留期）
```

### TC-3-BLOB-009: Blob GC 执行不影响服务

```
GIVEN  GC 正在运行

WHEN   Peer 同时上传和下载 blob

THEN   上传/下载正常工作
       GC 不影响正在使用的 blob
```

### TC-3-BLOB-010: Blob 存储统计

```
WHEN   查询 Blob Store 统计

THEN   返回：
       total_blobs: 数量
       total_size_bytes: 总大小
       orphan_blobs: 孤儿数量
       oldest_blob: 最早上传时间
```

---

## §5 Access Control（Level 2）

> **Spec 引用**：bus-spec §6.4

### TC-3-ACL-001: Room 成员访问控制

```
GIVEN  Room R-alpha 成员列表：[E-alice, E-bob]
       Relay 启用 ACL

WHEN   E-outsider（非成员）尝试读取 R-alpha 的 CRDT 文档

THEN   Relay 拒绝请求
       返回 NOT_A_MEMBER 错误
```

### TC-3-ACL-002: Room 成员正常访问

```
GIVEN  Room R-alpha 成员列表：[E-alice, E-bob]

WHEN   E-alice 请求 R-alpha 的 CRDT 文档

THEN   请求成功
       返回文档数据
```

### TC-3-ACL-003: Power Level — Admin 操作

```
GIVEN  E-alice 在 R-alpha 的 power_level = admin (100)
       E-bob 的 power_level = member (50)

WHEN   E-alice 修改 Room config
THEN   修改成功

WHEN   E-bob 尝试修改 Room config
THEN   修改被拒绝（power_level 不足）
```

### TC-3-ACL-004: Entity 删除消息权限

```
GIVEN  M-001 的 author = E-alice

WHEN   E-alice 删除 M-001
THEN   删除成功（author 可删除自己的消息）

WHEN   E-bob（非 admin）尝试删除 M-001
THEN   删除被拒绝
```

### TC-3-ACL-005: Room 邀请权限

```
GIVEN  R-alpha 配置 invite_level = 50（member 可邀请）

WHEN   E-bob (power_level=50) 邀请 E-carol
THEN   邀请成功

GIVEN  R-beta 配置 invite_level = 100（仅 admin 可邀请）

WHEN   E-bob (power_level=50) 邀请 E-carol 到 R-beta
THEN   邀请被拒绝
```

### TC-3-ACL-006: 离开 Room 后不可访问

```
GIVEN  E-bob 是 R-alpha 成员

WHEN   E-bob 执行 leave

THEN   E-bob 不再是成员
       后续 E-bob 对 R-alpha 的访问被拒绝
```

### TC-3-ACL-007: ACL 绕过检测

```
GIVEN  E-attacker 构造 Zenoh key pattern 直接读取 Room 数据
       跳过 Relay 的 ACL 检查层

WHEN   请求到达 Relay

THEN   Relay 拦截请求
       验证请求者身份和 Room 成员关系
       非成员请求被拒绝
```

### TC-3-ACL-008: ACL 变更实时生效

```
GIVEN  E-carol 当前是 R-alpha 成员

WHEN   Admin 将 E-carol 从 R-alpha 移除

THEN   E-carol 立即失去访问权限
       正在进行的同步连接被断开
```

---

## §6 Quota 管理（Level 2）

> **Spec 引用**：relay-spec §5.1–§5.3

### TC-3-QUOTA-001: Entity 存储配额

```
GIVEN  E-alice 的 storage_quota = 100MB
       当前已使用 90MB

WHEN   E-alice 上传 15MB blob

THEN   上传拒绝
       返回 QUOTA_EXCEEDED 错误
       提示当前使用量和配额
```

### TC-3-QUOTA-002: Entity 存储配额内正常上传

```
GIVEN  E-alice 的 storage_quota = 100MB
       当前已使用 90MB

WHEN   E-alice 上传 5MB blob

THEN   上传成功
       配额更新为 95MB/100MB
```

### TC-3-QUOTA-003: Room 存储配额

```
GIVEN  R-alpha 的 room_storage_quota = 500MB

WHEN   Room 总存储（CRDT 文档 + blob）接近 500MB

THEN   新的大文件上传被拒绝
       小消息仍可发送（文本消息远小于配额）
```

### TC-3-QUOTA-004: 带宽配额 — 日限

```
GIVEN  E-alice 的 bandwidth_daily = 1GB
       今日已传输 950MB

WHEN   E-alice 请求下载 100MB blob

THEN   请求拒绝
       返回 BANDWIDTH_EXCEEDED 错误
       提示明日重置
```

### TC-3-QUOTA-005: 配额查询

```
GIVEN  E-alice 已注册

WHEN   查询 E-alice 的配额使用情况

THEN   返回：
       storage: { used: 95MB, limit: 100MB }
       bandwidth_daily: { used: 500MB, limit: 1GB, resets_at: "2026-03-04T00:00:00Z" }
       rooms: { current: 5, limit: 20 }
```

### TC-3-QUOTA-006: 超额软处理 — 警告

```
GIVEN  E-alice 存储使用率 > 80%

WHEN   E-alice 上传文件

THEN   上传成功
       响应中包含警告：QUOTA_WARNING (80% used)
```

### TC-3-QUOTA-007: 超额硬处理 — 只读模式

```
GIVEN  E-alice 存储使用率 = 100%

WHEN   E-alice 尝试上传文件
THEN   上传拒绝

WHEN   E-alice 尝试发送文本消息
THEN   消息发送成功（文本消息不计入 blob 配额）
```

### TC-3-QUOTA-008: Admin 调整配额

```
GIVEN  E-alice 存储配额 = 100MB

WHEN   Admin 将 E-alice 配额调整为 200MB

THEN   配额立即生效
       E-alice 后续上传使用新配额
```

### TC-3-QUOTA-009: 默认配额应用

```
GIVEN  Relay 配置 default_quota = { storage: 50MB, bandwidth_daily: 500MB }

WHEN   新 Entity @dave 注册

THEN   @dave 自动获得默认配额
       无需 Admin 手动设置
```

### TC-3-QUOTA-010: Room 数量配额

```
GIVEN  E-alice 的 max_rooms = 20
       当前已创建 20 个 Room

WHEN   E-alice 尝试创建新 Room

THEN   创建被拒绝
       返回 ROOM_LIMIT_EXCEEDED 错误
```

---

## §7 Admin API（Level 2+）

> **Spec 引用**：relay-spec §7.1–§7.5

### TC-3-ADMIN-001: Admin API 认证

```
GIVEN  Relay 配置 admin_token

WHEN   带有效 token 请求 Admin API
THEN   请求成功

WHEN   无 token 或 token 无效请求 Admin API
THEN   返回 401 Unauthorized
```

### TC-3-ADMIN-002: GET /admin/status

```
GIVEN  Relay 运行中

WHEN   GET /admin/status

THEN   200 OK
       { "domain": "relay-a.example.com",
         "uptime": "72h",
         "peers_connected": 5,
         "rooms": 12,
         "entities": 30,
         "storage_used": "2.3GB",
         "version": "0.1.0" }
```

### TC-3-ADMIN-003: GET /admin/entities

```
GIVEN  Relay 上有 30 个注册 Entity

WHEN   GET /admin/entities?limit=10

THEN   200 OK
       返回前 10 个 Entity 信息（含 entity_id, registered_at, storage_used）
       支持分页
```

### TC-3-ADMIN-004: PUT /admin/entities/{entity_id}/quota

```
WHEN   PUT /admin/entities/@alice:relay-a.example.com/quota
       { "storage": "200MB", "bandwidth_daily": "2GB" }

THEN   200 OK
       E-alice 配额更新
```

### TC-3-ADMIN-005: GET /admin/rooms

```
WHEN   GET /admin/rooms

THEN   200 OK
       返回所有 Room 列表（含 room_id, name, members_count, storage_used）
```

### TC-3-ADMIN-006: POST /admin/gc/trigger

```
WHEN   POST /admin/gc/trigger

THEN   200 OK
       { "status": "started", "estimated_duration": "~5min" }
       后台开始 GC
```

### TC-3-ADMIN-007: GET /admin/gc/status

```
GIVEN  GC 正在运行

WHEN   GET /admin/gc/status

THEN   200 OK
       { "running": true, "progress": 0.6,
         "blobs_scanned": 5000, "blobs_deleted": 120,
         "space_reclaimed": "340MB" }
```

### TC-3-ADMIN-008: Admin API 重放攻击防护

```
GIVEN  攻击者截获了一个有效的 Admin API 请求

WHEN   30 分钟后重放该请求

THEN   请求被拒绝（timestamp 过期或 nonce 已使用）
```

### TC-3-ADMIN-009: DELETE /admin/entities/{entity_id}

```
GIVEN  @spammer:relay-a.example.com 被标记为恶意

WHEN   DELETE /admin/entities/@spammer:relay-a.example.com

THEN   Entity 被停用
       公钥标记为 revoked
       该 Entity 后续连接被拒绝
       Room 中该 Entity 的历史消息保留（不删除）
```

---

## §8 监控与健康检查（Level 2+）

> **Spec 引用**：relay-spec §8.1, §8.2

### TC-3-MON-001: Prometheus 指标端点

```
GIVEN  Relay 运行中

WHEN   GET /metrics

THEN   返回 Prometheus 格式指标：
       relay_peers_connected（当前连接数）
       relay_rooms_total（Room 总数）
       relay_crdt_sync_duration_seconds（同步延迟直方图）
       relay_blob_store_bytes（Blob 存储量）
       relay_requests_total（请求计数，按 method 分）
```

### TC-3-MON-002: 健康检查端点

```
WHEN   GET /healthz

THEN   200 OK  { "status": "healthy" }
       检查项：Zenoh Router 运行、存储可写、内存 < 阈值
```

### TC-3-MON-003: 健康检查 — 降级状态

```
GIVEN  存储接近满（> 90%）

WHEN   GET /healthz

THEN   200 OK  { "status": "degraded", "warnings": ["storage > 90%"] }
```

### TC-3-MON-004: 就绪检查

```
GIVEN  Relay 刚启动，正在加载持久化数据

WHEN   GET /readyz

THEN   503 Service Unavailable（尚未就绪）

WHEN   数据加载完成后 GET /readyz

THEN   200 OK  { "status": "ready" }
```

### TC-3-MON-005: 连接事件日志

```
GIVEN  Relay 运行中

WHEN   Peer-A 连接、Peer-B 断开

THEN   结构化日志记录：
       { "event": "peer_connected", "entity_id": "@alice:...", "timestamp": "..." }
       { "event": "peer_disconnected", "entity_id": "@bob:...", "reason": "timeout" }
```

### TC-3-MON-006: 存储使用趋势

```
GIVEN  Relay 运行 7 天

WHEN   GET /admin/stats/storage

THEN   返回每日存储使用量趋势：
       [{ "date": "2026-02-25", "used_bytes": ... }, ...]
```

---

## §9 多 Relay 协同（Level 1+）

> **Spec 引用**：bus-spec §6.5; relay-spec §9

### TC-3-MULTI-001: 跨 Relay Entity 解析

```
GIVEN  @alice:relay-a.example.com 在 Relay-A 注册
       @bob:relay-b.example.com 在 Relay-B 注册
       Relay-A 和 Relay-B 互相已知

WHEN   Relay-A 上的 Peer 请求 @bob 的公钥

THEN   Relay-A 向 Relay-B 请求公钥
       返回 @bob 的公钥
       本地缓存结果
```

### TC-3-MULTI-002: 跨 Relay Room 同步

```
GIVEN  R-cross 的成员分布在 Relay-A 和 Relay-B
       @alice 在 Relay-A，@bob 在 Relay-B

WHEN   @alice 在 R-cross 发送消息

THEN   CRDT 更新从 Relay-A 路由到 Relay-B
       @bob 收到消息
       两端 Timeline 最终一致
```

### TC-3-MULTI-003: 跨 Relay Blob 拉取

```
GIVEN  blob sha256_abc123 存储在 Relay-A
       @bob 在 Relay-B

WHEN   @bob 请求下载 sha256_abc123

THEN   Relay-B 从 Relay-A 拉取 blob
       blob 缓存到 Relay-B（可选）
       @bob 收到完整文件
```

### TC-3-MULTI-004: Relay 间连接断开处理

```
GIVEN  Relay-A 和 Relay-B 之间的链路断开

WHEN   @alice (Relay-A) 发送消息到跨 Relay Room

THEN   消息在 Relay-A 侧持久化
       Relay-B 暂时不可达
       链路恢复后自动同步
       CRDT 保证最终一致性
```

### TC-3-MULTI-005: 跨域注册拒绝

```
GIVEN  @alice:relay-a.example.com 已在 Relay-A 注册

WHEN   有人尝试在 Relay-B 注册 @alice:relay-a.example.com

THEN   Relay-B 拒绝（domain 不匹配）
       返回 DOMAIN_MISMATCH 错误
```

---

## §10 Discovery 索引（Level 3）

> **Spec 引用**：relay-spec §7.6; bus-spec §6.3

### TC-3-DISC-001: Profile 索引

```
GIVEN  @alice 发布了 Profile：{ display_name: "Alice Chen", bio: "Rust developer" }

WHEN   Relay 的 Discovery 索引处理 Profile 更新

THEN   @alice 可被搜索发现
       搜索 "Rust developer" 返回 @alice
```

### TC-3-DISC-002: Profile 搜索

```
GIVEN  Relay 上有 50 个 Entity 发布了 Profile

WHEN   GET /api/discovery?q=developer&limit=10

THEN   返回匹配 "developer" 的 Entity 列表（最多 10 个）
       按相关性排序
```

### TC-3-DISC-003: Room 发现

```
GIVEN  R-alpha 配置 discoverable = true

WHEN   GET /api/discovery/rooms?q=feature

THEN   返回 R-alpha（name 含 "feature"）
       不返回 discoverable = false 的 Room
```

### TC-3-DISC-004: Discovery 隐私控制

```
GIVEN  @bob 的 Profile 设置 discoverable = false

WHEN   搜索 "bob"

THEN   @bob 不出现在搜索结果中
```

### TC-3-DISC-005: Socialware 能力发现

```
GIVEN  TaskArena 在 Platform Bus 发布了 capability manifest

WHEN   GET /api/discovery/services?capability=task_management

THEN   返回 TaskArena 的信息
```

### TC-3-DISC-006: Discovery 索引更新延迟

```
GIVEN  @alice 更新了 Profile

WHEN   立即搜索

THEN   索引更新延迟 < 5s
       5 秒后搜索可发现新 Profile
```

---

## §11 Web Fallback（Level 3）

> **Spec 引用**：relay-spec §7.7; architecture §1.5.4; EEP-0001

### TC-3-WEB-001: Room URI → HTML 预览

```
GIVEN  R-alpha 存在于 Relay-A

WHEN   浏览器访问 https://relay-a.example.com/r/{room_id}

THEN   返回 HTML 页面：
       Room 名称、成员数、最近消息预览
       "Open in ezagent" 按钮（Deep Link）
```

### TC-3-WEB-002: Message URI → HTML 预览

```
GIVEN  M-001 存在于 R-alpha

WHEN   浏览器访问 https://relay-a.example.com/r/{room_id}/m/{ref_id}

THEN   返回 HTML 页面：
       消息内容、作者、时间
       上下文消息（前后各 2 条）
       "Open in ezagent" 按钮
```

### TC-3-WEB-003: Entity URI → HTML 预览

```
GIVEN  @alice 已注册且有 Profile

WHEN   浏览器访问 https://relay-a.example.com/e/@alice

THEN   返回 HTML 页面：
       显示名称、bio
       "Send Message" 按钮（Deep Link 到创建 Room）
```

### TC-3-WEB-004: 不存在的资源 → 404

```
WHEN   访问 https://relay-a.example.com/r/nonexistent

THEN   返回 404 HTML 页面
       提示资源不存在
```

### TC-3-WEB-005: Web Fallback 隐私控制

```
GIVEN  R-private 配置 web_preview = false

WHEN   浏览器访问 R-private 的 Web Fallback URL

THEN   返回 403 页面
       提示 "Preview not available for this room"
       仍然显示 "Open in ezagent" 按钮
```

### TC-3-WEB-006: Content-Type 协商

```
GIVEN  R-alpha 存在

WHEN   请求 Accept: application/json

THEN   返回 JSON 格式的资源数据

WHEN   请求 Accept: text/html

THEN   返回 HTML 预览页面
```

### TC-3-WEB-007: Web Fallback 安全头

```
WHEN   访问任何 Web Fallback 页面

THEN   响应头包含：
       X-Frame-Options: DENY
       Content-Security-Policy: default-src 'self'
       X-Content-Type-Options: nosniff
```

### TC-3-WEB-008: ezagent:// → https:// 重定向

```
GIVEN  无 ezagent 客户端的浏览器

WHEN   点击 ezagent://relay-a.example.com/r/{room_id}

THEN   scheme handler 未注册
       Fallback 到 https://relay-a.example.com/r/{room_id}
       显示 Web 预览 + 安装提示
```

---

## §12 部署模式验证（Level 1/2/3）

> **Spec 引用**：relay-spec §10

### TC-3-DEPLOY-001: Self-Host 单节点部署

```
GIVEN  单台服务器运行 Relay

WHEN   按 relay-spec §10.1 配置和启动

THEN   Relay 正常运行
       单节点满足 Level 1 全部功能
       支持 < 50 个并发 Peer
```

### TC-3-DEPLOY-002: Docker 部署

```
GIVEN  Relay Docker 镜像

WHEN   docker run -p 7448:7448 -v /data:/var/relay/data ezagent/relay

THEN   Relay 正常启动
       数据持久化到宿主机 /data
       配置可通过环境变量覆盖
```

### TC-3-DEPLOY-003: 组织部署 — 多 Relay

```
GIVEN  组织部署 2 个 Relay（Relay-A, Relay-B）

WHEN   按 relay-spec §10.2 配置互联

THEN   跨 Relay Room 同步正常
       Entity 跨域解析正常
       任一 Relay 宕机不影响另一个的本地功能
```

### TC-3-DEPLOY-004: 配置文件验证

```
GIVEN  relay.toml 缺少必填字段 domain

WHEN   Relay 启动

THEN   启动失败
       输出明确错误：'domain' is required in relay.toml
       exit code = 1
```

### TC-3-DEPLOY-005: 优雅停机

```
GIVEN  Relay 运行中，5 个 Peer 已连接

WHEN   发送 SIGTERM

THEN   Relay 开始优雅停机：
       通知已连接 Peer
       等待进行中的同步完成（超时 30s）
       持久化所有待写入数据
       关闭 Zenoh Router
       exit code = 0
```

---

## 附录：Test Case 统计

| 区域 | 编号范围 | 数量 |
|------|---------|------|
| Zenoh Router + TLS | TC-3-BRIDGE-001~007 | 7 |
| CRDT 持久化 + Sync | TC-3-STORE-001~011 | 11 |
| 身份注册与公钥 | TC-3-IDENT-001~008 | 8 |
| 全局 Blob Store + GC | TC-3-BLOB-001~010 | 10 |
| Access Control | TC-3-ACL-001~008 | 8 |
| Quota 管理 | TC-3-QUOTA-001~010 | 10 |
| Admin API | TC-3-ADMIN-001~009 | 9 |
| 监控与健康检查 | TC-3-MON-001~006 | 6 |
| 多 Relay 协同 | TC-3-MULTI-001~005 | 5 |
| Discovery 索引 | TC-3-DISC-001~006 | 6 |
| Web Fallback | TC-3-WEB-001~008 | 8 |
| 部署模式验证 | TC-3-DEPLOY-001~005 | 5 |
| **合计** | | **93** |

### Gate 统计

| Gate | 区域 | TC 数 |
|------|------|-------|
| **Level 1: Bridge** | BRIDGE + STORE + IDENT + BLOB + MULTI | ~41 |
| **Level 2: Managed** | ACL + QUOTA + ADMIN + MON | ~33 |
| **Level 3: Public** | DISC + WEB | ~14 |
| **跨 Level** | DEPLOY | 5 |

### Error Fixture 清单

| ID | 描述 | 对应 TC |
|----|------|---------|
| ERR-RELAY-001 | Entity 注册冲突（重复 entity_id） | TC-3-IDENT-002 |
| ERR-RELAY-002 | 跨域注册（domain mismatch） | TC-3-IDENT-006, TC-3-MULTI-005 |
| ERR-RELAY-003 | ACL 绕过尝试（非成员访问） | TC-3-ACL-001, TC-3-ACL-007 |
| ERR-RELAY-004 | Admin API 重放攻击 | TC-3-ADMIN-008 |
| ERR-RELAY-005 | 超额 Blob 上传 | TC-3-BLOB-005, TC-3-QUOTA-001 |
| ERR-RELAY-006 | 未授权 Config 写入 | TC-3-ACL-003 |

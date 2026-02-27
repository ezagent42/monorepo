# ezagent Relay Specification v0.9.2

> **状态**：Architecture Draft
> **日期**：2026-02-27
> **前置文档**：ezagent-bus-spec-v0.9.2
> **作者**：Allen & Claude collaborative design

本文档定义 Public Relay 作为独立服务的完整运营规范。协议层行为要求（Relay MUST/SHOULD 做什么）定义在 bus-spec §6 中；本文档定义 Relay 作为可独立部署的服务的运营接口、存储管理、配额控制和监控能力。

---

## 目录

```
§1   Introduction
§2   Relay 职责总览
§3   合规性等级
§4   存储管理
     §4.1  数据分类
     §4.2  存储路径
     §4.3  全局 Blob Store
     §4.4  Blob GC
§5   配额管理（Quota）
     §5.1  Quota 模型
     §5.2  Quota 执行
     §5.3  超额处理
§6   Entity 管理
§7   Admin API
     §7.1  认证
     §7.2  Relay 状态
     §7.3  Quota 管理
     §7.4  Entity 管理
     §7.5  Blob GC
     §7.6  Discovery（Level 3）
§8   监控与运维
§9   多 Relay 协同
§10  部署模式
变更日志
```

---

## §1 Introduction

### §1.1 定位

Public Relay 是 ezagent 网络中提供跨网络桥接、离线恢复、身份注册和实体发现的**可选公共服务**。Relay 不拥有数据——它缓存和转发数据。

Relay 是独立于 ezagent Peer 的服务进程。Peer 通过 `pip install ezagent` 安装；Relay 通过独立的部署方式（容器镜像、二进制分发等）运行。

### §1.2 与 bus-spec 的关系

| 关注点 | 定义位置 |
|--------|---------|
| Relay 的协议行为（Sync Protocol、Access Control、签名验证） | bus-spec §4, §6 |
| Relay 的运营管理（Quota、GC、Admin API、监控） | 本文档 |
| Relay 的网络角色（Zenoh router mode、TLS） | bus-spec §6.2 |

### §1.3 设计原则

- **Relay 是邮递员，不是房东**。数据的权威来源是 CRDT 文档的聚合状态，不是 Relay 的存储。
- **可替换**。一个 Room 可以配置多个 Relay（bus-spec §6.5）。任何单个 Relay 下线不影响数据完整性（只要有其他 Relay 或在线 Peer）。
- **运营自治**。每个 Relay 运营方自行决定存储配额、服务条款和定价策略。协议不标准化这些。

---

## §2 Relay 职责总览

| 职责 | 必需性 | 说明 |
|------|--------|------|
| **身份注册** | MUST | 存储 entity_id → public_key 映射，验证 local_part 唯一性 |
| **公钥分发** | MUST | 对外提供公钥查询服务，供 P2P 身份验证 |
| **NAT 桥接** | MUST | 以 Zenoh router mode 运行，桥接跨网络流量 |
| **CRDT 持久化** | MUST | 持久化 `persistent: true` 的数据（见 bus-spec §4.6.2） |
| **Sync Protocol** | MUST | 支持 Initial Sync + Live Sync（见 bus-spec §4.5） |
| **全局 Blob Store** | MUST | 存储全局去重的 Blob 内容（见 §4.3） |
| **Access Control** | SHOULD | 验证入站 CRDT update 的合法性（见 bus-spec §6.4） |
| **Discovery** | MAY (Level 3) | Profile 索引、实体搜索 |
| **Push Gateway** | MAY (Level 3) | 移动设备推送通知 |

---

## §3 合规性等级

| 等级 | 要求 | 适用场景 |
|------|------|---------|
| **Level 1: Basic** | Bridge + Cold Storage + 身份注册 + Blob Store | Self-Host / 开发测试 |
| **Level 2: Secured** | Level 1 + Access Control (ACL Interceptor) + Quota | 组织内部 |
| **Level 3: Full** | Level 2 + Discovery Index + Push Gateway | 公共服务 |

- [MUST] 加入 ezagent 网络的 Public Relay 至少满足 Level 1。
- [SHOULD] 生产环境 Public Relay 满足 Level 2。

---

## §4 存储管理

### §4.1 数据分类

Relay 存储两类数据：

**A. CRDT 同步数据**（参与 Sync Protocol）

| 数据 | 存储要求 | 说明 |
|------|---------|------|
| Room Config | MUST 持久化 | 房间配置、成员列表 |
| Timeline Index | MUST 持久化 | 消息索引（per-shard） |
| Content Doc | MUST 持久化 | 消息内容 |
| Extension Doc | MUST 持久化 | 各 Extension 独立文档 |
| Global Blob | MUST 持久化 | 全局去重的二进制内容 |
| Blob Ref | MUST 持久化 | per-room 的 Blob 引用 |
| Ephemeral | MUST NOT 持久化 | Presence / Awareness |

**B. Relay 本地数据**（不参与 Sync Protocol）

| 数据 | 说明 | Compliance Level |
|------|------|-----------------|
| Relay 配置 | 合规性等级、TLS 证书、管理员 Entity ID | Level 1+ |
| Entity 注册表 | entity_id → public_key 映射 | Level 1+ |
| Quota 配置 | per-entity 存储配额 | Level 2+ |
| Quota 用量统计 | per-entity 当前用量 | Level 2+ |
| Blob 引用计数 | blob_hash → ref_count | Level 1+ |
| Discovery 索引 | Entity Profile 聚合索引 | Level 3 |
| Proxy Profile 缓存 | 外部 Relay Entity 的本地缓存 | Level 3 |
| State Vector 缓存 | 与各 Peer/Relay 的 state vector | Level 1+ |

### §4.2 存储路径

```
{relay_data_dir}/
├── config.toml                          # Relay 自身配置
├── entities/                            # Entity 注册表
│   └── @{entity_id}                    # entity_id → public_key
├── quota/
│   ├── defaults.toml                   # 默认 quota 配置
│   └── overrides/
│       └── @{entity_id}.toml           # per-entity quota 覆盖
├── blobs/
│   ├── index/                          # blob_hash → ref_count 索引
│   └── data/                           # 实际 blob 内容（按 hash 前缀分桶）
│       ├── a1/b2/a1b2c3d4...           # SHA-256 hash 前 4 字符分两级目录
│       └── ...
├── discovery/
│   ├── profiles/                       # Entity Profile 聚合索引
│   └── proxy-profiles/
│       └── @{entity_id}               # 外部 Entity 的 proxy profile
└── sync/
    └── {room_id}/
        └── state-vectors              # State vector 缓存
```

- [MUST] Relay 本地数据 MUST NOT 通过 Sync Protocol 发布给 Peer 或其他 Relay。
- [MUST] Entity 注册表 MUST 对外提供公钥查询接口。

### §4.3 全局 Blob Store

Relay 维护全局去重的 Blob 存储。

**存储模型**：

```
CRDT 同步层:
  ezagent/blob/{sha256_hash}                    # 全局 Blob 内容（immutable）
  ezagent/{room_id}/ext/media/blob-ref/{hash}   # per-room Blob 引用（元信息）

Relay 本地层:
  blob_index: blob_hash → { ref_count, total_size, created_at }
```

**去重规则**：

- [MUST] 收到 Blob 写入请求时，Relay MUST 先检查 `blob_hash` 是否已存在。
- [MUST] 已存在时，Relay MUST 跳过内容写入，仅更新引用计数。
- [MUST] 不存在时，Relay MUST 写入内容并初始化引用计数为 1。

**访问控制**：

- [MUST] Blob 内容的读取请求 MUST 验证请求者属于至少一个引用了该 blob 的 Room。
- [MUST] 验证逻辑：`∃ room_id WHERE (signer ∈ room.members AND blob-ref/{hash} exists in room)`。

### §4.4 Blob GC

- [MUST] Relay MUST 维护 Blob 引用计数。
- [MUST] 当 per-room Blob Ref 被删除时（Room 删除或 Ref 删除），Relay MUST 递减对应 Blob 的引用计数。
- [SHOULD] 当引用计数降为 0 时，Relay SHOULD 在 grace period（推荐 7 天）后删除 Blob 内容。
- [SHOULD] Relay SHOULD 支持手动触发 GC 扫描（通过 Admin API）。
- [MAY] Relay MAY 定期执行全量 GC 扫描，重建引用计数（修复计数漂移）。

**GC 流程**：

```
1. 扫描所有 ezagent/*/ext/media/blob-ref/* 路径
2. 构建 blob_hash → Set<room_id> 的引用映射
3. 对比 Blob 本地索引
4. 引用计数 = 0 且 created_at + grace_period < now 的 Blob → 标记删除
5. 执行物理删除
```

---

## §5 配额管理（Quota）

### §5.1 Quota 模型

每个 Entity 在 Relay 上有以下配额维度：

| 维度 | 说明 | 推荐默认值 |
|------|------|-----------|
| `storage_total` | Entity 参与的所有 Room 的 CRDT 数据总量 | 1 GB |
| `blob_total` | Entity 上传的 Blob 总量（按上传者计） | 500 MB |
| `blob_single_max` | 单个 Blob 的大小上限 | 50 MB |
| `rooms_max` | Entity 可参与的 Room 数量上限 | 500 |

- [MUST] Relay MUST 为每个 Entity 维护用量统计。
- [SHOULD] Quota 默认值 SHOULD 可配置（`quota/defaults.toml`）。
- [MAY] Relay MAY 为特定 Entity 设置不同的 quota（`quota/overrides/`）。

### §5.2 Quota 执行

- [MUST] Blob 上传时，Relay MUST 检查 `blob_single_max` 和 `blob_total`。超额时拒绝上传（返回 quota_exceeded 错误）。
- [SHOULD] Room 创建时，Relay SHOULD 检查 `rooms_max`。超额时拒绝创建。
- [SHOULD] CRDT update 写入时，Relay SHOULD 检查 `storage_total`。超额时拒绝写入。
- [MUST] Quota 检查 MUST 在 Access Control 之后、持久化之前执行。

### §5.3 超额处理

- [MUST] Quota 超额时，Relay MUST 返回明确的错误码和剩余额度信息。
- [MUST NOT] Relay MUST NOT 因 quota 超额而删除已有数据。已持久化的数据不受后续 quota 变更影响。
- [SHOULD] Relay SHOULD 在 Entity 用量达到 80% 时，在 Sync 响应中附带 quota 警告。

---

## §6 Entity 管理

- [MUST] Relay MUST 支持 Entity 注册（存储 entity_id → public_key）。
- [MUST] Relay MUST 验证 local_part 在该域内的唯一性。
- [MUST] Relay MUST 通过 TLS 加密连接提供注册服务。
- [SHOULD] Relay SHOULD 支持 Entity 吊销（revoke）：标记 Entity 为已吊销，后续公钥查询返回 revoked 状态。
- [MAY] Relay MAY 支持 Entity 密钥轮换（key rotation）：更新 public_key 映射，旧公钥标记为 deprecated。

---

## §7 Admin API

### §7.1 认证

- [MUST] Admin API MUST 通过 Entity 签名认证（与协议层相同的 Ed25519 机制）。
- [MUST] Relay 配置中 MUST 声明 admin Entity ID 列表。
- [MUST] 非 admin Entity 的 Admin API 请求 MUST 被拒绝（返回 403）。

### §7.2 Relay 状态

```
GET /admin/status

Response:
  relay_domain:      string
  compliance_level:  integer
  uptime:            duration
  connected_peers:   integer
  storage:
    total_used:      bytes
    crdt_data:       bytes
    blob_data:       bytes
    blob_count:      integer
    entity_count:    integer
    room_count:      integer
```

### §7.3 Quota 管理

```
GET  /admin/quota/defaults              # 查看默认 quota
PUT  /admin/quota/defaults              # 更新默认 quota

GET  /admin/quota/entities              # 列出所有 Entity quota 使用情况
GET  /admin/quota/entities/{entity_id}  # 查看单个 Entity 的 quota + 用量
PUT  /admin/quota/entities/{entity_id}  # 设置 Entity quota 覆盖
DELETE /admin/quota/entities/{entity_id}  # 删除覆盖，回退到默认

Response (GET entity):
  entity_id:    string
  quota:
    storage_total:    bytes
    blob_total:       bytes
    blob_single_max:  bytes
    rooms_max:        integer
    source:           "default" | "override"
  usage:
    storage_used:     bytes
    blob_used:        bytes
    rooms_count:      integer
```

### §7.4 Entity 管理

```
GET    /admin/entities                   # 列出已注册 Entity
GET    /admin/entities/{entity_id}       # 查看 Entity 详情
POST   /admin/entities/{entity_id}/revoke  # 吊销 Entity
```

### §7.5 Blob GC

```
POST   /admin/gc             # 触发 GC 扫描
  body: { dry_run: boolean }

Response:
  blobs_scanned:     integer
  orphaned_blobs:    integer
  reclaimable_bytes: bytes
  deleted:           integer   # dry_run=true 时为 0
```

### §7.6 Discovery（Level 3）

```
GET    /admin/discovery/stats           # Discovery 索引统计
POST   /admin/discovery/rebuild         # 重建索引
```

---

## §8 监控与运维

### §8.1 推荐监控指标

| 指标 | 类型 | 说明 |
|------|------|------|
| `relay_connected_peers` | gauge | 当前连接的 Peer 数 |
| `relay_storage_bytes_total` | gauge | 总存储使用量 |
| `relay_blob_count` | gauge | Blob 数量 |
| `relay_blob_bytes_total` | gauge | Blob 存储量 |
| `relay_sync_operations_total` | counter | Sync 操作次数（按类型） |
| `relay_quota_rejections_total` | counter | Quota 拒绝次数 |
| `relay_gc_reclaimed_bytes_total` | counter | GC 回收的字节数 |
| `relay_entity_registrations_total` | counter | Entity 注册次数 |

### §8.2 健康检查

```
GET /health

Response:
  status:   "healthy" | "degraded" | "unhealthy"
  checks:
    storage:   "ok" | "warning" | "error"
    zenoh:     "ok" | "error"
    tls:       "ok" | "error"
```

---

## §9 多 Relay 协同

（行为要求定义在 bus-spec §6.5，此处补充运营细节）

- [MUST] 同一 Room 的多个 Relay 之间 MUST 自动同步 CRDT 数据。
- [MUST] 全局 Blob Store 在多 Relay 间 MUST 独立管理。每个 Relay 维护自己的 Blob 存储和引用计数。Blob 内容通过正常的 Sync Protocol 在 Relay 间按需传播。
- [SHOULD] 新 Relay 加入后 SHOULD 自动发现已有 Relay 并开始同步。
- [MAY] Relay 间 MAY 实现 Blob 去重协调（避免两个 Relay 各存一份相同 Blob），但这不是协议要求。

---

## §10 部署模式

### §10.1 Self-Host（开发 / 小团队）

```bash
# 最简部署
ezagent-relay start \
  --domain relay.mycompany.com \
  --tls-cert /path/to/cert.pem \
  --tls-key /path/to/key.pem \
  --data-dir /var/lib/ezagent-relay
```

- 使用 mkcert 自签 CA（局域网）或 Let's Encrypt（公网）
- Level 1 合规即可
- 默认 quota 适合 <50 用户

### §10.2 组织部署

- Level 2 合规
- 配置 Access Control
- 根据组织规模调整 quota 默认值
- 接入组织的监控系统（Prometheus / Grafana）

### §10.3 公共服务

- Level 3 合规
- 启用 Discovery Index + Push Gateway
- 配置分级 quota（免费 / 付费）
- 高可用部署（多实例 + 负载均衡）

---

## 变更日志

| 版本 | 日期 | 变更 |
|------|------|------|
| 0.1 | 2026-02-27 | 初始版本。从 bus-spec §6 提取 Relay 运营规范。新增 Quota 管理、全局 Blob Store、Blob GC、Admin API |

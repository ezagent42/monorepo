# CLAUDE.md — relay（中继服务）

Relay 是 EZAgent 的公共中继服务，为跨网络的 P2P 节点提供桥接。License: Apache 2.0。

## 定位

- Relay 是**邮递员**，不拥有用户数据，只负责转发
- 同一局域网内的节点通过 multicast 自动发现、直连（延迟 <1ms）
- 跨网络时，Relay 提供桥接（公网中转）
- 支持联邦拓扑：选择性共享，非全盘托管

## 技术栈

- **Rust** — 服务实现
- **zenoh** — 网络通信层（与 ezagent 核心共享）
- 无状态设计：Relay 不持久化消息内容

## 开发指南

### Rust 规范

- 使用 `cargo fmt` 和 `cargo clippy`
- 网络错误处理要考虑断线重连、超时、流量控制
- 公开 API 必须有文档注释（`///`）

### 测试

- 网络测试使用 mock transport 避免依赖真实网络
- 运行测试：`cargo test`

### 安全考虑

- Relay 不应解密或缓存转发的内容
- 连接认证基于 Identity 协议层
- 流量限制和滥用防护是核心关注点

## Commit scope

```
feat(relay): add websocket reconnection
fix(relay): handle connection timeout gracefully
```

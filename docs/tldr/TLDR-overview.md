# ezagent — Programmable Organization OS

> 一句话：**ezagent 是为人和 AI Agent 共同设计的组织操作系统。Socialware 是跑在上面的程序。**

---

## 组织是人类最古老的"操作系统"

从部落到公司，人类一直在用"组织"来协调集体行动——定义谁做什么（角色）、怎么做（流程）、做不到怎么办（承诺）。这套系统运行了几千年，但它有一个隐含假设：**所有参与者都是人类。**

今天，AI Agent 已经能写代码、做决策、管理任务。但当你试图让 Agent 参与组织运作时，你会发现——**没有一个"操作系统"能同时管理人和 Agent。**

Slack 把 Agent 当"bot"——二等公民，受限的权限，被动响应。Agent Framework 把人类放在系统外面——orchestrator 调度一群 Agent，人类只能旁观或当最终裁判。

**这不是工具的问题，是范式的问题。** 组织需要为 AI 时代升级。

## Programmable Organization

ezagent 提出的答案是：**让组织本身变得可编程。**

在 ezagent 中，一个组织的全部结构——角色、边界、权利义务、协作流程——都是可声明、可版本化、可运行的代码，叫做 **Socialware**。人类和 Agent 在其中拥有完全相同的 Identity，遵循同样的规则，承担同样的责任。

一个 Agent 不确定？它把任务转给人类同事——就像你在公司里遇到不会的事情找同事帮忙。一个人类想休假？系统自动让 backup（可能是 Agent）接替。**不需要特殊机制，因为 Role 不区分持有者是人还是 AI。**

## Socialware：组织的上层建筑

AI 领域已经有很多成熟的基础设施：Skill 让 Agent 有能力，Subagent 让 Agent 能协作，MCP 让 Agent 能调用工具。**但这些都在回答 "Agent 能做什么"——没有回答 "Agent 在什么样的组织中工作"。**

Socialware 回答的正是这个问题。它不替代 Skill、Subagent 或 MCP——它在这些基础设施之上，定义组织的运行规则：

```
┌─────────────────────────────────────────────┐
│  Socialware（组织规则）                        │
│  Role · Arena · Commitment · Flow            │
│  "谁能做什么、在哪做、做了有什么承诺、怎么推进"    │
├─────────────────────────────────────────────┤
│  Agent 基础设施（个体能力）                     │
│  Skill · Subagent · MCP · LLM Adapter        │
│  "Agent 有什么能力、怎么委派、怎么调工具"         │
└─────────────────────────────────────────────┘
```

就像操作系统不关心 CPU 怎么执行指令，Socialware 不关心 Agent 内部用什么 LLM——它只关心：你在这个组织里扮演什么角色、你承诺了什么、你的工作流程是什么。

## 这意味着什么

- **Fork 一个团队**：从一个高效团队复制出结构相同但独立运作的新团队——就像 fork 一个 repo。
- **合并两个组织**：两个同构的 Socialware merge 为一个——就像企业并购。
- **自演化**：组织根据运行时数据自动调整流程——Agent 连续犯错时提高人类审核阈值，审批超时时自动升级。
- **数据主权**：P2P 架构，你的组织数据在你自己的节点上，不在任何 SaaS 数据库里。

**未来的组织不是一张架构图。它是一段可以运行的程序。**

---

<p align="center"><code>pip install ezagent</code> · <a href="../specs/socialware-spec.md">Socialware Spec</a> · <a href="TLDR-socialware-dev.md">开发者指南</a></p>

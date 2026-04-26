# 三位一体分析 UI 设计 Skill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把三位一体分析 UI 设计规范落成仓库内可复用的项目 skill，供团队成员在改总线、规则链、周期详情和拓扑 hover 时统一遵守。

**Architecture:** 采用“规则 + 示例型” skill。先在仓库 `skills/` 下初始化 skill 目录，再把 spec 中确认的覆盖范围、硬规则、组件模板写进 `SKILL.md`，补最小 UI metadata，最后用校验脚本和一次轻量 forward-test 验证 skill 可用。

**Tech Stack:** Markdown, YAML, 项目内 `skills/` 目录, `init_skill.py`, `quick_validate.py`

---

## 文件结构与职责

- Create: `skills/trinity-analysis-ui-design/SKILL.md`
  - skill 主体，承载触发条件、硬规则、组件示例、自检清单
- Create: `skills/trinity-analysis-ui-design/agents/openai.yaml`
  - skill UI metadata，供列表与调用提示使用
- Modify: `docs/superpowers/plans/2026-04-26-trinity-analysis-ui-design-skill.md`
  - 当前实施计划
- Reference: `docs/superpowers/specs/2026-04-26-trinity-analysis-ui-design-skill-design.md`
  - 已批准设计依据

## 范围守卫

以下内容不在本计划内：

1. 不修改任何业务组件样式
2. 不扩展到全站设计系统
3. 不改后端字段或策略判断
4. 不为营销页、登录页、运营页定义视觉规范

### Task 1: 初始化 skill 目录并生成基础 metadata

**Files:**
- Create: `skills/trinity-analysis-ui-design/`

- [ ] **Step 1: 用 init_skill.py 初始化 skill 骨架**

Run:

```bash
python3 /Users/denys/.codex/skills/.system/skill-creator/scripts/init_skill.py \
  trinity-analysis-ui-design \
  --path skills \
  --interface display_name="三位一体分析 UI 设计" \
  --interface short_description="统一三位一体分析组件的视觉规则与示例" \
  --interface default_prompt="Use $trinity-analysis-ui-design to review or design Trinity analysis UI components."
```

Expected:

- 创建 `skills/trinity-analysis-ui-design/`
- 自动生成 `SKILL.md`
- 自动生成 `agents/openai.yaml`

- [ ] **Step 2: 删除模板占位内容，确认目录结构干净**

Run:

```bash
find skills/trinity-analysis-ui-design -maxdepth 3 -type f | sort
```

Expected:

- 只保留 skill 真正需要的文件

### Task 2: 写入规则 + 示例型 skill 主体

**Files:**
- Modify: `skills/trinity-analysis-ui-design/SKILL.md`

- [ ] **Step 1: 用已批准 spec 写入 frontmatter**

Frontmatter 必须包含：

```yaml
---
name: trinity-analysis-ui-design
description: Use when designing, reviewing, or polishing Trinity analysis UI components such as TradingCycleBus, rule-chain status cards, period-detail evidence blocks, topology preview hovers, badges, and tooltips. Apply when spacing, visual hierarchy, Chinese copy, hover responsibilities, bullish/bearish color semantics, or topology-card presentation need project-specific guidance.
---
```

- [ ] **Step 2: 写入 skill 主体内容**

正文必须覆盖：

1. 覆盖范围与非目标
2. 默认视觉基调：
   - 终端骨架 + 报告留白
   - 可解释优先
   - 偏多红 / 偏空绿
   - 用户可见文案默认中文
3. 硬规则：
   - 信息分层
   - 颜色职责
   - 卡片与留白
   - badge 规则
   - hover / tooltip 规则
   - 拓扑卡规则
   - 文案规则
   - 自检规则
4. 组件示例模板：
   - 交易周期总线
   - 规则链
   - 周期详情 / 结构拓扑解释
   - hover 拓扑卡
5. 使用时的操作提醒：
   - 先判断主内容与 hover 的职责边界
   - 再审颜色、边距、密度
   - 最后做中文文案和重复表达检查

- [ ] **Step 3: 保持 skill 形态轻量**

要求：

1. 不新建多余 README / CHANGELOG
2. 首版尽量只用 `SKILL.md + agents/openai.yaml`
3. 如非必要，不拆 references 文件

### Task 3: 校验与 forward-test

**Files:**
- Modify: `skills/trinity-analysis-ui-design/SKILL.md`（若校验或试用后需要微调）

- [ ] **Step 1: 运行 quick_validate**

Run:

```bash
python3 /Users/denys/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  skills/trinity-analysis-ui-design
```

Expected:

- skill 通过 frontmatter、命名、基础结构校验

- [ ] **Step 2: 做一次轻量 forward-test**

建议用一个独立 subagent，给它一个真实任务，例如：

```text
请按仓库内的三位一体分析 UI 设计 skill，审查 TradingCycleTopologyPreviewCard 当前样式问题，并给出 3-5 条高信号设计反馈。
```

Expected:

- subagent 能抓到终端骨架 / 报告留白 / 中文文案 / hover 职责 / 多空配色这些项目特有规则
- 若没抓到，回头补 skill 触发描述或正文

- [ ] **Step 3: 重新校验**

Run:

```bash
python3 /Users/denys/.codex/skills/.system/skill-creator/scripts/quick_validate.py \
  skills/trinity-analysis-ui-design
git diff --check
```

Expected:

- 两条命令都通过

### Task 4: 提交 skill

**Files:**
- Add: `skills/trinity-analysis-ui-design/`
- Add: `docs/superpowers/plans/2026-04-26-trinity-analysis-ui-design-skill.md`

- [ ] **Step 1: Commit**

```bash
git add skills/trinity-analysis-ui-design docs/superpowers/plans/2026-04-26-trinity-analysis-ui-design-skill.md
git commit -m "新增：三位一体分析 UI 设计 skill"
```

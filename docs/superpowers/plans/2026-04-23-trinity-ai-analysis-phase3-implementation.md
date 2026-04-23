# Trinity AI Analysis Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 升级 AI 综合判断输出合同与页面消费链，并把基于 `codex exec resume` 的多轮追问会话能力纳入同一阶段交付。

**Architecture:** 主报告继续使用 `JSON 摘要 + Markdown 正文` 双层输出，旧 7 个摘要字段保持兼容，同时新增 phase3 增强字段。主报告生成时保存 Codex 会话标识与分析快照标识，后续追问通过独立 route 调用 `codex exec resume`，只返回 Markdown，不在应用层重放整段历史上下文。

**Tech Stack:** Next.js App Router、TypeScript、React、Node `node:test`、Codex CLI (`codex exec` / `codex exec resume`)

---

## File Structure

### Core types and contracts

- Modify: `src/lib/stock-structure-types.ts`
  - 扩展 `AiSummaryCard`
  - 新增 AI 会话引用与追问响应类型

- Modify: `src/lib/ai-report-contract.ts`
  - 继续解析旧 7 字段
  - 增加 phase3 增强字段的可选解析

### Codex CLI execution layer

- Modify: `src/lib/codex-strategy-analysis.ts`
  - 保留现有单次主报告执行能力
  - 增加 `--json` 事件模式下的会话标识提取
  - 增加 resume 参数构造与追问执行封装

### API routes

- Modify: `src/app/api/stock/ai-analysis/route.ts`
  - 升级 AI 主报告输出契约
  - 返回主报告时带上会话标识与分析快照标识

- Create: `src/app/api/stock/ai-analysis/follow-up/route.ts`
  - 处理追问请求
  - 调用 `codex exec resume`
  - 只返回 Markdown

### Page state and UI

- Modify: `src/lib/trinity-analysis-page-view-model.ts`
  - 优先消费 AI phase3 增强摘要字段
  - 保留旧摘要 + 后端 fallback 降级路径

- Modify: `src/components/stock/AnalysisSummaryPanel.tsx`
  - 展示 AI 增强摘要
  - 明确显示判断疑点（若有）

- Create: `src/components/stock/AiFollowupPanel.tsx`
  - 追问输入框
  - 追问消息列表
  - Markdown-only 回答展示

- Modify: `src/app/stock/[code]/analysis/page.tsx`
  - 保存 AI 主报告会话状态
  - 管理追问输入、请求、消息列表
  - 把追问面板挂入 AI 区

### Tests

- Modify: `tests/ai-report-contract.test.ts`
  - 校验新增摘要字段解析与降级行为

- Modify: `tests/codex-strategy-analysis.test.ts`
  - 校验 session id 提取、resume 参数与行为边界

- Modify: `tests/analysis-summary-panel.test.ts`
  - 校验 AI 增强摘要与判断疑点展示

- Create: `tests/ai-followup-panel.test.ts`
  - 校验追问组件的消息展示、加载态、Markdown-only 输出

- Modify: `tests/analysis-page-sections.test.ts`
  - 校验页面 AI 区增加追问层后仍保持现有信息顺序

- Create: `tests/ai-analysis-follow-up-route.test.ts`
  - 校验 follow-up route 的请求体、响应形状和快照绑定要求

---

### Task 1: 扩展 AI 摘要类型与报告解析合同

**Files:**
- Modify: `src/lib/stock-structure-types.ts`
- Modify: `src/lib/ai-report-contract.ts`
- Modify: `tests/ai-report-contract.test.ts`

- [ ] **Step 1: 先写增强摘要解析的失败测试**

```ts
test('parseAiReportContract preserves phase3 summary fields when present', () => {
  const report = [
    '```json',
    JSON.stringify(
      {
        headline: 'AI 判断：等待回抽确认',
        action: 'wait',
        bias: 'neutral',
        primary_reason: '日线仍未完成确认',
        triggers: ['30分钟止跌回抽确认'],
        risks: ['跌回平台下沿'],
        guardrail: '后端当前仍为等待',
        judgment: '候选可试',
        critical_reason: '父级支持，但30分钟回抽确认尚未完成',
        spacetime_summary: '日线中偏强，30分钟顺父级，零轴强信号偏支持',
        structure_summary: '正式结构未完全确认，当前更偏 D 候选',
        execution_summary: '先看30分钟止跌，确认后再加',
        candidate_structure: {
          label: 'D候选',
          current_leg: '30分钟回抽段',
          upgrade_condition: '30分钟回抽止跌并放量重新转强',
          invalidation: '跌回日线确认低点下方',
        },
        wait_state: {
          label: '等待回抽确认',
          current_block: '30分钟回抽段尚未完成止跌确认',
          next_action: '观察30分钟止跌并重新转强',
        },
        judgment_warning: '当前后端判断偏保守，仍需关注30分钟确认后的升级路径',
      },
      null,
      2
    ),
    '```',
    '',
    '# 当前综合判断',
    '',
    '- 当前仍以等待为主',
  ].join('\\n');

  const parsed = parseAiReportContract(report);

  assert.equal(parsed.summary.judgment, '候选可试');
  assert.equal(parsed.summary.critical_reason, '父级支持，但30分钟回抽确认尚未完成');
  assert.equal(parsed.summary.candidate_structure?.label, 'D候选');
  assert.equal(parsed.summary.wait_state?.label, '等待回抽确认');
  assert.equal(
    parsed.summary.judgment_warning,
    '当前后端判断偏保守，仍需关注30分钟确认后的升级路径'
  );
});

test('parseAiReportContract keeps old reports valid when phase3 fields are absent', () => {
  const report = [
    '```json',
    JSON.stringify(
      {
        headline: '先等确认，暂不激进操作',
        action: 'wait',
        bias: 'neutral',
        primary_reason: '日线结构未完成确认',
        triggers: ['重新站回平台上沿'],
        risks: ['跌回平台下沿'],
        guardrail: 'deterministic_decision.action=wait 时不得升级为 buy/add',
      },
      null,
      2
    ),
    '```',
    '',
    '# 综合判断',
    '',
    '- 当前以等待为主',
  ].join('\\n');

  const parsed = parseAiReportContract(report);

  assert.equal(parsed.summary.headline, '先等确认，暂不激进操作');
  assert.equal(parsed.summary.judgment, undefined);
  assert.equal(parsed.summary.wait_state, undefined);
});
```

- [ ] **Step 2: 运行测试，确认新字段断言先失败**

Run:

```bash
node --test tests/ai-report-contract.test.ts -v
```

Expected:

- 现有旧测试通过
- 新增 phase3 测试失败，报 `judgment`、`candidate_structure` 或 `wait_state` 缺失

- [ ] **Step 3: 扩展 `AiSummaryCard` 与 parser 的最小实现**

```ts
export interface AiSummaryCard {
  headline: string;
  action: TrinityDecisionAction;
  bias: TrinityDecisionBias;
  primary_reason: string;
  triggers: string[];
  risks: string[];
  guardrail: string;
  judgment?: '严格等待' | '候选可试' | '确认执行';
  critical_reason?: string;
  spacetime_summary?: string;
  structure_summary?: string;
  execution_summary?: string;
  candidate_structure?: {
    label: string;
    current_leg: string;
    upgrade_condition: string;
    invalidation: string;
  };
  wait_state?: {
    label: string;
    current_block: string;
    next_action: string;
  };
  judgment_warning?: string;
}
```

```ts
function parseOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function parseOptionalSummaryObject(
  value: unknown,
  fields: string[]
): Record<string, string> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined;
  }

  const candidate = value as Record<string, unknown>;
  const parsed = Object.fromEntries(
    fields
      .map((field) => [field, parseOptionalString(candidate[field])])
      .filter(([, fieldValue]) => Boolean(fieldValue))
  );

  return Object.keys(parsed).length > 0 ? parsed : undefined;
}

function parseAiSummaryCard(value: unknown): AiSummaryCard {
  // ...保留旧字段校验
  return {
    headline: parseStringField(candidate.headline, 'headline'),
    action,
    bias,
    primary_reason: parseStringField(candidate.primary_reason, 'primary_reason'),
    triggers: parseStringListField(candidate.triggers, 'triggers'),
    risks: parseStringListField(candidate.risks, 'risks'),
    guardrail: parseStringField(candidate.guardrail, 'guardrail'),
    judgment: parseOptionalString(candidate.judgment) as AiSummaryCard['judgment'],
    critical_reason: parseOptionalString(candidate.critical_reason),
    spacetime_summary: parseOptionalString(candidate.spacetime_summary),
    structure_summary: parseOptionalString(candidate.structure_summary),
    execution_summary: parseOptionalString(candidate.execution_summary),
    candidate_structure: parseOptionalSummaryObject(candidate.candidate_structure, [
      'label',
      'current_leg',
      'upgrade_condition',
      'invalidation',
    ]) as AiSummaryCard['candidate_structure'],
    wait_state: parseOptionalSummaryObject(candidate.wait_state, [
      'label',
      'current_block',
      'next_action',
    ]) as AiSummaryCard['wait_state'],
    judgment_warning: parseOptionalString(candidate.judgment_warning),
  };
}
```

- [ ] **Step 4: 重新运行 parser 测试并确认通过**

Run:

```bash
node --test tests/ai-report-contract.test.ts -v
```

Expected:

- `parseAiReportContract preserves phase3 summary fields when present` PASS
- `parseAiReportContract keeps old reports valid when phase3 fields are absent` PASS
- 现有旧测试继续 PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/lib/stock-structure-types.ts src/lib/ai-report-contract.ts tests/ai-report-contract.test.ts
git commit -m "feat: 扩展 AI 摘要解析合同"
```

---

### Task 2: 给 Codex 执行层补会话标识与 resume 能力

**Files:**
- Modify: `src/lib/codex-strategy-analysis.ts`
- Modify: `tests/codex-strategy-analysis.test.ts`

- [ ] **Step 1: 先写 session / resume 能力的失败测试**

```ts
test('buildCodexExecArgs enables json event mode for session capture', () => {
  assert.deepEqual(
    buildCodexExecArgs({
      outputPath: '/tmp/codex-output.txt',
      workingDir: '/tmp/codex-workdir',
      json: true,
    }),
    [
      '-a',
      'never',
      'exec',
      '-s',
      'read-only',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--cd',
      '/tmp/codex-workdir',
      '--json',
      '--output-last-message',
      '/tmp/codex-output.txt',
      '-',
    ]
  );
});

test('extractCodexSessionIdFromJsonl tolerates multiple event shapes', () => {
  const stdout = [
    JSON.stringify({ type: 'session.started', session_id: 'session-1' }),
    JSON.stringify({ type: 'turn.completed', thread_id: 'thread-ignored' }),
  ].join('\\n');

  assert.equal(extractCodexSessionIdFromJsonl(stdout), 'session-1');
});

test('buildCodexExecResumeArgs resumes an existing exec session and keeps output capture', () => {
  assert.deepEqual(
    buildCodexExecResumeArgs({
      sessionId: 'session-1',
      outputPath: '/tmp/codex-output.txt',
      workingDir: '/tmp/codex-workdir',
    }),
    [
      '-a',
      'never',
      'exec',
      'resume',
      '--skip-git-repo-check',
      '--color',
      'never',
      '--cd',
      '/tmp/codex-workdir',
      '--output-last-message',
      '/tmp/codex-output.txt',
      'session-1',
      '-',
    ]
  );
});
```

- [ ] **Step 2: 运行测试，确认 session / resume 断言先失败**

Run:

```bash
node --test tests/codex-strategy-analysis.test.ts -v
```

Expected:

- 新增断言失败，提示 `json` 参数、`extractCodexSessionIdFromJsonl`、`buildCodexExecResumeArgs` 尚未实现

- [ ] **Step 3: 在 Codex 执行层实现会话解析与 resume 包装**

```ts
export interface CodexSessionRef {
  sessionId: string;
}

export interface CodexStrategyAnalysisResult {
  report: string;
  session?: CodexSessionRef;
}

export function extractCodexSessionIdFromJsonl(stdout: string): string | null {
  for (const line of stdout.split('\\n').map((item) => item.trim()).filter(Boolean)) {
    try {
      const event = JSON.parse(line) as Record<string, unknown>;
      const sessionId =
        (typeof event.session_id === 'string' && event.session_id) ||
        (typeof event.thread_id === 'string' && event.thread_id) ||
        (typeof (event.session as Record<string, unknown> | undefined)?.id === 'string'
          ? ((event.session as Record<string, unknown>).id as string)
          : null) ||
        (typeof (event.thread as Record<string, unknown> | undefined)?.id === 'string'
          ? ((event.thread as Record<string, unknown>).id as string)
          : null);

      if (sessionId) {
        return sessionId;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function buildCodexExecResumeArgs({
  sessionId,
  outputPath,
  workingDir,
}: {
  sessionId: string;
  outputPath: string;
  workingDir: string;
}): string[] {
  return [
    '-a',
    'never',
    'exec',
    'resume',
    '--skip-git-repo-check',
    '--color',
    'never',
    '--cd',
    workingDir,
    '--output-last-message',
    outputPath,
    sessionId,
    '-',
  ];
}
```

```ts
export async function runCodexStrategyAnalysisWithSession(...) : Promise<CodexStrategyAnalysisResult> {
  const result = await executor(prompt, { timeoutMs, configOverrides, json: true });
  const report = ensureReport(result);
  const sessionId = extractCodexSessionIdFromJsonl(result.stdout);

  return {
    report,
    session: sessionId ? { sessionId } : undefined,
  };
}

export async function resumeCodexStrategyAnalysis({
  sessionId,
  prompt,
  ...
}): Promise<string> {
  const result = await resumeExecutor(prompt, { sessionId, timeoutMs, configOverrides });
  return ensureReport(result);
}
```

- [ ] **Step 4: 重新运行 Codex 执行层测试**

Run:

```bash
node --test tests/codex-strategy-analysis.test.ts -v
```

Expected:

- 新增 session / resume 测试 PASS
- 现有 prompt / hard-boundary / failure-format 测试继续 PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add src/lib/codex-strategy-analysis.ts tests/codex-strategy-analysis.test.ts
git commit -m "feat: 支持 AI 会话标识与 resume 能力"
```

---

### Task 3: 升级 AI 主报告 route，并新增追问 route

**Files:**
- Modify: `src/app/api/stock/ai-analysis/route.ts`
- Create: `src/app/api/stock/ai-analysis/follow-up/route.ts`
- Modify: `tests/codex-strategy-analysis.test.ts`
- Create: `tests/ai-analysis-follow-up-route.test.ts`

- [ ] **Step 1: 先写 route 合同与 follow-up route 的失败测试**

```ts
test('ai-analysis route prompt requires phase3 summary fields and keeps hard boundary', () => {
  const routeSource = readFileSync(
    new URL('../src/app/api/stock/ai-analysis/route.ts', import.meta.url),
    'utf8'
  );

  assert.match(routeSource, /judgment/);
  assert.match(routeSource, /critical_reason/);
  assert.match(routeSource, /spacetime_summary/);
  assert.match(routeSource, /structure_summary/);
  assert.match(routeSource, /execution_summary/);
  assert.match(routeSource, /judgment_warning/);
  assert.match(routeSource, /不能直接改写后端当前正式动作/);
  assert.match(routeSource, /若 .* 则可升级/);
});
```

```ts
test('follow-up route requires session id, snapshot key and question', async () => {
  const { POST } = await import(
    new URL('../src/app/api/stock/ai-analysis/follow-up/route.ts', import.meta.url).href
  );

  const request = new Request('http://localhost/api/stock/ai-analysis/follow-up', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: '300274',
      sessionId: '',
      snapshotKey: '',
      question: '',
    }),
  });

  const response = await POST(request as any);
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.match(body.error, /缺少必要参数/);
});
```

- [ ] **Step 2: 运行 route 测试，确认 phase3 / follow-up 断言先失败**

Run:

```bash
node --test tests/codex-strategy-analysis.test.ts tests/ai-analysis-follow-up-route.test.ts -v
```

Expected:

- `judgment`、`critical_reason` 等 prompt 断言失败
- follow-up route 文件不存在或参数校验测试失败

- [ ] **Step 3: 升级主报告 route 的输出契约，并返回会话元数据**

```ts
const AI_REPORT_OUTPUT_CONTRACT = `## 报告契约（必须严格遵守）

- 先输出 JSON 摘要，再输出 Markdown 正文
- JSON 摘要必须包含旧字段：headline / action / bias / primary_reason / triggers / risks / guardrail
- JSON 摘要还必须补充：judgment / critical_reason / spacetime_summary / structure_summary / execution_summary
- candidate_structure / wait_state / judgment_warning 为增强字段：有则必须按约定输出
- Markdown 正文按以下顺序展开：当前综合判断 / 时空怎么看 / 结构怎么看 / 现在怎么做 / 风险与应对
- 允许给出条件升级预案，但不能直接改写后端当前正式动作
- 若存在后端判断疑点，可单列“判断疑点”说明
`;
```

```ts
const snapshotKey = `${code}:${aiDecisionPayload.analysis_time ?? 'unknown'}`;
const analysis = await runCodexStrategyAnalysisWithSession({
  systemPrompt: TRINITY_SYSTEM_PROMPT,
  userPrompt,
  timeoutMs,
  configOverrides: buildAiCodexConfigOverrides(),
});

return NextResponse.json({
  success: true,
  data: {
    code,
    report: analysis.report,
    generatedAt: new Date().toISOString(),
    session: analysis.session ?? null,
    snapshotKey,
  },
});
```

- [ ] **Step 4: 新建 follow-up route，只返回 Markdown**

```ts
export async function POST(request: NextRequest) {
  const { code, sessionId, snapshotKey, question } = await request.json();

  if (!code || !sessionId || !snapshotKey || !question) {
    return NextResponse.json({ success: false, error: '缺少必要参数' }, { status: 400 });
  }

  const report = await resumeCodexStrategyAnalysis({
    sessionId,
    prompt: [
      '## 基于上一轮 AI 综合判断的追问',
      `股票代码：${code}`,
      `分析快照：${snapshotKey}`,
      '',
      '请继续沿用上一轮分析上下文回答本次问题。',
      '只输出 Markdown 正文，不要再输出 JSON 摘要。',
      '仍然遵守后端正式边界：不能直接改写当前正式动作。',
      '如果可以升级，只能写成条件升级预案；如果存在疑点，可以明确指出。',
      '',
      `用户追问：${question}`,
    ].join('\\n'),
    timeoutMs: Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined,
    configOverrides: buildAiCodexConfigOverrides(),
  });

  return NextResponse.json({
    success: true,
    data: {
      markdown: report,
      session: { sessionId },
      snapshotKey,
    },
  });
}
```

- [ ] **Step 5: 重新运行 route 测试并确认通过**

Run:

```bash
node --test tests/codex-strategy-analysis.test.ts tests/ai-analysis-follow-up-route.test.ts -v
```

Expected:

- 主 route prompt 合同测试 PASS
- follow-up route 参数校验测试 PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add src/app/api/stock/ai-analysis/route.ts src/app/api/stock/ai-analysis/follow-up/route.ts tests/codex-strategy-analysis.test.ts tests/ai-analysis-follow-up-route.test.ts
git commit -m "feat: 增强 AI 报告合同并新增追问路由"
```

---

### Task 4: 让页面正式消费 AI 增强摘要

**Files:**
- Modify: `src/lib/trinity-analysis-page-view-model.ts`
- Modify: `src/components/stock/AnalysisSummaryPanel.tsx`
- Modify: `tests/analysis-summary-panel.test.ts`
- Modify: `tests/analysis-page-sections.test.ts`

- [ ] **Step 1: 先写 UI / view model 的失败测试**

```ts
test('AnalysisSummaryPanel ready renders phase3 enhanced AI summary fields', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        ...summaryViewModel,
        mode: 'ready',
        headline: 'AI 判断：当前先等30分钟回抽确认',
        primaryReason: '父级支持，但30分钟回抽段未完成止跌确认',
        spacetimeSummary: '时空：日线中偏强，30分钟顺父级，零轴强信号偏支持',
        structureSummary: '结构：正式结构未完全确认，当前更偏 D 候选',
        executionSummary: '现在怎么做：先看30分钟止跌，确认后再加',
      },
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /AI 判断：当前先等30分钟回抽确认/);
  assert.match(html, /父级支持，但30分钟回抽段未完成止跌确认/);
  assert.match(html, /时空：日线中偏强，30分钟顺父级，零轴强信号偏支持/);
  assert.match(html, /结构：正式结构未完全确认，当前更偏 D 候选/);
  assert.match(html, /现在怎么做：先看30分钟止跌，确认后再加/);
});
```

```ts
test('AnalysisSummaryPanel renders judgment warning separately when AI points out backend tension', async () => {
  const { AnalysisSummaryPanel } = await importTsxModule<AnalysisSummaryPanelModule>(
    'src/components/stock/AnalysisSummaryPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AnalysisSummaryPanel, {
      viewModel: {
        ...summaryViewModel,
        mode: 'ready',
        headline: 'AI 判断：后端当前仍等待',
        primaryReason: '当前仍未完成触发确认',
        judgmentWarning: '判断疑点：30分钟信号已明显转强，但后端当前结论仍偏保守',
      } as AnalysisPageSummaryViewModel,
      globalStrategy: globalStrategyViewModel,
      onGenerate: () => {},
      canGenerate: true,
    })
  );

  assert.match(html, /判断疑点：30分钟信号已明显转强，但后端当前结论仍偏保守/);
});
```

- [ ] **Step 2: 运行面板测试，确认增强摘要断言先失败**

Run:

```bash
node --test tests/analysis-summary-panel.test.ts tests/analysis-page-sections.test.ts -v
```

Expected:

- 新增的 phase3 摘要断言失败
- `judgmentWarning` 相关展示断言失败

- [ ] **Step 3: 在 view model 中优先消费 AI 增强摘要**

```ts
return {
  mode: aiState.status,
  errorMessage,
  headline: preferChineseText(readySummary?.headline, actionLabel),
  primaryActionLabel: actionLabel,
  judgmentLabel: readySummary?.judgment ?? resolveJudgmentLabel(decision),
  relationLabel: resolveRelationLabel(decision.level_nesting),
  primaryReason: resolveChineseReason(
    [readySummary?.critical_reason, readySummary?.primary_reason, backendReason],
    backendReason
  ),
  triggerLabels: preferChineseList(readySummary?.triggers, resolveDecisionTriggerLabels(decision)),
  riskLabels: preferChineseList(readySummary?.risks, resolveDecisionRiskLabels(decision)),
  guardrail: resolveChineseReason([readySummary?.guardrail, backendReason], backendReason),
  spacetimeSummary: resolveChineseReason(
    [readySummary?.spacetime_summary, buildSpacetimeSummary(decision)],
    buildSpacetimeSummary(decision)
  ),
  structureSummary: resolveChineseReason(
    [readySummary?.structure_summary, buildStructureSummary(decision)],
    buildStructureSummary(decision)
  ),
  executionSummary: resolveChineseReason(
    [readySummary?.execution_summary, buildExecutionSummary(decision)],
    buildExecutionSummary(decision)
  ),
  judgmentWarning: readySummary?.judgment_warning ?? null,
  candidateStructureSummary: readySummary?.candidate_structure ?? null,
  waitStateSummary: readySummary?.wait_state ?? null,
  signalTags: buildDecisionSignalTags(decision),
  // ...
};
```

- [ ] **Step 4: 在 AI 面板中渲染增强摘要块与判断疑点**

```tsx
{viewModel.judgmentWarning ? (
  <div className="rounded-lg border border-amber-500/30 bg-amber-50 px-3 py-2 text-sm text-amber-800">
    {viewModel.judgmentWarning}
  </div>
) : null}

{viewModel.candidateStructureSummary ? (
  <section className="space-y-1 text-sm leading-6">
    <div className="text-xs text-muted-foreground">候选结构</div>
    <p className="text-muted-foreground">
      {viewModel.candidateStructureSummary.label}｜{viewModel.candidateStructureSummary.current_leg}
    </p>
  </section>
) : null}

{viewModel.waitStateSummary ? (
  <section className="space-y-1 text-sm leading-6">
    <div className="text-xs text-muted-foreground">等待状态</div>
    <p className="text-muted-foreground">
      {viewModel.waitStateSummary.label}｜{viewModel.waitStateSummary.current_block}
    </p>
  </section>
) : null}
```

- [ ] **Step 5: 重新运行面板 / 页面段落测试**

Run:

```bash
node --test tests/analysis-summary-panel.test.ts tests/analysis-page-sections.test.ts -v
```

Expected:

- 新增 phase3 摘要展示测试 PASS
- 现有 AI 面板、总线、规则链相关测试继续 PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add src/lib/trinity-analysis-page-view-model.ts src/components/stock/AnalysisSummaryPanel.tsx tests/analysis-summary-panel.test.ts tests/analysis-page-sections.test.ts
git commit -m "feat: 让 AI 面板消费增强摘要字段"
```

---

### Task 5: 接入追问会话 UI 与页面状态

**Files:**
- Create: `src/components/stock/AiFollowupPanel.tsx`
- Modify: `src/app/stock/[code]/analysis/page.tsx`
- Create: `tests/ai-followup-panel.test.ts`
- Modify: `tests/analysis-page-layout-contract.test.ts`

- [ ] **Step 1: 先写追问面板的失败测试**

```ts
test('AiFollowupPanel renders markdown replies and loading state', async () => {
  const { AiFollowupPanel } = await importTsxModule(
    'src/components/stock/AiFollowupPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AiFollowupPanel, {
      enabled: true,
      loading: false,
      draft: '为什么现在还是等待？',
      turns: [
        { role: 'user', content: '为什么现在还是等待？' },
        { role: 'assistant', content: '### 回答\\n\\n- 因为 30 分钟回抽确认尚未完成。' },
      ],
      onDraftChange: () => {},
      onSubmit: () => {},
    })
  );

  assert.match(html, /继续追问/);
  assert.match(html, /为什么现在还是等待？/);
  assert.match(html, /回抽确认尚未完成/);
});
```

```ts
test('analysis page keeps AI summary panel before follow-up panel', async () => {
  const pageSource = await fs.readFile('src/app/stock/[code]/analysis/page.tsx', 'utf8');

  const summaryIndex = pageSource.indexOf('<AnalysisSummaryPanel');
  const followupIndex = pageSource.indexOf('<AiFollowupPanel');

  assert.ok(summaryIndex >= 0);
  assert.ok(followupIndex > summaryIndex);
});
```

- [ ] **Step 2: 运行追问 UI 测试，确认先失败**

Run:

```bash
node --test tests/ai-followup-panel.test.ts tests/analysis-page-layout-contract.test.ts -v
```

Expected:

- `AiFollowupPanel` 文件不存在或渲染测试失败
- 页面布局合同测试提示 `<AiFollowupPanel` 不存在

- [ ] **Step 3: 新建追问面板组件**

```tsx
export interface AiFollowupTurn {
  role: 'user' | 'assistant';
  content: string;
}

export function AiFollowupPanel({
  enabled,
  loading,
  draft,
  turns,
  onDraftChange,
  onSubmit,
}: {
  enabled: boolean;
  loading: boolean;
  draft: string;
  turns: AiFollowupTurn[];
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">继续追问</CardTitle>
        <CardDescription>基于当前 AI 综合判断继续提问，追问回答仅使用 Markdown 展示。</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {turns.map((turn, index) => (
          <div key={`${turn.role}-${index}`} className="rounded-lg border bg-background/70 p-3">
            <div className="mb-2 text-xs text-muted-foreground">
              {turn.role === 'user' ? '你的问题' : 'AI 追问回答'}
            </div>
            {turn.role === 'assistant' ? <Markdown content={turn.content} /> : <p>{turn.content}</p>}
          </div>
        ))}
        <Textarea value={draft} onChange={(event) => onDraftChange(event.target.value)} disabled={!enabled || loading} />
        <Button onClick={onSubmit} disabled={!enabled || loading || !draft.trim()}>
          {loading ? 'AI 追问中…' : '发送追问'}
        </Button>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 4: 在分析页接入会话状态与追问请求**

```ts
const [aiSession, setAiSession] = useState<{ sessionId: string; snapshotKey: string } | null>(null);
const [aiFollowupDraft, setAiFollowupDraft] = useState('');
const [aiFollowupLoading, setAiFollowupLoading] = useState(false);
const [aiFollowupTurns, setAiFollowupTurns] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
```

```ts
const handleGenerateAi = async () => {
  // ...
  const parsed = parseAiReportContract(data.data.report);
  setAiMarkdown(parsed.markdown);
  setAiState({ status: 'ready', summary: parsed.summary });
  if (data.data.session?.sessionId && data.data.snapshotKey) {
    setAiSession({ sessionId: data.data.session.sessionId, snapshotKey: data.data.snapshotKey });
  }
  setAiFollowupTurns([]);
  setAiFollowupDraft('');
};

const handleAiFollowup = async () => {
  if (!aiSession || !aiFollowupDraft.trim()) {
    return;
  }

  const question = aiFollowupDraft.trim();
  setAiFollowupLoading(true);
  setAiFollowupTurns((prev) => [...prev, { role: 'user', content: question }]);
  setAiFollowupDraft('');

  try {
    const response = await fetch('/api/stock/ai-analysis/follow-up', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        sessionId: aiSession.sessionId,
        snapshotKey: aiSession.snapshotKey,
        question,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'AI 追问失败');
    }

    setAiFollowupTurns((prev) => [...prev, { role: 'assistant', content: data.data.markdown }]);
  } finally {
    setAiFollowupLoading(false);
  }
};
```

```tsx
<AnalysisSummaryPanel ... />
{aiState.status === 'ready' ? (
  <AiFollowupPanel
    enabled={Boolean(aiSession)}
    loading={aiFollowupLoading}
    draft={aiFollowupDraft}
    turns={aiFollowupTurns}
    onDraftChange={setAiFollowupDraft}
    onSubmit={handleAiFollowup}
  />
) : null}
```

- [ ] **Step 5: 重新运行追问组件 / 页面布局测试**

Run:

```bash
node --test tests/ai-followup-panel.test.ts tests/analysis-page-layout-contract.test.ts -v
```

Expected:

- `AiFollowupPanel renders markdown replies and loading state` PASS
- 页面布局合同测试 PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add src/components/stock/AiFollowupPanel.tsx src/app/stock/[code]/analysis/page.tsx tests/ai-followup-panel.test.ts tests/analysis-page-layout-contract.test.ts
git commit -m "feat: 接入 AI 追问会话面板"
```

---

### Task 6: 全量回归与收尾

**Files:**
- Verify only

- [ ] **Step 1: 运行第三阶段相关 node:test 回归**

Run:

```bash
node --test \
  tests/ai-report-contract.test.ts \
  tests/codex-strategy-analysis.test.ts \
  tests/ai-analysis-follow-up-route.test.ts \
  tests/analysis-summary-panel.test.ts \
  tests/analysis-page-sections.test.ts \
  tests/analysis-page-layout-contract.test.ts \
  tests/ai-followup-panel.test.ts -v
```

Expected:

- 所有新增与受影响测试 PASS

- [ ] **Step 2: 运行类型检查**

Run:

```bash
pnpm ts-check
```

Expected:

- TypeScript 类型检查通过，无新增错误

- [ ] **Step 3: 手动验证 AI 主报告与追问链路**

Run:

```bash
pnpm dev
```

Open:

```text
http://localhost:5001/stock/300274/analysis
```

Manual checklist:

- 点击“生成 AI 综合判断”后，主报告仍返回 `JSON 摘要 + Markdown 正文`
- AI 主结论头能显示增强摘要字段
- 页面能出现“继续追问”区域
- 输入“为什么现在还是等待？”后，追问返回 Markdown 回答
- 当重新分析或切换股票后，旧会话不会被错误复用

- [ ] **Step 4: 提交收尾**

```bash
git add src/lib/stock-structure-types.ts src/lib/ai-report-contract.ts src/lib/codex-strategy-analysis.ts src/app/api/stock/ai-analysis/route.ts src/app/api/stock/ai-analysis/follow-up/route.ts src/lib/trinity-analysis-page-view-model.ts src/components/stock/AnalysisSummaryPanel.tsx src/components/stock/AiFollowupPanel.tsx src/app/stock/[code]/analysis/page.tsx tests/ai-report-contract.test.ts tests/codex-strategy-analysis.test.ts tests/ai-analysis-follow-up-route.test.ts tests/analysis-summary-panel.test.ts tests/analysis-page-sections.test.ts tests/analysis-page-layout-contract.test.ts tests/ai-followup-panel.test.ts
git commit -m "feat: 完成第三阶段 AI 综合判断与追问会话重组"
```


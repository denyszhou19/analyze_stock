# 项目级协作规范

本文件是本仓库的默认项目规范，面向所有进入仓库执行任务的 agent / 协作者。

- `AGENTS.md`：项目级默认规则
- `CLAUDE.md`：`stock_analyzer.py`、结构识别与分析链路的专项补充规则
- `docs/DATABASE_RULES.md`：数据库变更专项规则

若规则不冲突，应同时遵守；若任务属于某个专项领域，优先遵守对应专项文档。

## 技术与基础约束

- 包管理器只能使用 `pnpm`，禁止使用 `npm` 或 `yarn`
- 前端框架是 Next.js App Router，路由与 API 都放在 `src/app/`
- 默认使用 TypeScript，导入优先使用 `@/` 路径别名
- 开发端口默认是 `5001`

## 前端实现规则

- 优先使用 `src/components/ui/` 下的 shadcn/ui 基础组件，避免重复造基础轮子
- 样式统一使用 Tailwind CSS v4 和 `src/app/globals.css` 中的主题变量
- 需要拼接类名时，统一使用 `@/lib/utils` 的 `cn()`
- 页面与业务组件放在 `src/app/`、`src/components/`，基础 UI 组件不要散落到业务目录

## Next.js 约束

- 默认优先使用服务端组件；只有在确实需要浏览器事件、状态、副作用时才添加 `'use client'`
- 新页面遵循 App Router 规范：页面用 `page.tsx`，布局用 `layout.tsx`，接口用 `route.ts`
- 服务端数据获取优先放在服务端组件；客户端组件只负责浏览器态和交互态
- API 路由返回统一使用 `NextResponse`

## 表单、数据与状态

- 表单优先使用 `react-hook-form` + `zod`
- 简单页面状态优先使用 React 原生状态；需要跨组件共享时再考虑 Context 或 Zustand
- 不要在客户端无意义重复拉取服务端已能拿到的数据

## UI / UX 质量规则

- 分析页和数据密集页默认按桌面端优先设计，信息层级必须清晰
- 先表达结论，再给摘要，再给支撑信息；不要把说明、证据、原始细节混成一个大块
- 相同语义的信息不要在多个 badge 或多个区域重复堆叠展示
- badge 只承载短结论；较长说明放在摘要块、说明区或 hover/tooltip 中
- hover / tooltip 只能补充解释，不能承载用户必须先看见的核心信息
- hover 内容必须保证有足够宽度，避免用户打开后仍看不全
- 组件布局要避免“卡片堆砌感”：每个卡片都应有明确职责，不要为了分块而分块
- 优先复用现有的展示模式与共享组件，避免同一页面出现多套视觉语言
- 颜色、边框、背景优先使用主题 token；只有在表达明确业务语义时才使用定制颜色
- 在改分析页 UI 时，默认追求“可解释、可扫描、不过度装饰”，而不是只把字段摆上去

## 三位一体 UI Skill 约束

- 修改三位一体相关 UI（如 `TradingCycleBus`、规则链、周期详情、结构拓扑解释、拓扑 hover 卡）时，默认必须遵守 `skills/trinity-analysis-ui-design/SKILL.md`
- 涉及这些区域的 UI 改动，提交前至少自检：主结论先于证据、hover 只做补充解释、偏多红 / 偏空绿不反转、用户可见文案默认中文、不泄漏内部字段名
- 若 `skills/trinity-analysis-ui-design/SKILL.md` 的覆盖范围、默认视觉方向、硬规则、组件样板或用户可见术语发生变化，必须同步检查并按需更新以下内容：
  - `skills/trinity-analysis-ui-design/agents/openai.yaml`
  - 本文件 `AGENTS.md` 中与分析页 UI / 三位一体 UI skill 相关的规则
  - `docs/superpowers/specs/2026-04-26-trinity-analysis-ui-design-skill-design.md`
  - 直接承载这些文案或样式约束的前端实现，如 `src/components/stock/` 下相关组件与 `src/lib/trinity-analysis-page-view-model.ts`
  - 相关回归测试，至少包括 `tests/trinity-analysis-page-view-model.test.ts` 与 `tests/analysis-page-sections.test.ts`
- 如果 skill 变更只涉及内部表述，不影响用户可见文案或组件职责，也仍需确认 `openai.yaml` 和 `AGENTS.md` 是否需要同步，避免 skill 内容、仓库规则和调用提示互相漂移

## 专项规则入口

- 修改 `scripts/stock_analyzer.py` 时，必须遵守 `CLAUDE.md` 中的 HTTP 回归验证要求
- 涉及数据库 schema / SQL / 迁移时，必须遵守 `docs/DATABASE_RULES.md`

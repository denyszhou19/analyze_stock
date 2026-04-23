'use client';

import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface AiFollowupTurn {
  id: string;
  question: string;
  markdown: string;
}

export interface AiFollowupPanelProps {
  draft: string;
  turns: AiFollowupTurn[];
  isLoading: boolean;
  errorMessage?: string | null;
  onDraftChange: (value: string) => void;
  onSubmit: () => void | Promise<void>;
  renderMarkdown: (content: string) => ReactNode;
}

export function AiFollowupPanel({
  draft,
  turns,
  isLoading,
  errorMessage,
  onDraftChange,
  onSubmit,
  renderMarkdown,
}: AiFollowupPanelProps) {
  const canSubmit = draft.trim().length > 0 && !isLoading;

  return (
    <Card className="border-border/70 bg-card/95 shadow-sm">
      <CardHeader className="space-y-2">
        <div className="space-y-1">
          <CardTitle className="text-lg">AI 追问</CardTitle>
          <CardDescription>
            基于当前 AI 综合判断继续提问。回答仅使用 Markdown 渲染，不会重新生成整份主报告。
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {turns.length > 0 ? (
          <div className="space-y-3">
            {turns.map((turn) => (
              <div key={turn.id} className="space-y-3 rounded-xl border bg-background/60 p-4">
                <div className="space-y-1 rounded-lg border border-border/60 bg-muted/30 p-3">
                  <div className="text-xs font-medium text-muted-foreground">你的追问</div>
                  <p className="text-sm leading-6 text-foreground">{turn.question}</p>
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">AI 回答</div>
                  <div className="rounded-lg border border-border/60 bg-background p-4">
                    {renderMarkdown(turn.markdown)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed bg-background/50 p-4 text-sm leading-6 text-muted-foreground">
            还没有追问记录。你可以围绕当前结论、触发条件、风险应对继续追问。
          </div>
        )}

        {isLoading ? (
          <div className="rounded-lg border border-amber-500/25 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            AI 正在继续整理回答，请稍候。
          </div>
        ) : null}

        {errorMessage ? (
          <div className="rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {errorMessage}
          </div>
        ) : null}

        <form
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            if (!canSubmit) {
              return;
            }
            void onSubmit();
          }}
        >
          <label className="block space-y-2">
            <span className="text-sm font-medium text-foreground">继续提问</span>
            <textarea
              value={draft}
              onChange={(event) => onDraftChange(event.target.value)}
              placeholder="例如：如果 30 分钟先放量上冲，再回踩不破，动作边界会怎么升级？"
              className={cn(
                'min-h-28 w-full rounded-xl border border-input bg-background px-3 py-3 text-sm leading-6 shadow-sm outline-none transition',
                'placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30'
              )}
              disabled={isLoading}
            />
          </label>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs leading-5 text-muted-foreground">
              追问会绑定本次主报告会话，重新分析后会清空当前追问上下文。
            </p>
            <Button type="submit" disabled={!canSubmit}>
              继续提问
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export default AiFollowupPanel;

import type { ReactNode } from 'react';

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Card, CardContent } from '@/components/ui/card';

interface AnalysisPeriodSection {
  key: string;
  label: string;
  defaultOpen: boolean;
  summary: string;
  rangeLabel: string;
  topologyTitle: string;
  content: ReactNode;
}

interface AnalysisPeriodDetailsProps {
  sections: AnalysisPeriodSection[];
}

export function AnalysisPeriodDetails({ sections }: AnalysisPeriodDetailsProps) {
  if (!sections.length) {
    return null;
  }

  const defaultValue =
    sections.find((section) => section.defaultOpen)?.key ??
    sections.find((section) => section.label === '日线')?.key ??
    sections[0]?.key;

  return (
    <section className="space-y-3" aria-label="周期详情">
      <div className="space-y-1">
        <h2 className="text-base font-semibold text-foreground">周期详情</h2>
        <p className="text-sm text-muted-foreground">用于承载周期摘要、结构证据与复盘排错信息。</p>
      </div>

      <Accordion type="single" defaultValue={defaultValue} className="rounded-xl border px-4">
        {sections.map((section) => (
          <AccordionItem key={section.key} value={section.key}>
            <AccordionTrigger className="gap-4 py-4 hover:no-underline">
              <div className="space-y-1 text-left">
                <div className="text-sm font-semibold text-foreground">{section.label}</div>
                <div className="text-xs text-muted-foreground">
                  {section.rangeLabel} · {section.summary}
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="space-y-4 pb-5">
              <Card className="gap-3 bg-muted/20 py-4 shadow-none">
                <CardContent className="space-y-4 px-4 text-sm">
                  <div className="space-y-1">
                    <div className="font-medium text-foreground">周期摘要</div>
                    <p className="leading-6 text-muted-foreground">{section.summary}</p>
                  </div>

                  <div className="space-y-2 rounded-lg border bg-background p-3">
                    <div className="font-medium text-foreground">结构证据</div>
                    <div className="rounded-md border border-dashed bg-muted/30 px-3 py-3 text-sm text-muted-foreground">
                      <div className="font-medium text-foreground">{section.topologyTitle}</div>
                      <div className="mt-1">后续任务可在此接入结构拓扑图与解释面板。</div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="font-medium text-foreground">复盘排错</div>
                    <div className="rounded-lg border bg-background p-3 text-muted-foreground">
                      {section.content}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

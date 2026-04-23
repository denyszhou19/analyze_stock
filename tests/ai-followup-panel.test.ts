import test from 'node:test';
import assert from 'node:assert/strict';

import React from 'react';
import { importTsxModule, renderQuietly } from './helpers/tsx-test-loader.ts';

type AiFollowupPanelModule = typeof import('../src/components/stock/AiFollowupPanel.tsx');

test('AiFollowupPanel renders markdown replies and loading state', async () => {
  const { AiFollowupPanel } = await importTsxModule<AiFollowupPanelModule>(
    'src/components/stock/AiFollowupPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AiFollowupPanel, {
      draft: '现在最关键要看什么确认条件？',
      turns: [
        {
          id: 'turn-1',
          question: '现在最关键要看什么确认条件？',
          markdown: '## 先看什么\n\n- **30分钟止跌确认**\n- 量能重新放大',
        },
      ],
      isLoading: true,
      onDraftChange: () => {},
      onSubmit: () => {},
      renderMarkdown: (content: string) =>
        React.createElement('div', {
          'data-slot': 'reply-markdown',
          dangerouslySetInnerHTML: {
            __html: content.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
          },
        }),
    })
  );

  assert.match(html, /基于当前 AI 综合判断继续提问/);
  assert.match(html, /现在最关键要看什么确认条件？/);
  assert.match(html, /reply-markdown/);
  assert.match(html, /<strong>30分钟止跌确认<\/strong>/);
  assert.match(html, /AI 正在继续整理回答/);
  assert.match(html, /回答仅使用 Markdown 渲染/);
});

test('AiFollowupPanel disables submit when draft is empty or loading', async () => {
  const { AiFollowupPanel } = await importTsxModule<AiFollowupPanelModule>(
    'src/components/stock/AiFollowupPanel.tsx'
  );

  const html = renderQuietly(
    React.createElement(AiFollowupPanel, {
      draft: '   ',
      turns: [],
      isLoading: true,
      onDraftChange: () => {},
      onSubmit: () => {},
      renderMarkdown: (content: string) => React.createElement('div', null, content),
    })
  );

  assert.match(html, /disabled=""/);
  assert.match(html, /继续提问/);
});

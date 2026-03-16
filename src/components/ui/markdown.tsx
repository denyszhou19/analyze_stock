'use client';

import React, { memo } from 'react';

interface MarkdownProps {
  content: string;
  className?: string;
}

// 简单的 Markdown 渲染器，不依赖 react-markdown
// 避免与 Next.js 16 / React 19 的兼容性问题
function MarkdownRenderer({ content, className }: MarkdownProps) {
  // 解析并渲染 Markdown
  const renderContent = () => {
    if (!content) return null;
    
    const lines = content.split('\n');
    const elements: React.ReactNode[] = [];
    let listItems: string[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let inCodeBlock = false;
    let codeContent = '';
    let blockquoteContent: string[] = [];
    let inBlockquote = false;
    let key = 0;

    const flushList = () => {
      if (listItems.length > 0 && listType) {
        if (listType === 'ul') {
          elements.push(
            <ul key={key++} className="list-disc list-inside space-y-1.5 mb-4 text-muted-foreground ml-4">
              {listItems.map((item, i) => (
                <li key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
              ))}
            </ul>
          );
        } else {
          elements.push(
            <ol key={key++} className="list-decimal list-inside space-y-1.5 mb-4 text-muted-foreground ml-4">
              {listItems.map((item, i) => (
                <li key={i} className="leading-relaxed" dangerouslySetInnerHTML={{ __html: parseInline(item) }} />
              ))}
            </ol>
          );
        }
        listItems = [];
        listType = null;
      }
    };

    const flushBlockquote = () => {
      if (blockquoteContent.length > 0) {
        elements.push(
          <blockquote key={key++} className="border-l-4 border-primary/30 bg-muted/30 pl-4 py-3 my-4 italic">
            {blockquoteContent.map((line, i) => (
              <p key={i} className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: parseInline(line) }} />
            ))}
          </blockquote>
        );
        blockquoteContent = [];
      }
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // 代码块
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          flushList();
          flushBlockquote();
          inCodeBlock = true;
          codeContent = '';
        } else {
          inCodeBlock = false;
          elements.push(
            <pre key={key++} className="bg-muted/50 border rounded-lg p-4 overflow-x-auto mb-4 text-sm font-mono">
              <code>{codeContent}</code>
            </pre>
          );
        }
        continue;
      }
      
      if (inCodeBlock) {
        codeContent += (codeContent ? '\n' : '') + line;
        continue;
      }

      // 引用块
      if (line.startsWith('>')) {
        flushList();
        inBlockquote = true;
        blockquoteContent.push(line.slice(1).trim());
        continue;
      } else if (inBlockquote && line.trim() === '') {
        flushBlockquote();
        inBlockquote = false;
        continue;
      } else if (inBlockquote) {
        blockquoteContent.push(line);
        continue;
      }

      // 空行
      if (line.trim() === '') {
        flushList();
        flushBlockquote();
        continue;
      }

      // 标题
      if (line.startsWith('#')) {
        flushList();
        flushBlockquote();
        const match = line.match(/^(#{1,6})\s+(.+)$/);
        if (match) {
          const level = match[1].length;
          const text = match[2];
          
          if (level === 1) {
            elements.push(
              <h1 key={key++} className="text-2xl font-bold text-foreground mb-4 pb-2 border-b-2 border-primary/20" dangerouslySetInnerHTML={{ __html: parseInline(text) }} />
            );
          } else if (level === 2) {
            elements.push(
              <h2 key={key++} className="text-xl font-bold text-foreground mt-6 mb-3 flex items-center gap-2">
                <span className="w-1 h-6 bg-primary rounded-full" />
                <span dangerouslySetInnerHTML={{ __html: parseInline(text) }} />
              </h2>
            );
          } else if (level === 3) {
            elements.push(
              <h3 key={key++} className="text-lg font-semibold text-foreground mt-4 mb-2 flex items-center gap-2">
                <span className="w-0.5 h-5 bg-primary/60 rounded-full" />
                <span dangerouslySetInnerHTML={{ __html: parseInline(text) }} />
              </h3>
            );
          } else if (level === 4) {
            elements.push(
              <h4 key={key++} className="text-base font-semibold text-foreground mt-3 mb-2" dangerouslySetInnerHTML={{ __html: parseInline(text) }} />
            );
          } else if (level === 5) {
            elements.push(
              <h5 key={key++} className="text-sm font-semibold text-foreground mt-3 mb-2" dangerouslySetInnerHTML={{ __html: parseInline(text) }} />
            );
          } else {
            elements.push(
              <h6 key={key++} className="text-sm font-medium text-muted-foreground mt-3 mb-2" dangerouslySetInnerHTML={{ __html: parseInline(text) }} />
            );
          }
        }
        continue;
      }

      // 水平线
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line.trim())) {
        flushList();
        flushBlockquote();
        elements.push(<hr key={key++} className="my-6 border-t border-border" />);
        continue;
      }

      // 无序列表
      if (line.match(/^[-*+]\s/)) {
        if (listType !== 'ul') {
          flushList();
          listType = 'ul';
        }
        listItems.push(line.replace(/^[-*+]\s/, ''));
        continue;
      }

      // 有序列表
      if (line.match(/^\d+\.\s/)) {
        if (listType !== 'ol') {
          flushList();
          listType = 'ol';
        }
        listItems.push(line.replace(/^\d+\.\s/, ''));
        continue;
      }

      // 普通段落
      flushList();
      flushBlockquote();
      elements.push(
        <p key={key++} className="text-muted-foreground leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: parseInline(line) }} />
      );
    }

    // 处理末尾的列表和引用
    flushList();
    flushBlockquote();

    return elements;
  };

  return (
    <div className={className}>
      {renderContent()}
    </div>
  );
}

// 解析行内元素
function parseInline(text: string): string {
  if (!text) return '';
  
  // 转义 HTML
  let result = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  
  // 代码 `code`
  result = result.replace(/`([^`]+)`/g, '<code class="bg-muted px-1.5 py-0.5 rounded text-sm font-mono text-primary">$1</code>');
  
  // 粗体 **text** 或 __text__
  result = result.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-foreground">$1</strong>');
  result = result.replace(/__([^_]+)__/g, '<strong class="font-semibold text-foreground">$1</strong>');
  
  // 斜体 *text* 或 _text_
  result = result.replace(/\*([^*]+)\*/g, '<em class="italic text-foreground/90">$1</em>');
  result = result.replace(/_([^_]+)_/g, '<em class="italic text-foreground/90">$1</em>');
  
  // 删除线 ~~text~~
  result = result.replace(/~~([^~]+)~~/g, '<del class="line-through text-muted-foreground/60">$1</del>');
  
  // 链接 [text](url)
  result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-primary hover:underline font-medium">$1</a>');
  
  return result;
}

export const Markdown = memo(MarkdownRenderer);
export default Markdown;

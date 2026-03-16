import { NextRequest, NextResponse } from 'next/server';

interface RSSItem {
  title: string;
  link: string;
  description: string;
  content: string;
  pubDate?: string;
}

// 解析 XML 并提取 item 元素
function parseRSS(xml: string): { title: string; link: string; description: string; items: RSSItem[] } {
  const items: RSSItem[] = [];
  
  // 提取 channel 信息
  const channelTitleMatch = xml.match(/<channel>\s*<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
  const channelLinkMatch = xml.match(/<channel>[\s\S]*?<link>([\s\S]*?)<\/link>/);
  const channelDescMatch = xml.match(/<channel>[\s\S]*?<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
  
  const channelTitle = channelTitleMatch ? channelTitleMatch[1].trim() : 'RSS Feed';
  const channelLink = channelLinkMatch ? channelLinkMatch[1].trim() : '';
  const channelDesc = channelDescMatch ? channelDescMatch[1].trim() : '';

  // 使用正则匹配所有 item
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];
    
    // 提取 title
    const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    // 提取 link
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const link = linkMatch ? linkMatch[1].trim() : '';
    
    // 提取 description
    const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const description = descMatch ? descMatch[1].trim() : '';
    
    // 提取 content:encoded
    const contentMatch = itemContent.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
    const content = contentMatch ? contentMatch[1].trim() : description;
    
    // 提取 pubDate
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : undefined;

    if (title && link) {
      items.push({ title, link, description, content, pubDate });
    }
  }

  return {
    title: channelTitle,
    link: channelLink,
    description: channelDesc,
    items
  };
}

// GET /api/rss - 获取 RSS 内容
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get('url');

  if (!url) {
    return NextResponse.json(
      { success: false, error: '缺少 RSS URL 参数' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FinancialAnalysisBot/1.0)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      // 设置超时
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const xml = await response.text();
    const parsed = parseRSS(xml);

    return NextResponse.json({
      success: true,
      data: {
        title: parsed.title,
        link: parsed.link,
        description: parsed.description,
        items: parsed.items,
        totalCount: parsed.items.length,
      }
    });
  } catch (err) {
    console.error('[RSS API] Error:', err);
    const errorMessage = err instanceof Error ? err.message : '获取 RSS 失败';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}

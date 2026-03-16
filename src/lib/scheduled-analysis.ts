import { S3Storage } from "coze-coding-dev-sdk";
import { getSupabaseClient } from '@/storage/database/supabase-client';
import { scheduler, TaskHandler } from './scheduler';

interface RSSItem {
  title: string;
  link: string;
  description: string;
  content: string;
  pubDate?: string;
}

// 解析 XML 并提取 item 元素
function parseRSS(xml: string): { title: string; items: RSSItem[] } {
  const items: RSSItem[] = [];
  
  const channelTitleMatch = xml.match(/<channel>\s*<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
  const channelTitle = channelTitleMatch ? channelTitleMatch[1].trim() : 'RSS Feed';

  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
    const title = titleMatch ? titleMatch[1].trim() : '';
    
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const link = linkMatch ? linkMatch[1].trim() : '';
    
    const descMatch = itemContent.match(/<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/);
    const description = descMatch ? descMatch[1].trim() : '';
    
    const contentMatch = itemContent.match(/<content:encoded><!\[CDATA\[([\s\S]*?)\]\]><\/content:encoded>/);
    const content = contentMatch ? contentMatch[1].trim() : description;
    
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const pubDate = pubDateMatch ? pubDateMatch[1].trim() : undefined;

    if (title && link) {
      items.push({ title, link, description, content, pubDate });
    }
  }

  return { title: channelTitle, items };
}

// 获取今天的日期字符串（格式：x月x日）
function getTodayDateString(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  return `${month}月${day}日`;
}

// 创建文章 XML
function createArticleXML(article: RSSItem): string {
  const escapeXML = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  };

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:content="http://purl.org/rss/1.0/modules/content/">
  <channel>
    <title>路透财经早报</title>
    <link>${escapeXML(article.link)}</link>
    <description>单篇文章分析</description>
    <item>
      <title>${escapeXML(article.title)}</title>
      <link>${escapeXML(article.link)}</link>
      <description>${escapeXML(article.description)}</description>
      <content:encoded><![CDATA[${article.content}]]></content:encoded>
    </item>
  </channel>
</rss>`;
}

// 工作流任务处理器（简化版，从环境变量获取配置）
const workflowTaskHandler: TaskHandler = async (taskId) => {
  console.log(`[Workflow Task] Starting task ${taskId}...`);
  
  try {
    // 1. 获取配置
    const rssUrl = process.env.RSS_URL || 'https://wechat2rss.marlinworks.xyz/feed/3589865648.xml';
    const token = process.env.FIN_API_TOKEN || '';
    
    if (!token) {
      return { success: false, message: '未配置 Coze API Token' };
    }
    
    // 2. 从数据库获取持仓
    const client = getSupabaseClient();
    const { data: holdings, error: holdingsError } = await client
      .from('stock_holdings')
      .select('code');
    
    if (holdingsError || !holdings || holdings.length === 0) {
      return { success: false, message: '没有配置持仓股票' };
    }
    
    const holdingCodes = holdings.map(h => h.code);
    console.log(`[Workflow Task] Holdings: ${holdingCodes.join(', ')}`);
    
    // 3. 获取 RSS 内容
    const rssResponse = await fetch(rssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; FinancialAnalysisBot/1.0)',
      },
    });
    
    if (!rssResponse.ok) {
      throw new Error(`RSS fetch failed: ${rssResponse.status}`);
    }
    
    const rssXml = await rssResponse.text();
    const { items } = parseRSS(rssXml);
    
    // 4. 查找今天的早报
    const todayStr = getTodayDateString();
    const todayArticle = items.find(item => 
      item.title.includes(`路透早报：${todayStr}`) || 
      item.title.includes(`早报：${todayStr}`)
    );
    
    if (!todayArticle) {
      return { success: false, message: `未找到 ${todayStr} 的早报文章` };
    }
    
    console.log(`[Workflow Task] Found article: ${todayArticle.title}`);
    
    // 5. 上传文章到对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });
    
    const xmlContent = createArticleXML(todayArticle);
    const fileName = `scheduled/${Date.now()}_${encodeURIComponent(todayArticle.title.substring(0, 30))}.xml`;
    const fileKey = await storage.uploadFile({
      fileContent: Buffer.from(xmlContent, 'utf-8'),
      fileName,
      contentType: 'application/xml; charset=utf-8',
    });
    
    const signedUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 3600,
    });
    
    console.log(`[Workflow Task] Article uploaded: ${fileKey}`);
    
    // 6. 调用工作流
    const workflowUrl = "https://gqhdds5fyk.coze.site/stream_run";
    const response = await fetch(workflowUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        early_morning_report: {
          url: signedUrl,
          file_type: "document",
        },
        holdings: holdingCodes,
      }),
    });
    
    if (!response.ok) {
      throw new Error(`Workflow failed: ${response.status}`);
    }
    
    // 7. 处理流式响应（添加超时机制）
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No response body');
    }
    
    const decoder = new TextDecoder();
    let buffer = "";
    let finalReport: string | null = null;
    
    // 流式读取超时：每个 chunk 最多等待 60 秒
    const READ_TIMEOUT = 60 * 1000;
    let lastReadTime = Date.now();
    
    while (true) {
      // 检查超时
      if (Date.now() - lastReadTime > READ_TIMEOUT) {
        reader.cancel();
        throw new Error('流式响应读取超时');
      }
      
      const readPromise = reader.read();
      const timeoutPromise = new Promise<never>((_, reject) => 
        setTimeout(() => reject(new Error('读取 chunk 超时')), READ_TIMEOUT)
      );
      
      const { done, value } = await Promise.race([readPromise, timeoutPromise]);
      lastReadTime = Date.now();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";
      
      for (const event of events) {
        if (!event.trim() || !event.startsWith("data: ")) continue;
        
        try {
          const data = JSON.parse(event.substring(6));
          if (data.type === 'workflow_end' && data.output?.final_report) {
            finalReport = data.output.final_report;
          }
        } catch {
          // ignore
        }
      }
    }
    
    console.log('[Workflow Task] Analysis completed');
    
    return { 
      success: true, 
      message: `分析完成: ${todayArticle.title}`,
      data: { report: finalReport },
    };
    
  } catch (err) {
    console.error('[Workflow Task] Error:', err);
    return { 
      success: false, 
      message: `分析失败: ${err instanceof Error ? err.message : String(err)}` 
    };
  }
};

// 注册工作流任务处理器
export function registerWorkflowHandler() {
  scheduler.registerHandler('workflow', workflowTaskHandler);
}

// 兼容旧接口
export async function executeScheduledAnalysis(): Promise<{ success: boolean; message: string; report?: string }> {
  const result = await workflowTaskHandler('manual');
  const data = result.data as { report?: string } | undefined;
  return {
    success: result.success,
    message: result.message,
    report: data?.report,
  };
}

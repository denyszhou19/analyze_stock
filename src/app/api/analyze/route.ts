import { NextRequest } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface AnalyzeRequest {
  cozeToken: string;
  article: {
    title: string;
    link: string;
    description: string;
    content: string;
  };
  holdings: string[];
}

// 将文章内容转换为 RSS XML 格式
function createArticleXML(article: AnalyzeRequest["article"]): string {
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

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  const sendEvent = (data: object) => {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const body = await request.json();
    const { cozeToken, article, holdings } = body as AnalyzeRequest;

    // 参数验证
    if (!cozeToken) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "请配置 Coze 访问令牌",
          code: "MISSING_TOKEN"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!article || !article.content) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "缺少文章内容",
          code: "MISSING_ARTICLE"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    if (!holdings || holdings.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "请添加至少一个持仓股票",
          code: "MISSING_HOLDINGS"
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // 创建 XML 内容
    const xmlContent = createArticleXML(article);
    
    // 初始化对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });

    // 上传 XML 文件
    const fileName = `articles/${Date.now()}_${encodeURIComponent(article.title.substring(0, 50))}.xml`;
    const fileKey = await storage.uploadFile({
      fileContent: Buffer.from(xmlContent, 'utf-8'),
      fileName,
      contentType: 'application/xml; charset=utf-8',
    });

    console.log(`[Analyze] Uploaded file: ${fileKey}`);

    // 生成签名 URL（有效期 1 小时）
    const signedUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 3600,
    });

    console.log(`[Analyze] Signed URL generated`);

    // 调用工作流接口
    const workflowUrl = "https://gqhdds5fyk.coze.site/stream_run";
    
    let response: Response;
    try {
      response = await fetch(workflowUrl, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cozeToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          early_morning_report: {
            url: signedUrl,
            file_type: "document",
          },
          holdings: holdings,
        }),
      });
    } catch (fetchError) {
      console.error("[Analyze] Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "网络连接失败，无法访问工作流接口",
          details: fetchError instanceof Error ? fetchError.message : String(fetchError),
          code: "NETWORK_ERROR"
        }),
        { status: 503, headers: { "Content-Type": "application/json" } }
      );
    }

    console.log(`[Analyze] Response status: ${response.status}`);

    if (!response.ok) {
      let errorDetails = "";
      try {
        errorDetails = await response.text();
      } catch {
        errorDetails = "无法读取错误详情";
      }
      
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `工作流接口返回错误 (${response.status})`,
          details: errorDetails,
          code: "WORKFLOW_ERROR"
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // 流式转发 SSE 响应
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.enqueue(sendEvent({
            type: "error",
            error: "无法读取响应流",
            code: "STREAM_ERROR"
          }));
          controller.close();
          return;
        }

        const decoder = new TextDecoder();
        let buffer = "";
        let eventCount = 0;

        try {
          controller.enqueue(sendEvent({
            type: "connected",
            timestamp: Date.now(),
            message: "已连接到工作流",
            article: {
              title: article.title,
            }
          }));

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`[Analyze] Stream ended, total events: ${eventCount}`);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const event of events) {
              if (event.trim() === "") continue;
              
              const lines = event.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const jsonStr = line.substring(6);
                  
                  try {
                    const data = JSON.parse(jsonStr);
                    eventCount++;
                    
                    console.log(`[Analyze] Event #${eventCount}: ${data.type}`);
                    controller.enqueue(sendEvent(data));
                    
                  } catch (parseError) {
                    console.error(`[Analyze] Parse error:`, jsonStr.substring(0, 100));
                    controller.enqueue(sendEvent({
                      type: "raw",
                      data: jsonStr
                    }));
                  }
                }
              }
            }
          }

          controller.enqueue(sendEvent({
            type: "stream_end",
            timestamp: Date.now(),
            total_events: eventCount
          }));

          controller.close();
        } catch (streamError) {
          console.error("[Analyze] Stream error:", streamError);
          controller.enqueue(sendEvent({
            type: "error",
            error: streamError instanceof Error ? streamError.message : String(streamError),
            code: "STREAM_ERROR"
          }));
          controller.close();
        } finally {
          reader.releaseLock();
        }
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (err) {
    console.error("[Analyze] Error:", err);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: err instanceof Error ? err.message : "分析失败",
        code: "UNKNOWN_ERROR"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

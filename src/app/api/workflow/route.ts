import { NextRequest } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface WorkflowConfig {
  cozeToken: string;
  rssUrl: string;
  holdings: string[];
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();
  
  // 辅助函数：发送 SSE 事件
  const sendEvent = (data: object) => {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    const body = await request.json();
    const { cozeToken, rssUrl, holdings } = body as WorkflowConfig;

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

    if (!rssUrl) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: "请配置 RSS 订阅地址",
          code: "MISSING_RSS"
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

    // 调用工作流接口
    const workflowUrl = "https://gqhdds5fyk.coze.site/stream_run";
    
    console.log(`[Workflow] Calling: ${workflowUrl}`);
    console.log(`[Workflow] Holdings: ${holdings.join(", ")}`);
    
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
            url: rssUrl,
            file_type: "document",
          },
          holdings: holdings,
        }),
      });
    } catch (fetchError) {
      console.error("[Workflow] Fetch error:", fetchError);
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

    console.log(`[Workflow] Response status: ${response.status}`);

    if (!response.ok) {
      let errorDetails = "";
      try {
        errorDetails = await response.text();
      } catch {
        errorDetails = "无法读取错误详情";
      }
      
      console.error(`[Workflow] Error response: ${errorDetails}`);
      
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
          // 发送连接成功事件
          controller.enqueue(sendEvent({
            type: "connected",
            timestamp: Date.now(),
            message: "已连接到工作流"
          }));

          while (true) {
            const { done, value } = await reader.read();
            if (done) {
              console.log(`[Workflow] Stream ended, total events: ${eventCount}`);
              break;
            }

            buffer += decoder.decode(value, { stream: true });
            
            // 按双换行分隔事件
            const events = buffer.split("\n\n");
            buffer = events.pop() || "";

            for (const event of events) {
              if (event.trim() === "") continue;
              
              // 解析 SSE 格式
              const lines = event.split("\n");
              for (const line of lines) {
                if (line.startsWith("data: ")) {
                  const jsonStr = line.substring(6);
                  
                  try {
                    const data = JSON.parse(jsonStr);
                    eventCount++;
                    
                    console.log(`[Workflow] Event #${eventCount}: ${data.type}`);
                    
                    // 转发事件
                    controller.enqueue(sendEvent(data));
                    
                  } catch (parseError) {
                    console.error(`[Workflow] Parse error:`, jsonStr.substring(0, 100));
                    // 尝试作为原始文本转发
                    controller.enqueue(sendEvent({
                      type: "raw",
                      data: jsonStr
                    }));
                  }
                }
              }
            }
          }

          // 确保发送完成事件
          controller.enqueue(sendEvent({
            type: "stream_end",
            timestamp: Date.now(),
            total_events: eventCount
          }));

          controller.close();
        } catch (streamError) {
          console.error("[Workflow] Stream error:", streamError);
          controller.enqueue(sendEvent({
            type: "error",
            error: streamError instanceof Error ? streamError.message : String(streamError),
            code: "STREAM_ERROR"
          }));
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("[Workflow] Unhandled error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "服务器内部错误",
        message: error instanceof Error ? error.message : "未知错误",
        code: "INTERNAL_ERROR"
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

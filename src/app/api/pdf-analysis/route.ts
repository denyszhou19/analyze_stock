import { NextRequest } from "next/server";
import { S3Storage } from "coze-coding-dev-sdk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    // 获取表单数据
    const formData = await request.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return Response.json({
        success: false,
        error: "未找到上传的文件"
      }, { status: 400 });
    }
    
    if (file.type !== 'application/pdf') {
      return Response.json({
        success: false,
        error: "请上传 PDF 格式的文件"
      }, { status: 400 });
    }
    
    console.log(`[PDF Analysis] Received file: ${file.name}, size: ${file.size} bytes`);
    
    // 获取 Token（优先从请求中获取，其次从环境变量获取）
    const cozeTokenFromRequest = formData.get('cozeToken') as string | null;
    const cozeToken = cozeTokenFromRequest || process.env.FIN_API_TOKEN || process.env.COZE_API_TOKEN;
    if (!cozeToken) {
      console.error('[PDF Analysis] Missing token');
      return Response.json({
        success: false,
        error: "未配置访问令牌，请在系统配置中设置或配置环境变量 FIN_API_TOKEN"
      }, { status: 400 });
    }
    
    // 初始化对象存储
    const storage = new S3Storage({
      endpointUrl: process.env.COZE_BUCKET_ENDPOINT_URL,
      accessKey: "",
      secretKey: "",
      bucketName: process.env.COZE_BUCKET_NAME,
      region: "cn-beijing",
    });
    
    // 读取文件内容
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    
    // 上传 PDF 文件到对象存储
    const fileName = `pdf/${Date.now()}_${file.name}`;
    const fileKey = await storage.uploadFile({
      fileContent: fileBuffer,
      fileName,
      contentType: 'application/pdf',
    });
    
    console.log(`[PDF Analysis] Uploaded file: ${fileKey}`);
    
    // 生成签名 URL（有效期 1 小时）
    const signedUrl = await storage.generatePresignedUrl({
      key: fileKey,
      expireTime: 3600,
    });
    
    console.log(`[PDF Analysis] Signed URL generated`);
    
    // 调用工作流接口分析 PDF
    const workflowUrl = "https://gqhdds5fyk.coze.site/stream_run";
    
    // 获取持仓列表（用于分析）
    let holdings: string[] = [];
    try {
      const holdingsResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:5000'}/api/holdings`);
      const holdingsResult = await holdingsResponse.json();
      if (holdingsResult.success && holdingsResult.data) {
        holdings = holdingsResult.data.map((h: { code: string }) => h.code);
      }
    } catch (e) {
      console.log('[PDF Analysis] Failed to fetch holdings, using empty list');
    }
    
    console.log(`[PDF Analysis] Calling workflow with holdings: ${holdings.join(', ')}`);
    
    // 调用工作流
    const response = await fetch(workflowUrl, {
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
        holdings: holdings.length > 0 ? holdings : ["000001"], // 默认用平安银行作为示例
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[PDF Analysis] Workflow error: ${errorText}`);
      return Response.json({
        success: false,
        error: `工作流接口返回错误 (${response.status})`,
        details: errorText
      }, { status: response.status });
    }
    
    // 解析流式响应，收集完整报告
    const reader = response.body?.getReader();
    if (!reader) {
      return Response.json({
        success: false,
        error: "无法读取响应流"
      }, { status: 500 });
    }
    
    const decoder = new TextDecoder();
    let buffer = "";
    let report = "";
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      
      // 解析 SSE 事件
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
              
              // 收集报告内容
              if (data.type === "report_chunk" && data.content) {
                report += data.content;
              } else if (data.type === "report" && data.content) {
                report = data.content;
              } else if (data.type === "complete" && data.report) {
                report = data.report;
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    }
    
    console.log(`[PDF Analysis] Report length: ${report.length}`);
    
    return Response.json({
      success: true,
      report: report || "分析完成，但未生成报告内容。请检查文件是否包含有效内容。",
      fileName: file.name
    });
    
  } catch (error) {
    console.error("[PDF Analysis] Error:", error);
    return Response.json({
      success: false,
      error: error instanceof Error ? error.message : "分析失败"
    }, { status: 500 });
  }
}

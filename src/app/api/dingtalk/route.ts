import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface DingTalkMessage {
  msgtype: string;
  markdown: {
    title: string;
    text: string;
  };
}

/**
 * 生成钉钉加签
 * @param secret 钉钉机器人密钥
 * @returns 包含 timestamp 和 sign 的对象
 */
function generateSign(secret: string): { timestamp: number; sign: string } {
  const timestamp = Date.now();
  const stringToSign = `${timestamp}\n${secret}`;
  
  // 使用 HMAC-SHA256 算法生成签名
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(stringToSign);
  const signature = hmac.digest("base64");
  
  // URL 编码
  const sign = encodeURIComponent(signature);
  
  return { timestamp, sign };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { webhook, secret, title, content, articleDate, articleUrl } = body;

    if (!webhook) {
      return NextResponse.json(
        { error: "缺少钉钉 Webhook 地址" },
        { status: 400 }
      );
    }

    // 构建完整的 webhook URL（带签名）
    let finalWebhook = webhook;
    if (secret && secret.trim()) {
      const { timestamp, sign } = generateSign(secret);
      const separator = webhook.includes("?") ? "&" : "?";
      finalWebhook = `${webhook}${separator}timestamp=${timestamp}&sign=${sign}`;
    }

    // 构建钉钉消息
    const message: DingTalkMessage = {
      msgtype: "markdown",
      markdown: {
        title: `📊 ${articleDate || "今日"}财经早报分析`,
        text: `## 📊 ${articleDate || "今日"}财经早报分析

${content}

---
**🔗 [查看完整报告](${articleUrl || "#"})**
*由自动化财经分析系统生成*`,
      },
    };

    // 发送到钉钉
    const response = await fetch(finalWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(message),
    });

    const result = await response.json();

    if (result.errcode !== 0) {
      return NextResponse.json(
        { error: "钉钉推送失败", details: result },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, message: "已推送至钉钉" });
  } catch (error) {
    console.error("DingTalk API Error:", error);
    return NextResponse.json(
      {
        error: "推送失败",
        message: error instanceof Error ? error.message : "未知错误",
      },
      { status: 500 }
    );
  }
}

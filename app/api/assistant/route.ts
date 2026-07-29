import { assistantSystemPrompt } from "@/lib/assistant-knowledge";
import { productCatalog } from "@/lib/product-catalog";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type AssistantContext = {
  scene?: string;
  goal?: string;
  stage?: string;
  view?: string;
  selectedProduct?: string;
  configuration?: Record<string, string>;
};

const providerBaseUrl = (process.env.AI_BASE_URL ?? "https://api.sudocode.chat/v1").replace(/\/$/, "");
const providerModel = process.env.AI_MODEL ?? "gpt-5.4-mini";
const requestWindows = new Map<string, { startedAt: number; count: number }>();

function getClientId(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "local";
}

function rateLimited(clientId: string) {
  const now = Date.now();
  const current = requestWindows.get(clientId);
  if (!current || now - current.startedAt > 10 * 60 * 1000) {
    requestWindows.set(clientId, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 30;
}

function cleanMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((message): message is ChatMessage =>
      Boolean(message)
      && typeof message === "object"
      && ((message as ChatMessage).role === "user" || (message as ChatMessage).role === "assistant")
      && typeof (message as ChatMessage).content === "string",
    )
    .slice(-12)
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 4000) }))
    .filter((message) => message.content);
}

function contextMessage(context: AssistantContext) {
  const configuration = context.configuration
    ? Object.entries(context.configuration).map(([key, value]) => `${key}=${value}`).join("；")
    : "暂无";
  return [
    "这是网站自动传入的当前客户旅程上下文，只用于提高回答相关性：",
    `当前页面：${context.view ?? "产品中心"}`,
    `机器人场景：${context.scene ?? "未选择"}`,
    `任务目标：${context.goal ?? "未选择"}`,
    `项目阶段：${context.stage ?? "未选择"}`,
    `当前产品：${context.selectedProduct ?? "未选择"}`,
    `当前配置：${configuration}`,
  ].join("\n");
}

function extractText(content: unknown) {
  if (typeof content === "string") return content.trim();
  if (!Array.isArray(content)) return "";
  return content
    .map((item) => typeof item === "object" && item && "text" in item ? String(item.text) : "")
    .filter(Boolean)
    .join("\n")
    .trim();
}

function matchingProducts(text: string) {
  const normalized = text.toLowerCase();
  return productCatalog
    .map((product) => {
      const terms = [
        product.model,
        product.name,
        product.kind,
        ...product.verified,
      ].filter((term) => term.length >= 3);
      const score = terms.reduce((total, term, index) =>
        total + (normalized.includes(term.toLowerCase()) ? (index < 2 ? 8 : 2) : 0), 0);
      return { product, score };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map(({ product }) => ({
      id: product.id,
      name: product.name,
      model: product.model,
      kind: product.kind,
      image: product.image,
      description: product.description,
      status: product.status,
      verified: product.verified.slice(0, 3),
    }));
}

export function GET() {
  return Response.json({
    status: process.env.AI_API_KEY ? "ready" : "configuration_required",
    model: providerModel,
    knowledgeProducts: productCatalog.length,
  }, { status: process.env.AI_API_KEY ? 200 : 503 });
}

export async function POST(request: Request) {
  if (rateLimited(getClientId(request))) {
    return Response.json({ error: "请求较频繁，请稍后再试或联系销售。" }, { status: 429 });
  }

  const apiKey = process.env.AI_API_KEY;
  if (!apiKey) {
    return Response.json({
      error: "AI 助理尚未配置运行时密钥，请联系演示管理员。",
      code: "AI_NOT_CONFIGURED",
    }, { status: 503 });
  }

  const contentLength = Number(request.headers.get("content-length") ?? "0");
  if (contentLength > 64_000) {
    return Response.json({ error: "对话内容过长，请精简后重试。" }, { status: 413 });
  }

  let body: { messages?: unknown; context?: AssistantContext };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "请求格式无效。" }, { status: 400 });
  }

  const messages = cleanMessages(body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "请先输入需要了解的产品或机器人任务。" }, { status: 400 });
  }
  const totalCharacters = messages.reduce((total, message) => total + message.content.length, 0);
  if (totalCharacters > 16_000) {
    return Response.json({ error: "对话上下文过长，请开始一个新问题。" }, { status: 413 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 75_000);
  try {
    const providerResponse = await fetch(`${providerBaseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: providerModel,
        stream: false,
        max_tokens: 900,
        messages: [
          { role: "system", content: assistantSystemPrompt },
          { role: "system", content: contextMessage(body.context ?? {}) },
          ...messages,
        ],
      }),
      signal: controller.signal,
    });

    const responseBody = await providerResponse.json().catch(() => null) as {
      choices?: Array<{ message?: { content?: unknown } }>;
      error?: { message?: string } | string;
    } | null;

    if (!providerResponse.ok) {
      console.error("AI provider request failed", providerResponse.status);
      return Response.json({
        error: providerResponse.status === 401 || providerResponse.status === 403
          ? "AI 服务认证失败，请联系演示管理员。"
          : "AI 服务暂时不可用，请稍后重试或直接联系销售。",
      }, { status: 502 });
    }

    const answer = extractText(responseBody?.choices?.[0]?.message?.content);
    if (!answer) {
      return Response.json({ error: "AI 服务未返回有效内容，请换一种方式描述需求。" }, { status: 502 });
    }

    const latestQuestion = messages[messages.length - 1].content;
    return Response.json({
      answer,
      model: providerModel,
      products: matchingProducts(`${latestQuestion}\n${answer}`),
      boundary: "AI 建议基于已确认演示资料，最终选型、价格、库存与交期需由 JOYNEXT 销售或工程师确认。",
    });
  } catch (error) {
    console.error(
      "AI assistant request error",
      error instanceof Error ? `${error.name}: ${error.message}` : "unknown",
    );
    return Response.json({
      error: error instanceof Error && error.name === "AbortError"
        ? "AI 响应超时，请稍后重试。"
        : "AI 服务连接失败，请稍后重试或联系销售。",
    }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

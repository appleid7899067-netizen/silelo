import type { InvokeParams, InvokeResult, Message, MessageContent } from "./llm";

type ProviderName = "groq" | "openrouter" | "qwen" | "gemini";

type ProviderConfig = {
  name: ProviderName;
  baseUrl: string;
  apiKey: string;
  models: string[];
};

const splitModels = (value: string | undefined, fallback: string[]) => {
  const models = (value ?? "")
    .split(",")
    .map(model => model.trim())
    .filter(Boolean);
  return models.length ? models : fallback;
};

const providers = (): ProviderConfig[] => [
  {
    name: "groq",
    baseUrl: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
    apiKey: process.env.GROQ_API_KEY || "",
    models: splitModels(process.env.GROQ_FREE_MODELS, [
      "llama-3.1-8b-instant",
      "gemma2-9b-it",
    ]),
  },
  {
    name: "openrouter",
    baseUrl: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    apiKey: process.env.OPENROUTER_API_KEY || "",
    models: splitModels(process.env.OPENROUTER_MODELS || process.env.OPENROUTER_FREE_MODELS, [
      "openrouter/free",
      "openai/gpt-oss-120b:free",
      "qwen/qwen3-coder:free",
      "deepseek/deepseek-r1:free",
    ]),
  },
  {
    name: "qwen",
    baseUrl: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
    apiKey: process.env.QWEN_API_KEY || "",
    models: splitModels(process.env.QWEN_FREE_MODELS, ["qwen-turbo", "qwen-plus"]),
  },
  {
    name: "gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    apiKey: process.env.GOOGLE_API_KEY || "",
    models: splitModels(process.env.GOOGLE_GEMINI_MODEL, ["gemini-2.0-flash-exp"]),
  },
].filter(provider => provider.apiKey);

const MAX_LOOPS = 8;

const toText = (content: MessageContent | MessageContent[]): string => {
  const parts = Array.isArray(content) ? content : [content];
  return parts
    .map(part => {
      if (typeof part === "string") return part;
      if (part.type === "text") return part.text;
      return "";
    })
    .filter(Boolean)
    .join("\n");
};

const toOpenAIMessage = (message: Message) => ({
  role: message.role === "function" ? "tool" : message.role,
  ...(message.name ? { name: message.name } : {}),
  ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}),
  content: toText(message.content),
});

const buildPayload = (params: InvokeParams, model: string) => {
  const payload: Record<string, unknown> = {
    model,
    messages: params.messages.map(toOpenAIMessage),
  };
  if (params.tools?.length) payload.tools = params.tools;
  if (params.toolChoice || params.tool_choice) payload.tool_choice = params.toolChoice || params.tool_choice;
  const maxTokens = params.maxTokens ?? params.max_tokens;
  if (typeof maxTokens === "number") payload.max_tokens = maxTokens;
  if (params.responseFormat || params.response_format) payload.response_format = params.responseFormat || params.response_format;
  if (params.thinking) payload.thinking = params.thinking;
  if (params.reasoning) payload.reasoning = params.reasoning;
  return payload;
};

const requestJson = async (url: string, apiKey: string, body: unknown, headers: Record<string, string> = {}) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}`, ...headers },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 300);
    throw new Error(`${response.status} ${response.statusText}${detail ? ` — ${detail}` : ""}`);
  }
  return response.json() as Promise<Record<string, any>>;
};

const callGemini = async (provider: ProviderConfig, model: string, params: InvokeParams): Promise<InvokeResult> => {
  const system = params.messages.filter(message => message.role === "system").map(message => toText(message.content)).join("\n");
  const contents = params.messages
    .filter(message => message.role !== "system")
    .map(message => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: toText(message.content) }],
    }));
  const body: Record<string, unknown> = {
    contents,
    ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
    generationConfig: {
      temperature: 0.7,
      ...(typeof (params.maxTokens ?? params.max_tokens) === "number" ? { maxOutputTokens: params.maxTokens ?? params.max_tokens } : {}),
    },
  };
  const data = await requestJson(`${provider.baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(provider.apiKey)}`, provider.apiKey, body, { authorization: "" });
  const text = data.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("") || "";
  if (!text) throw new Error("Gemini returned an empty response");
  return {
    id: data.responseId || `gemini-${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: data.candidates?.[0]?.finishReason || "stop" }],
    usage: data.usageMetadata ? {
      prompt_tokens: data.usageMetadata.promptTokenCount || 0,
      completion_tokens: data.usageMetadata.candidatesTokenCount || 0,
      total_tokens: data.usageMetadata.totalTokenCount || 0,
    } : undefined,
  };
};

const callProvider = async (provider: ProviderConfig, model: string, params: InvokeParams): Promise<InvokeResult> => {
  if (provider.name === "gemini") return callGemini(provider, model, params);
  const body = buildPayload(params, model);
  const data = await requestJson(`${provider.baseUrl.replace(/\/$/, "")}/chat/completions`, provider.apiKey, body, {
    ...(process.env.APP_URL ? { "HTTP-Referer": process.env.APP_URL } : {}),
    ...(provider.name === "openrouter" ? { "X-Title": "SILELO Neo-Connect" } : {}),
  });
  return data as unknown as InvokeResult;
};

const providerForModel = (model: string, available: ProviderConfig[]) => {
  if (model.startsWith("groq/")) return available.find(provider => provider.name === "groq");
  if (model.startsWith("qwen/")) return available.find(provider => provider.name === "qwen");
  if (model.startsWith("google/") || model.startsWith("gemini/")) return available.find(provider => provider.name === "gemini");
  if (model.startsWith("openrouter/") || model.includes("/") || model.includes(":")) return available.find(provider => provider.name === "openrouter");
  return available.find(provider => provider.name === "groq") || available[0];
};

export const multiProviderChat = async (params: InvokeParams): Promise<InvokeResult> => {
  const available = providers();
  if (!available.length) throw new Error("No external LLM provider is configured");

  const explicitModel = params.model && params.model !== "auto" ? params.model : undefined;
  const selected = explicitModel ? providerForModel(explicitModel, available) : undefined;
  if (explicitModel && !selected) throw new Error(`No provider is configured for model ${explicitModel}`);

  const attempts = Math.max(1, available.length * MAX_LOOPS);
  const failures: string[] = [];
  for (let attempt = 0; attempt < attempts; attempt++) {
    const provider = selected || available[attempt % available.length];
    const modelPool = provider.models.length ? provider.models : ["openrouter/free"];
    const rawModel = explicitModel || modelPool[Math.floor(attempt / available.length) % modelPool.length];
    const model = provider.name === "groq" || provider.name === "qwen" || provider.name === "gemini"
      ? rawModel.replace(/^(groq|qwen|google|gemini)\//, "")
      : rawModel;
    try {
      console.log(`[SILELO] LLM ${provider.name}/${model} attempt ${attempt + 1}/${attempts}`);
      return await callProvider(provider, model, params);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push(`${provider.name}/${model}: ${message}`);
      console.warn(`[SILELO] LLM failover: ${failures[failures.length - 1]}`);
      if (explicitModel) break;
    }
  }
  throw new Error(`ทุกโมเดลไม่ว่างหลัง failover ${MAX_LOOPS} รอบ: ${failures.slice(-8).join(" | ")}`);
};

export const listMultiProviderModels = () => {
  const now = Math.floor(Date.now() / 1000);
  return providers().flatMap(provider => provider.models.map(model => ({
    id: provider.name === "openrouter" ? model : `${provider.name}/${model}`,
    object: "model",
    created: now,
    owned_by: provider.name,
  })));
};

export const multiProviderStatus = () => providers().map(provider => ({
  provider: provider.name,
  enabled: Boolean(provider.apiKey),
  models: provider.models.map(model => provider.name === "openrouter" ? model : `${provider.name}/${model}`),
  maxLoops: MAX_LOOPS,
}));

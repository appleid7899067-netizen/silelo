const splitModels = (value: string | undefined, fallback: string[]) => {
  const models = (value ?? "").split(",").map(model => model.trim()).filter(Boolean);
  return (models.length ? models : fallback).slice(0, 16);
};

export const ENV = {
  appId: process.env.VITE_APP_ID ?? "",
  cookieSecret: process.env.JWT_SECRET ?? "",
  databaseUrl: process.env.DATABASE_URL ?? "",
  oAuthServerUrl: process.env.OAUTH_SERVER_URL ?? "",
  ownerOpenId: process.env.OWNER_OPEN_ID ?? "",
  isProduction: process.env.NODE_ENV === "production",
  forgeApiUrl: process.env.BUILT_IN_FORGE_API_URL ?? "",
  forgeApiKey: process.env.BUILT_IN_FORGE_API_KEY ?? "",
  openRouterApiKey: process.env.OPENROUTER_API_KEY ?? "",
  openRouterBaseUrl: process.env.OPENROUTER_BASE_URL ?? "https://openrouter.ai/api/v1",
  openRouterModels: splitModels(process.env.OPENROUTER_MODELS || process.env.OPENROUTER_FREE_MODELS, [
    "openrouter/free",
    "openai/gpt-oss-120b:free",
    "qwen/qwen3-coder:free",
    "deepseek/deepseek-r1:free",
    "google/gemma-3-27b-it:free",
    "meta-llama/llama-3.3-70b-instruct:free",
    "mistralai/mistral-small-3.1-24b-instruct:free",
  ]),
  groqApiKey: process.env.GROQ_API_KEY ?? "",
  groqBaseUrl: process.env.GROQ_BASE_URL ?? "https://api.groq.com/openai/v1",
  groqModels: splitModels(process.env.GROQ_FREE_MODELS, ["llama-3.1-8b-instant", "gemma2-9b-it"]),
  qwenApiKey: process.env.QWEN_API_KEY ?? "",
  qwenBaseUrl: process.env.QWEN_BASE_URL ?? "https://dashscope.aliyuncs.com/compatible-mode/v1",
  qwenModels: splitModels(process.env.QWEN_FREE_MODELS, ["qwen-turbo", "qwen-plus"]),
  googleApiKey: process.env.GOOGLE_API_KEY ?? "",
  googleGeminiModel: process.env.GOOGLE_GEMINI_MODEL ?? "gemini-2.0-flash-exp",
  mcpEnabled: process.env.MCP_ENABLED === "true",
  mcpWriteEnabled: process.env.MCP_WRITE_ENABLED === "true",
  mcpServerUrl: process.env.MCP_SERVER_URL ?? "",
};

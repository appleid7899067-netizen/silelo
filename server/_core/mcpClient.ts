import { ENV } from "./env";

type MCPTool = { name: string; description?: string; inputSchema?: Record<string, unknown> };

const baseUrl = () => ENV.mcpServerUrl.replace(/\/$/, "");

const request = async (path: string, init?: RequestInit) => {
  if (!ENV.mcpEnabled) throw new Error("MCP ยังไม่เปิดใช้งาน");
  if (!ENV.mcpServerUrl) throw new Error("MCP_SERVER_URL is not configured");
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: { "content-type": "application/json", ...(init?.headers || {}) },
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 400);
    throw new Error(`MCP ${response.status}: ${detail || response.statusText}`);
  }
  return response.json() as Promise<Record<string, unknown>>;
};

export const mcpClient = {
  enabled: () => ENV.mcpEnabled,
  isReadOnly: () => !ENV.mcpWriteEnabled,
  async listTools(): Promise<MCPTool[]> {
    const data = await request("/tools");
    return Array.isArray(data.tools) ? data.tools as MCPTool[] : [];
  },
  async callTool(name: string, args: Record<string, unknown> = {}) {
    if (!ENV.mcpWriteEnabled && (name.startsWith("gitlab_") || name.startsWith("github_") || name.startsWith("write_") || name.startsWith("delete_"))) {
      throw new Error("MCP WRITE ยังไม่เปิดใช้ — MCP_WRITE_ENABLED=false");
    }
    return request(`/tools/${encodeURIComponent(name)}`, {
      method: "POST",
      body: JSON.stringify(args),
    });
  },
};

import { describe, expect, it, vi } from "vitest";

const mockState = vi.hoisted(() => ({ messages: [] as Array<Record<string, unknown>>, events: [] as Array<Record<string, unknown>> }));
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
  listLLMModels: vi.fn(async () => ({ data: [] })),
}));
vi.mock("./_core/imageGeneration", () => ({
  generateImage: vi.fn(),
}));
vi.mock("./github", () => ({
  githubPermissionStatus: vi.fn(async () => ({ read: true, write: true })),
  allowedGithubRepositories: vi.fn(() => ["phanuphanthcanthrsngsaeng17-del/silelo-neo-connect"]),
  getGithubRepository: vi.fn(),
  updateGithubFile: vi.fn(async () => ({ repository: "phanuphanthcanthrsngsaeng17-del/silelo-neo-connect", path: "README.md", commitSha: "test-sha", commitUrl: "https://github.com/example/commit/test-sha" })),
}));
vi.mock("./db", () => ({
  SINGLE_ROOM_DB_KEY: "silelo",
  getChatMessages: vi.fn(async (userId: number) => mockState.messages.filter(message => message.userId === userId)),
  getChatEvents: vi.fn(async (userId: number) => mockState.events.filter(event => event.userId === userId)),
  addChatEvent: vi.fn(async (input: Record<string, unknown>) => { mockState.events.push({ ...input, userId: input.userId, id: mockState.events.length + 1, createdAtUtc: input.createdAtUtc || Date.now() }); }),
  addChatMessage: vi.fn(async (input: Record<string, unknown>) => {
    const saved = { ...input, roomKey: "silelo", createdAtUtc: input.createdAtUtc || Date.now(), id: mockState.messages.length + 1 };
    mockState.messages.push(saved);
    return saved;
  }),
}));

import { appRouter } from "./routers";
import { invokeLLM } from "./_core/llm";
import { addChatMessage } from "./db";
import { generateImage } from "./_core/imageGeneration";
import { allowedGithubRepositories, updateGithubFile } from "./github";
import type { TrpcContext } from "./_core/context";

function context(): TrpcContext {
  return {
    user: {
      id: 91,
      openId: "test-user",
      name: "Test User",
      email: "test@example.com",
      loginMethod: "test",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("chat single-room policy", () => {
  it("stores a UTC Unix millisecond timestamp in the persistence payload", async () => {
    vi.mocked(invokeLLM).mockResolvedValue({ choices: [{ message: { role: "assistant", content: "รับทราบครับ" } }], model: "manus-test" } as any);
    vi.mocked(addChatMessage).mockClear();
    const before = Date.now();
    const caller = appRouter.createCaller(context());
    await caller.chat.send({ content: "ข้อความที่ต้องเก็บเวลา" });
    const calls = vi.mocked(addChatMessage).mock.calls;
    const stored = calls[0]?.[0] as { createdAtUtc?: number };
    expect(stored.createdAtUtc).toBeGreaterThanOrEqual(before);
    expect(stored.createdAtUtc).toBeLessThanOrEqual(Date.now());
    const history = await caller.chat.history({ limit: 20 });
    expect(history.messages.some(message => message.createdAtUtc >= before)).toBe(true);
    expect(history.events.some(event => event.eventType === "request.received")).toBe(true);
  });

  it("returns a bounded error when the image service fails", async () => {
    vi.mocked(generateImage).mockRejectedValueOnce(new Error("image service unavailable"));
    const caller = appRouter.createCaller(context());
    await expect(caller.chat.send({ content: "/draw test", confirm: true })).rejects.toThrow("image service unavailable");
  });

  it("returns an LLM error without claiming success", async () => {
    vi.mocked(invokeLLM).mockRejectedValueOnce(new Error("LLM unavailable"));
    const caller = appRouter.createCaller(context());
    await expect(caller.chat.send({ content: "ทดสอบ LLM" })).rejects.toThrow("LLM unavailable");
  });

  it("returns a database error without claiming persistence", async () => {
    vi.mocked(addChatMessage).mockRejectedValueOnce(new Error("DATABASE_UNAVAILABLE"));
    const caller = appRouter.createCaller(context());
    await expect(caller.chat.send({ content: "ทดสอบฐานข้อมูล" })).rejects.toThrow("DATABASE_UNAVAILABLE");
  });

  it("keeps GitHub actions setup-only and asks before external work", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.chat.send({ content: "/project status" });
    expect(result.ok).toBe(true);
    expect(result.needsConfirmation).toBe(true);
    expect(result.confirmation).toContain("ยืนยันการเขียน GitHub");
  });
  it("does not write GitHub before confirmation and writes only after confirmation", async () => {
    const caller = appRouter.createCaller(context());
    vi.mocked(updateGithubFile).mockClear();
    const pending = await caller.chat.send({ content: "/project phanuphanthcanthrsngsaeng17-del/silelo-neo-connect/README.md :: verified update" });
    expect(pending.needsConfirmation).toBe(true);
    expect(updateGithubFile).not.toHaveBeenCalled();
    const committed = await caller.chat.send({ content: "/project phanuphanthcanthrsngsaeng17-del/silelo-neo-connect/README.md :: verified update", confirm: true });
    expect(committed.reply).toContain("อัปเดตไฟล์บน GitHub สำเร็จจริง");
    expect(updateGithubFile).toHaveBeenCalledTimes(1);
  });

  it("rejects a repository outside the allowlist without writing", async () => {
    const caller = appRouter.createCaller(context());
    vi.mocked(updateGithubFile).mockClear();
    const result = await caller.chat.send({ content: "/project other-owner/other-repo/README.md :: blocked", confirm: true });
    expect(result.reply).toContain("ไม่อยู่ใน allowlist");
    expect(updateGithubFile).not.toHaveBeenCalled();
    expect(allowedGithubRepositories()).toContain("phanuphanthcanthrsngsaeng17-del/silelo-neo-connect");
  });

  it("requires confirmation through the shared policy before GitHub actions", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.chat.send({ content: "/gh inspect" });
    expect(result.needsConfirmation).toBe(true);
    expect(result.confirmation).toContain("ยืนยันการอ่าน GitHub");
  });

  it.each([
    ["/plugin run", "ยืนยันการใช้ปลั๊กอิน"],
    ["/external sync", "ยืนยันการเรียกบริการภายนอก"],
    ["/save work", "ยืนยันการบันทึกงาน"],
  ])("blocks critical command %s until confirmation", async (content, expected) => {
    const caller = appRouter.createCaller(context());
    const result = await caller.chat.send({ content });
    expect(result.needsConfirmation).toBe(true);
    expect(result.confirmation).toContain(expected);
  });

  it("always returns the one fixed room and exposes transparent status", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.chat.send({ content: "/status" });
    expect(result.ok).toBe(true);
    expect(result.room).toBe("สลี่");
    expect(result.reply).toContain("ต้องตั้งค่า");
  });

  it("requires confirmation before image generation", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.chat.send({ content: "/draw neon city" });
    expect(result.needsConfirmation).toBe(true);
    expect(result.confirmation).toContain("ยืนยันการสร้างภาพ");
  });

  it("does not claim unavailable baseline models are ready", async () => {
    const caller = appRouter.createCaller(context());
    const result = await caller.chat.send({ content: "ทดสอบ", modelId: "openrouter_fast" });
    expect(result.ok).toBe(false);
    expect(result.status).toBe("setup");
  });
});

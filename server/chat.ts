import { readFileSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import { generateImage } from "./_core/imageGeneration";
import { invokeLLM, listLLMModels } from "./_core/llm";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { addChatEvent, addChatMessage, getChatEvents, getChatMessages, SINGLE_ROOM_DB_KEY } from "./db";
import { confirmationFor, requiresConfirmation } from "../shared/confirmation";
import { allowedGithubRepositories, getGithubRepository, githubPermissionStatus, updateGithubFile } from "./github";
import {
  BASELINE_COMMANDS,
  BASELINE_MODELS,
  BASELINE_SKILLS,
  CAPABILITY_GROUPS,
  SINGLE_ROOM_NAME,
  stateLabel,
  type CapabilityState,
  type CatalogItem,
} from "../shared/catalog";

type SourceSkillRegistry = { version: number; total: number; modes: { understand: number; execute: number }; skills: Array<{ id: string; mode: string; category: string; categoryTitle: string; title: string; description: string; path: string }> };

const sourceRegistry: SourceSkillRegistry = (() => {
  try {
    return JSON.parse(readFileSync(join(process.cwd(), "shared/baseline/skill-registry.json"), "utf8")) as SourceSkillRegistry;
  } catch {
    return { version: 1, total: 900, modes: { understand: 450, execute: 450 }, skills: [] };
  }
})();
const normalizedSourceSkills = sourceRegistry.skills.length
  ? sourceRegistry.skills
  : BASELINE_SKILLS.map(skill => ({ id: skill.id, mode: skill.state === "setup" ? "execute" : "understand", category: "baseline", categoryTitle: "baseline catalog", title: skill.label, description: skill.description, path: "shared/catalog.ts" }));
const ALL_BASELINE_SKILLS: CatalogItem[] = normalizedSourceSkills.map(skill => ({
  id: skill.id,
  label: skill.title,
  description: skill.description,
  state: skill.mode === "execute" ? "setup" : "ready",
  note: `${skill.mode} · ${skill.categoryTitle}`,
}));

const sendInput = z.object({
  content: z.string().trim().min(1).max(12000),
  modelId: z.string().trim().optional(),
  confirm: z.boolean().optional().default(false),
});

const normalizeContent = (content: unknown): string => {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content.map(part => typeof part === "string" ? part : (part as { text?: string }).text || "").join("\n");
  }
  return "";
};

const catalogText = (title: string, items: typeof BASELINE_MODELS): string =>
  `## ${title}\n\n${items.map(item => `- **${item.label}** — ${item.description} · ${stateLabel[item.state]} (${item.note})`).join("\n")}`;

async function runtimeModels() {
  try {
    const response = await listLLMModels();
    return response.data || [];
  } catch (error) {
    console.warn("[Silelo] Could not read Manus model catalog", error);
    return [];
  }
}

async function capabilityCatalog() {
  const models = await runtimeModels();
  const github = await githubPermissionStatus();
  const ids = new Set(models.map(model => model.id));
  const modelItems = BASELINE_MODELS.map(item => ({
    ...item,
    state: item.id === "auto" ? "ready" as CapabilityState : ids.has(item.id) ? "ready" as CapabilityState : item.state,
    note: item.id === "auto" ? "Manus gateway พร้อมใช้" : ids.has(item.id) ? "พบใน Manus runtime catalog" : item.note,
  }));
  return {
    room: { key: SINGLE_ROOM_DB_KEY, name: SINGLE_ROOM_NAME },
    models: modelItems,
    skills: ALL_BASELINE_SKILLS.slice(0, 24),
    skillCoverage: { version: sourceRegistry.version, total: sourceRegistry.total, understand: sourceRegistry.modes.understand, execute: sourceRegistry.modes.execute, categories: new Set(sourceRegistry.skills.map(skill => skill.category)).size },
    commands: BASELINE_COMMANDS,
    groups: CAPABILITY_GROUPS.map(group => ({ ...group, items: group.id === "models" ? modelItems : group.items })),
    runtime: {
      llm: (models.length > 0 ? "ready" : "setup") as CapabilityState,
      llmModelCount: models.length,
      image: "ready" as CapabilityState,
      github: (github.read ? "ready" : "setup") as CapabilityState,
      githubRead: github.read,
      githubWrite: github.write,
      githubRepositories: allowedGithubRepositories(),
      githubError: github.error,
      plugins: "unsupported" as CapabilityState,
      tts: "setup" as CapabilityState,
      permissions: "Guest chat is available; Manus OAuth session unlocks private history and account-scoped features",
    },
  };
}

function markdownCatalog(items: CatalogItem[], title: string, total = items.length) {
  const shown = items.slice(0, 36);
  return `${catalogText(title, shown)}\n\nแสดงตัวอย่าง ${shown.length} จากทั้งหมด ${total} รายการใน baseline`;
}

function parseCommand(content: string) {
  const match = /^\/(\S+)(?:\s+([\s\S]+))?$/.exec(content.trim());
  return match ? { command: match[1].toLowerCase(), argument: (match[2] || "").trim() } : null;
}

async function recordEvent(userId: number | undefined, eventType: string, label: string, status: "running" | "success" | "error" | "waiting_confirmation" | "cancelled", detail?: string) {
  if (!userId) return;
  try {
    await addChatEvent({ userId, eventType, label, status, detail });
  } catch (error) {
    console.warn("[Silelo] Task event could not be persisted", error);
  }
}

async function withErrorEvent<T>(userId: number | undefined, label: string, action: () => Promise<T>): Promise<T> {
  try {
    return await action();
  } catch (error) {
    await recordEvent(userId, "action.failed", label, "error", error instanceof Error ? error.message : "unknown error");
    throw error;
  }
}

export const chatRouter = router({
  history: protectedProcedure.input(z.object({ limit: z.number().int().min(1).max(200).optional() }).optional()).query(async ({ ctx, input }) => {
    const rows = await getChatMessages(ctx.user.id, input?.limit || 80);
    const events = await getChatEvents(ctx.user.id, 40);
    return { room: { key: SINGLE_ROOM_DB_KEY, name: SINGLE_ROOM_NAME }, messages: rows, events };
  }),

  catalog: publicProcedure.query(async () => capabilityCatalog()),

  send: publicProcedure.input(sendInput).mutation(async ({ ctx, input }) => {
    const userId = ctx.user?.id;
    const text = input.content.trim();
    const modelId = input.modelId || "auto";
    const catalog = await capabilityCatalog();
    const selectedModel = catalog.models.find(model => model.id === modelId);
    if (!selectedModel || (modelId !== "auto" && selectedModel.state !== "ready")) {
      return { ok: false, room: SINGLE_ROOM_NAME, needsConfirmation: false, error: `โมเดล ${modelId} ยัง${selectedModel ? "ต้องตั้งค่า" : "ไม่อยู่ใน catalog"} จึงยังเรียกใช้งานไม่ได้`, status: "setup" as CapabilityState };
    }

    const command = parseCommand(text);
    await recordEvent(userId, "request.received", "รับคำขอจากผู้ใช้", "running", text.slice(0, 500));
    if (command?.command === "draw" && command.argument && requiresConfirmation("generate-image", input.confirm)) {
      const policy = confirmationFor("generate-image");
      await recordEvent(userId, "confirmation.required", policy.title, "waiting_confirmation", command?.argument);
      return { ok: true, room: SINGLE_ROOM_NAME, needsConfirmation: true, confirmation: `${policy.title}: ${policy.reason}\n\n> ${command.argument}\n\nยืนยันแล้วจึงจะเริ่มดำเนินการ` };
    }
    const criticalAction = command?.command === "plugin" ? "plugin" : command?.command === "external" ? "external-service" : command?.command === "save" ? "save-work" : undefined;
    if (criticalAction && requiresConfirmation(criticalAction, input.confirm)) {
      const policy = confirmationFor(criticalAction);
      await recordEvent(userId, "confirmation.required", policy.title, "waiting_confirmation", command?.argument);
      return { ok: true, room: SINGLE_ROOM_NAME, needsConfirmation: true, confirmation: `${policy.title}: ${policy.reason}\n\nคำสั่งนี้ยังไม่ทำงานจนกว่าจะยืนยันอีกครั้ง` };
    }
    if ((command?.command === "gh" || command?.command === "project") && requiresConfirmation(command.command === "gh" ? "github-read" : "github-write", input.confirm)) {
      const policy = confirmationFor(command.command === "gh" ? "github-read" : "github-write");
      await recordEvent(userId, "confirmation.required", policy.title, "waiting_confirmation", command?.argument);
      return { ok: true, room: SINGLE_ROOM_NAME, needsConfirmation: true, confirmation: `${policy.title}: ${policy.reason}\n\nคำสั่งนี้ยังไม่ทำงานจนกว่าจะตั้งค่า integration และยืนยันอีกครั้ง` };
    }
    if (userId) {
      await addChatMessage({ userId, role: "user", content: text, model: modelId, status: "complete", createdAtUtc: Date.now() });
    }
    let reply = "";
    let provider = "manus";
    let usedModel = modelId;
    let attachmentUrl: string | undefined;

    if (command?.command === "help") {
      reply = `## ห้องแชทสลี่\n\nห้องนี้มีเพียงห้องเดียวและรวมความสามารถจาก baseline ไว้ด้วยกัน\n\nคำสั่งที่ใช้ได้: ${BASELINE_COMMANDS.filter(item => item.state === "ready").map(item => `\`${item.label}\``).join(", ")}\n\nคำสั่งที่ยังต้องตั้งค่า: \`${BASELINE_COMMANDS.filter(item => item.state === "setup").map(item => item.label).join("\`, \`")}\n\nสลี่จะไม่อ้างว่าเชื่อมต่อบริการภายนอกหรือแก้ไฟล์จริง หากยังไม่มี integration และสิทธิ์ที่ถูกต้อง`;
    } else if (command?.command === "status") {
      reply = `## สถานะความสามารถของสลี่\n\n- ห้องแชท: **พร้อมใช้** · ${SINGLE_ROOM_NAME} เท่านั้น\n- Manus LLM: **${stateLabel[catalog.runtime.llm]}** · ${catalog.runtime.llmModelCount} โมเดลใน runtime catalog\n- สร้างภาพ: **พร้อมใช้** · Manus Image Service\n- GitHub: **${stateLabel[catalog.runtime.github]}** · ${catalog.runtime.github === "ready" ? `อ่านได้${catalog.runtime.githubWrite ? "; เขียนได้หลังยืนยัน" : "; write permission ยังไม่ผ่านการตรวจ"}` : `ยังใช้ไม่ได้${catalog.runtime.githubError ? ` (${catalog.runtime.githubError})` : ""}`} · repo: ${catalog.runtime.githubRepositories.join(", ")}\n- ปลั๊กอิน: **ยังไม่รองรับ** · ไม่มีการจำลองว่าเชื่อมต่อแล้ว\n- เสียงตอบกลับ: **ต้องตั้งค่า** · เวอร์ชันนี้ยังไม่เปิด TTS\n\nการเปลี่ยนแปลงสำคัญและการเขียนไฟล์จริงต้องได้รับการยืนยันก่อนเสมอ`;
    } else if (command?.command === "models") {
      reply = markdownCatalog(catalog.models, "Model Catalog จาก baseline", catalog.models.length);
    } else if (command?.command === "skills") {
      reply = markdownCatalog(ALL_BASELINE_SKILLS, "Skill Catalog จาก baseline", sourceRegistry.total);
    } else if (command?.command === "draw") {
      if (!command.argument) {
        reply = "ใช้รูปแบบ `/draw <คำอธิบายภาพ>` และสลี่จะแสดงคำขอยืนยันก่อนสร้างภาพ";
      } else {
        const generated = await withErrorEvent(userId, "สร้างภาพล้มเหลว", () => generateImage({ prompt: command.argument }));
        attachmentUrl = generated.url;
        reply = `สร้างภาพให้แล้วตามคำขอที่ยืนยัน:\n\n![ภาพที่สร้าง](${generated.url})\n\nสถานะ: เรียกใช้ Manus Image Service สำเร็จ`;
        provider = "manus-image";
        usedModel = "gpt-image-2";
      }
    } else if (command?.command === "translate") {
      const split = command.argument.split(/\s*::\s*/);
      if (split.length < 2) reply = "ใช้รูปแบบ `/translate <ภาษาเป้าหมาย> :: <ข้อความ>`";
      else {
        const response = await withErrorEvent(userId, "แปลข้อความล้มเหลว", () => invokeLLM({ messages: [{ role: "system", content: `แปลข้อความเป็น${split[0]} รักษาความหมายและรูปแบบเดิม ตอบเฉพาะคำแปล` }, { role: "user", content: split.slice(1).join(" :: ") }], model: modelId === "auto" ? undefined : modelId, maxTokens: 2000 }));
        reply = normalizeContent(response.choices[0]?.message?.content) || "ไม่พบคำแปล";
      }
    } else if (command?.command === "summarize") {
      if (!command.argument) reply = "ใช้รูปแบบ `/summarize <ข้อความ>`";
      else {
        const response = await withErrorEvent(userId, "สรุปข้อความล้มเหลว", () => invokeLLM({ messages: [{ role: "system", content: "สรุปข้อความเป็นภาษาไทยอย่างกระชับ ระบุประเด็นสำคัญ และอย่าเติมข้อมูลที่ไม่มีในต้นฉบับ" }, { role: "user", content: command.argument }], model: modelId === "auto" ? undefined : modelId, maxTokens: 1200 }));
        reply = normalizeContent(response.choices[0]?.message?.content) || "ไม่พบผลสรุป";
      }
    } else if (command?.command === "plugin" || command?.command === "external") {
      reply = `คำสั่งนี้ได้รับการยืนยันแล้ว แต่ยังไม่ดำเนินการ เพราะ ${command.command === "plugin" ? "ปลั๊กอินยังไม่รองรับ" : "ยังไม่มี external service integration ที่ได้รับอนุญาต"}`;
      provider = "access-policy";
      usedModel = "bounded";
    } else if (command?.command === "save") {
      reply = userId ? "บันทึกข้อความนี้ลงประวัติห้องสลี่แล้ว โดยใช้ server timestamp แบบ UTC Unix ms" : "โหมดผู้เยี่ยมชมจะไม่บันทึกประวัติลงบัญชี กรุณาเข้าสู่ระบบหากต้องการเก็บประวัติ";
      provider = "manus-storage";
      usedModel = "bounded";
    } else if (command?.command === "project") {
      const match = /^([^/]+\/[^/]+)\/([^:]+?)\s*::\s*([\s\S]+)$/.exec(command.argument);
      if (!match) {
        reply = "ใช้รูปแบบ `/project owner/repository/path/to/file :: เนื้อหาใหม่` หลังยืนยัน เพื่ออัปเดตไฟล์จริงบน GitHub";
        provider = "github-api";
        usedModel = "bounded";
      } else if (!allowedGithubRepositories().includes(match[1])) {
        reply = `ปฏิเสธการเขียน: repository \`${match[1]}\` ไม่อยู่ใน allowlist ของแอป`;
        provider = "access-policy";
        usedModel = "bounded";
      } else {
        try {
          const result = await withErrorEvent(userId, "เขียนไฟล์ GitHub ล้มเหลว", () => updateGithubFile(match[1], match[2], match[3], `Silelo update ${match[2]}`));
          reply = `อัปเดตไฟล์บน GitHub สำเร็จจริง:\n\n- Repository: \`${result.repository}\`\n- ไฟล์: \`${result.path}\`\n- Commit: [${result.commitSha}](${result.commitUrl})`;
          provider = "github-api";
          usedModel = "github-rest";
        } catch (error) {
          reply = `เขียนไฟล์ GitHub ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`;
          provider = "github-api";
          usedModel = "bounded";
        }
      }
    } else if (command?.command === "gh") {
      if (!command.argument) {
        reply = "ใช้รูปแบบ `/gh owner/repository` เพื่ออ่าน metadata ของ repository จริง หลังยืนยัน";
        provider = "github-api";
        usedModel = "bounded";
      } else {
        try {
          const repository = await withErrorEvent(userId, "อ่าน GitHub repository ล้มเหลว", () => getGithubRepository(command.argument));
          reply = `## GitHub repository จริง\n\n- **Repository:** [${repository.fullName}](${repository.htmlUrl})\n- **สถานะ:** ${repository.private ? "Private" : "Public"}\n- **Branch หลัก:** \`${repository.defaultBranch}\`\n- **Issues ที่เปิดอยู่:** ${repository.openIssues}\n- **อัปเดตล่าสุด:** ${repository.updatedAt}\n\nอ่านข้อมูลจาก GitHub API สำเร็จ การแก้ไขไฟล์ยังต้องใช้คำสั่งเขียนที่ระบุไฟล์และขอ confirmation เพิ่ม`;
          provider = "github-api";
          usedModel = "github-rest";
        } catch (error) {
          reply = `อ่าน GitHub ไม่สำเร็จ: ${error instanceof Error ? error.message : "unknown error"}`;
          provider = "github-api";
          usedModel = "bounded";
        }
      }
    } else {
      const history = userId ? await getChatMessages(userId, 24) : [];
      const messages = [
        { role: "system" as const, content: `คุณคือ “สลี่” ผู้ช่วย AI ในห้องเดียวของผู้ใช้ ตอบภาษาไทยเป็นหลัก ใช้ Markdown ได้ รวมความสามารถงานโค้ด การสรุป การแปล และการวิเคราะห์ไว้ในห้องเดียว ห้ามอ้างว่าได้อ่านไฟล์ เรียก GitHub ใช้ปลั๊กอิน ส่งอีเมล หรือทำงานภายนอก หากระบบไม่ได้ยืนยันว่าความสามารถนั้นพร้อมใช้ หากผู้ใช้ขอการเปลี่ยนแปลงสำคัญ ให้บอกสิ่งที่จะทำและขอการยืนยันก่อนเสมอ ถ้าเป็นงานโค้ด ให้เสนอแพตช์หรือขั้นตอนตรวจสอบ แต่ไม่รันโค้ดหรือเขียนไฟล์จริงโดยอัตโนมัติ` },
        ...history.map(message => ({ role: message.role as "user" | "assistant", content: message.content })),
      ];
      const response = await withErrorEvent(userId, "ตอบ LLM ล้มเหลว", () => invokeLLM({ messages, model: modelId === "auto" ? undefined : modelId, maxTokens: 2400 }));
      reply = normalizeContent(response.choices[0]?.message?.content) || "สลี่ไม่ได้รับคำตอบจากโมเดลในครั้งนี้";
      usedModel = response.model || modelId;
    }

    if (!reply) reply = "สลี่ไม่มีข้อความตอบกลับในครั้งนี้";
    if (userId) {
      await addChatMessage({ userId, role: "assistant", content: reply, provider, model: usedModel, status: "complete", createdAtUtc: Date.now() });
    }
    await recordEvent(userId, "response.completed", "ตอบกลับสำเร็จ", "success", `${provider} · ${usedModel}`);
    return { ok: true, room: SINGLE_ROOM_NAME, needsConfirmation: false, reply, provider, model: usedModel, attachmentUrl };
  }),
});

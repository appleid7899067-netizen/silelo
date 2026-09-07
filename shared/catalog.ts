export type CapabilityState = "ready" | "setup" | "unsupported";

export type CatalogItem = {
  id: string;
  label: string;
  description: string;
  state: CapabilityState;
  note: string;
};

export const SINGLE_ROOM_KEY = "silelo" as const;
export const SINGLE_ROOM_NAME = "สลี่" as const;

/** Baseline models exposed by silelo-neo-connect before the Manus migration. */
export const BASELINE_MODELS: CatalogItem[] = [
  { id: "auto", label: "อัตโนมัติ (โซ่เต็ม)", description: "เลือกเส้นทางที่เหมาะสมให้อัตโนมัติ", state: "ready", note: "Manus gateway" },
  { id: "openrouter_fast", label: "OpenRouter · เน้นความเร็ว", description: "โหมดสำรองความหน่วงต่ำจากต้นทาง", state: "setup", note: "ต้องตั้งค่า provider ภายนอก" },
  { id: "openrouter_balanced", label: "OpenRouter · สมดุล/สำรอง", description: "โหมดสำรองแบบสมดุล", state: "setup", note: "ต้องตั้งค่า provider ภายนอก" },
  { id: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash · Max", description: "โมเดลสนทนาและโค้ดจาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro · Max", description: "โมเดล reasoning จาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "qwen/qwen3.5-397b-a17b", label: "Qwen3.5 397B", description: "โมเดลขนาดใหญ่จาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "qwen/qwen3.8-2.4t-a95b", label: "Qwen3.8 2.4T", description: "โมเดลขนาดใหญ่จาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "openai/gpt-oss-120b", label: "GPT-OSS 120B", description: "โมเดลทั่วไปจาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "google/gemini-3.7-flash", label: "Gemini 3.7 Flash", description: "โมเดลเร็วจาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "x-ai/grok-4-1-fast", label: "Grok 4.1 Fast", description: "โมเดลเร็วจาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "moonshotai/kimi-k2.7-code", label: "Kimi K2.7 Code", description: "โมเดลโค้ดจาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "z-ai/glm-5.2", label: "GLM-5.2", description: "โมเดลทั่วไปจาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
  { id: "minimax/minimax-m3", label: "MiniMax M3", description: "โมเดลทั่วไปจาก baseline", state: "setup", note: "ขึ้นกับ catalog ของ Manus" },
];

export const BASELINE_SKILLS: CatalogItem[] = [
  { id: "chat", label: "แชทและความจำ", description: "สนทนาในห้องสลี่เดียว พร้อมบริบทจากประวัติ", state: "ready", note: "Manus LLM + database" },
  { id: "agents", label: "Parallel Agents", description: "คำสั่ง /agents, /parallel และ /squad จาก baseline", state: "setup", note: "ยังไม่ได้เปิด multi-provider ใน Manus" },
  { id: "project", label: "Project Agent", description: "อ่านและวางแผนแก้ไฟล์โปรเจกต์จริง", state: "setup", note: "ต้องเชื่อม GitHub และยืนยันก่อนเขียน" },
  { id: "github", label: "GitHub Tool", description: "ดู repository, branch, file และ diff", state: "setup", note: "ต้องมี connector/สิทธิ์ GitHub จริง" },
  { id: "code-create", label: "สร้างโค้ด", description: "สร้างโค้ดจากคำอธิบาย", state: "ready", note: "ใช้ Manus LLM" },
  { id: "code-convert", label: "แปลงภาษา", description: "แปลงโค้ดระหว่างภาษา", state: "ready", note: "ใช้ Manus LLM; ไม่รันโค้ดอัตโนมัติ" },
  { id: "code-explain", label: "อธิบายโค้ด", description: "อธิบายโค้ดเป็นส่วนๆ", state: "ready", note: "ใช้ Manus LLM" },
  { id: "code-improve", label: "ปรับปรุงโค้ด", description: "เสนอการปรับปรุงประสิทธิภาพและความอ่านง่าย", state: "ready", note: "ใช้ Manus LLM" },
  { id: "code-comment", label: "ใส่คอมเมนต์", description: "เติมคอมเมนต์อธิบายโค้ด", state: "ready", note: "ใช้ Manus LLM" },
  { id: "code-test", label: "สร้าง Unit Test", description: "เสนอชุดทดสอบสำหรับโค้ด", state: "ready", note: "ใช้ Manus LLM; ไม่รันทดสอบแทนผู้ใช้" },
  { id: "code-diagram", label: "สร้าง Diagram", description: "สร้าง Mermaid diagram จากคำอธิบาย", state: "ready", note: "ใช้ Manus LLM" },
  { id: "code-refactor", label: "Refactor", description: "เสนอการจัดโครงสร้างโค้ดใหม่", state: "ready", note: "ใช้ Manus LLM; ต้องตรวจ diff ก่อนบันทึก" },
  { id: "draw", label: "สร้างภาพ", description: "สร้างภาพจาก prompt", state: "ready", note: "Manus Image Service" },
  { id: "vision", label: "วิเคราะห์ภาพ", description: "ส่งภาพให้โมเดลวิเคราะห์", state: "ready", note: "ต้องส่งไฟล์หรือ URL ที่เข้าถึงได้" },
  { id: "voice-input", label: "พูดเป็นข้อความ", description: "รับเสียงจากเบราว์เซอร์และถอดความ", state: "setup", note: "ขึ้นกับสิทธิ์ไมโครโฟนและบริการถอดเสียง" },
  { id: "tts", label: "เสียงตอบกลับ", description: "อ่านคำตอบด้วยเสียง", state: "setup", note: "ยังไม่มี TTS เปิดในเวอร์ชันแรก" },
  { id: "translate", label: "แปลภาษา", description: "แปลข้อความเป็นภาษาที่ต้องการ", state: "ready", note: "ใช้ Manus LLM" },
  { id: "summarize", label: "สรุปข้อความ", description: "สรุปเอกสารหรือข้อความ", state: "ready", note: "ใช้ Manus LLM" },
];

export const BASELINE_COMMANDS: CatalogItem[] = [
  { id: "/help", label: "/help", description: "แสดงคำสั่งหลักและแนวทางใช้ห้องสลี่", state: "ready", note: "คำสั่งภายใน" },
  { id: "/status", label: "/status", description: "แสดงสถานะความสามารถและสิทธิ์ปัจจุบัน", state: "ready", note: "ตรวจจาก runtime" },
  { id: "/models", label: "/models", description: "แสดง Model Catalog และสถานะ", state: "ready", note: "ตรวจจาก Manus catalog" },
  { id: "/skills", label: "/skills", description: "แสดง Skill Catalog และสถานะ", state: "ready", note: "baseline manifest" },
  { id: "/draw", label: "/draw <prompt>", description: "สร้างภาพเมื่อได้รับคำสั่งอย่างชัดเจน", state: "ready", note: "ยืนยันก่อนเรียกใช้ service ที่มีค่าใช้จ่าย/ทรัพยากร" },
  { id: "/translate", label: "/translate <ภาษา> :: <ข้อความ>", description: "แปลข้อความผ่าน AI", state: "ready", note: "ใช้ Manus LLM" },
  { id: "/summarize", label: "/summarize <ข้อความ>", description: "สรุปข้อความผ่าน AI", state: "ready", note: "ใช้ Manus LLM" },
  { id: "/project", label: "/project ...", description: "ดูสถานะหรือวางแผนแก้โปรเจกต์จริง", state: "setup", note: "ต้องยืนยันและเชื่อม GitHub" },
];

export const CAPABILITY_GROUPS = [
  { id: "models", label: "Model Catalog", items: BASELINE_MODELS },
  { id: "skills", label: "Skill Catalog", items: BASELINE_SKILLS },
  { id: "commands", label: "คำสั่งแชท", items: BASELINE_COMMANDS },
] as const;

export const stateLabel: Record<CapabilityState, string> = {
  ready: "พร้อมใช้",
  setup: "ต้องตั้งค่า",
  unsupported: "ยังไม่รองรับ",
};

export const stateTone: Record<CapabilityState, string> = {
  ready: "ready",
  setup: "setup",
  unsupported: "unsupported",
};

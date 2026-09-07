import { useAuth } from "@/_core/hooks/useAuth";
import { startLogin } from "@/const";
import { AIChatBox, type Message } from "@/components/AIChatBox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import { ComposerCapabilities } from "@/components/ComposerCapabilities";
import { ConfirmationActions } from "@/components/ConfirmationActions";
import { ModelSelector } from "@/components/ModelSelector";
import { Check, ChevronDown, CircleAlert, Clock3, Copy, Cpu, Github, Image as ImageIcon, LockKeyhole, LogIn, MessageCircle, ShieldCheck, Sparkles, TerminalSquare, WandSparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const statusMeta = {
  ready: { label: "พร้อมใช้", className: "status-ready", icon: Check },
  setup: { label: "ต้องตั้งค่า", className: "status-setup", icon: CircleAlert },
  unsupported: { label: "ยังไม่รองรับ", className: "status-unsupported", icon: X },
} as const;

type Status = keyof typeof statusMeta;

type LocalMessage = Message & { id: string; provider?: string | null; model?: string | null; status?: string };

function StatusBadge({ state }: { state: Status }) {
  const meta = statusMeta[state];
  const Icon = meta.icon;
  return <span className={cn("status-badge", meta.className)}><Icon size={12} />{meta.label}</span>;
}

function TaskLogs({ events }: { events: any[] }) {
  const statusText: Record<string, string> = { running: "กำลังทำงาน", success: "สำเร็จ", error: "ผิดพลาด", waiting_confirmation: "รอยืนยัน", cancelled: "ยกเลิก" };
  return <Card className={cn("task-log-card", !events.length && "task-log-card-empty")}><CardHeader><div className="task-log-title"><CardTitle>Task log</CardTitle><span>{events.length ? `${events.length} เหตุการณ์จริง` : "ยังไม่มีเหตุการณ์"}</span></div><p>แสดงเฉพาะเหตุการณ์ที่ server บันทึกจากคำขอและผลลัพธ์จริง</p></CardHeader><CardContent>{events.length ? <div className="task-log-list">{events.slice(-8).reverse().map((event: any) => <div className="task-log-item" key={event.id}><div className={cn("task-log-marker", `task-log-${event.status}`)}><Clock3 size={13} /></div><div className="task-log-copy"><strong>{event.label}</strong><span>{statusText[event.status] || event.status} · {new Date(event.createdAtUtc || event.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>{event.detail && <small>{event.detail}</small>}</div></div>)}</div> : <div className="task-log-empty"><Clock3 size={15} />เมื่อส่งข้อความหรือเรียกคำสั่ง จะมี event จริงปรากฏที่นี่</div>}</CardContent></Card>;
}

function CatalogPanel({ catalog }: { catalog: any }) {
  const [open, setOpen] = useState<string | null>("skills");
  const groups = [
    { id: "skills", title: "Skill Catalog", icon: WandSparkles, items: catalog.skills },
    { id: "models", title: "Model Catalog", icon: Cpu, items: catalog.models },
    { id: "commands", title: "คำสั่งแชท", icon: TerminalSquare, items: catalog.commands },
  ];
  return <div className="catalog-list">
    {groups.map(group => {
      const Icon = group.icon;
      const isOpen = open === group.id;
      return <div className="catalog-group" key={group.id}>
        <button className="catalog-group-trigger" onClick={() => setOpen(isOpen ? null : group.id)} aria-expanded={isOpen}>
          <span className="catalog-group-name"><Icon size={15} />{group.title}</span>
          <span className="catalog-count">{group.items.length}<ChevronDown size={14} className={cn(isOpen && "rotate-180")} /></span>
        </button>
        {isOpen && <div className="catalog-items">
          {group.items.slice(0, group.id === "skills" ? 24 : group.items.length).map((item: any) => <div className="catalog-item" key={item.id}>
            <div className="catalog-item-copy"><strong>{item.label}</strong><span>{item.description}</span><small>{item.note}</small></div>
            <StatusBadge state={item.state} />
          </div>)}
          {group.id === "skills" && <div className="catalog-more">แสดง 24 รายการจาก baseline ทั้งหมด {catalog.skillCoverage?.total || group.items.length} รายการ · understand {catalog.skillCoverage?.understand || 0} · execute {catalog.skillCoverage?.execute || 0}</div>}
        </div>}
      </div>;
    })}
  </div>;
}

export default function Home() {
  const auth = useAuth();
  const historyQuery = trpc.chat.history.useQuery({ limit: 80 }, { enabled: auth.isAuthenticated, retry: false });
  const catalogQuery = trpc.chat.catalog.useQuery(undefined, { enabled: auth.isAuthenticated, retry: false });
  const sendMutation = trpc.chat.send.useMutation();
  const [localMessages, setLocalMessages] = useState<LocalMessage[]>([]);
  const [pendingConfirmation, setPendingConfirmation] = useState<string | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [modelId, setModelId] = useState("auto");
  const [activity, setActivity] = useState<"idle" | "thinking" | "tool-running" | "success" | "error" | "cancelled">("idle");

  const messages = useMemo<Message[]>(() => {
    const saved = (historyQuery.data?.messages || []).map(message => ({ role: message.role, content: message.content } as Message));
    return [...saved, ...localMessages];
  }, [historyQuery.data?.messages, localMessages]);

  const handleSend = async (content: string, confirm = false) => {
    if (!auth.isAuthenticated) {
      toast.error("กรุณาเข้าสู่ระบบก่อนเริ่มสนทนา");
      return;
    }
    const localId = `${Date.now()}-${Math.random()}`;
    setActivity(content.trim().startsWith("/") ? "tool-running" : "thinking");
    if (!confirm) setLocalMessages(previous => [...previous, { id: localId, role: "user", content }]);
    try {
      const result = await sendMutation.mutateAsync({ content, modelId, confirm });
      if (result.needsConfirmation) {
        setPendingConfirmation(result.confirmation || "กรุณายืนยันการดำเนินการ");
        setActivity("tool-running");
        return;
      }
      setPendingConfirmation(null);
      if (!result.ok) {
        toast.error(result.error || "ยังดำเนินการไม่ได้");
        setActivity("error");
        return;
      }
      if (result.reply) setLocalMessages(previous => [...previous, { id: `${localId}-reply`, role: "assistant", content: result.reply || "", provider: result.provider, model: result.model }]);
      setActivity("success");
    } catch (error: any) {
      toast.error(error?.message || "เชื่อมต่อบริการไม่ได้");
      setActivity("error");
    }
  };

  if (auth.loading) return <div className="app-loading"><Sparkles className="pulse" size={22} /><span>กำลังเปิดห้องสลี่…</span></div>;

  if (!auth.isAuthenticated) return <main className="login-screen">
    <div className="login-grid" />
    <Card className="login-card">
      <div className="brand-mark"><Sparkles size={26} /></div>
      <p className="eyebrow">SILELO / NEO-CONNECT</p>
      <h1>ห้องแชทของสลี่</h1>
      <p className="login-copy">ห้องเดียวสำหรับการสนทนา งานโค้ด สรุป แปล และเครื่องมือที่ได้รับอนุญาต ระบบจะแสดงสถานะและสิทธิ์ตามจริงก่อนดำเนินการ</p>
      <Button className="login-button" onClick={() => startLogin()}><LogIn size={17} />เข้าสู่ระบบ Manus</Button>
      <div className="login-note"><LockKeyhole size={14} />ประวัติการสนทนาแยกตามบัญชีของคุณ</div>
    </Card>
  </main>;

  const displayName = auth.user?.name || auth.user?.email || "ผู้ใช้";
  const catalog = catalogQuery.data;
  const runtime = catalog?.runtime;
  const activeModel = catalog?.models.find((item: any) => item.id === modelId);

  return <main className="silelo-app">
    <div className="ambient ambient-one" /><div className="ambient ambient-two" />
    <header className="app-header">
      <div className="brand-lockup"><div className="brand-icon"><Sparkles size={17} /></div><div><div className="brand-name">SILELO</div><div className="brand-sub">NEO / SINGLE ROOM</div></div></div>
      <div className="room-pill"><span className="room-live" />ห้องเดียว · <strong>สลี่</strong></div>
      <div className="header-actions"><span className="user-chip">{displayName}</span><Button variant="ghost" size="sm" onClick={() => auth.logout()} className="logout-button">ออกจากระบบ</Button></div>
    </header>

    <section className="app-layout">
      <aside className="context-rail">
        <div className="rail-section">
          <p className="rail-label">ACTIVE ROOM</p>
          <div className="active-room"><div className="avatar-sli">ส</div><div><strong>สลี่</strong><span>ห้องหลักของคุณ</span></div><span className="active-dot" /></div>
        </div>
        <Separator />
        <div className="rail-section rail-status">
          <p className="rail-label">RUNTIME STATUS</p>
          <div className="rail-status-row"><MessageCircle size={15} /><span>Manus LLM</span><StatusBadge state={(runtime?.llm || "setup") as Status} /></div>
          <div className="rail-status-row"><ImageIcon size={15} /><span>สร้างภาพ</span><StatusBadge state="ready" /></div>
          <div className="rail-status-row"><Github size={15} /><span>GitHub อ่าน</span><StatusBadge state={runtime?.githubRead ? "ready" : "setup"} /></div>
          <div className="rail-status-row"><Github size={15} /><span>GitHub เขียน</span><StatusBadge state={runtime?.githubWrite ? "ready" : "setup"} /></div>
          <div className="github-allowlist"><span>REPOSITORY ALLOWLIST</span>{runtime?.githubRepositories?.map((repo: string) => <code key={repo}>{repo}</code>) || <code>กำลังตรวจสอบ…</code>}</div>
          <div className="rail-status-row"><WandSparkles size={15} /><span>ปลั๊กอิน</span><StatusBadge state="unsupported" /></div>
          <div className="rail-status-row"><TerminalSquare size={15} /><span>บริการภายนอก</span><StatusBadge state="setup" /></div>
          <div className="rail-status-row"><ShieldCheck size={15} /><span>สิทธิ์</span><span className="permission-text">OAuth จริง</span></div>
        </div>
        <Separator />
        <div className="rail-footnote"><LockKeyhole size={14} /><span>สลี่จะไม่อ้างว่าเชื่อมต่อบริการภายนอกหรือแก้ไฟล์จริงจนกว่าจะมีสิทธิ์และการยืนยัน</span></div>
      </aside>

      <section className="chat-column">
        <div className="chat-heading"><div><p className="eyebrow">PRIVATE AI WORKSPACE</p><h1>สวัสดีครับ, {displayName.split(" ")[0]}</h1><p>สลี่อยู่ตรงนี้แล้ว — ห้องเดียวที่รวมความสามารถเดิมไว้อย่างโปร่งใส</p></div><Button variant="outline" className="catalog-toggle" onClick={() => setShowCatalog(value => !value)}><WandSparkles size={16} />{showCatalog ? "ซ่อน Catalog" : "ดู Catalog"}</Button></div>
        <TaskLogs events={historyQuery.data?.events || []} />
        {showCatalog && catalog && <Card className="catalog-card"><CardHeader><CardTitle>ความสามารถที่ตรวจพบใน runtime</CardTitle><p>รายการนี้เป็น baseline จากแอปต้นทาง และแสดงสถานะจริงของ Manus ตอนนี้</p></CardHeader><CardContent><CatalogPanel catalog={catalog} /></CardContent></Card>}
        <div className={cn("activity-status", `activity-${activity}`)}><span className="activity-dot" />{activity === "idle" ? "พร้อมรับคำสั่ง" : activity === "thinking" ? "กำลังคิด" : activity === "tool-running" ? "กำลังตรวจสอบความสามารถ / รอการยืนยัน" : activity === "success" ? "สำเร็จ" : activity === "error" ? "เกิดข้อผิดพลาด" : "ยกเลิก"}</div>
        {pendingConfirmation && <ConfirmationActions message={pendingConfirmation} onConfirm={() => { const text = messages[messages.length - 1]?.content; if (text) handleSend(text, true); }} onCancel={() => { setPendingConfirmation(null); setActivity("cancelled"); }} />}
        <div className="chat-stage">
          <AIChatBox
            messages={messages}
              onSendMessage={content => handleSend(content)}
            isLoading={sendMutation.isPending}
            placeholder="พิมพ์ข้อความถึงสลี่…"
            emptyStateMessage="เริ่มบทสนทนากับสลี่"
            suggestedPrompts={["ช่วยสรุปข้อความนี้ให้หน่อย", "อธิบายโค้ดนี้อย่างเป็นขั้นตอน", "/status"]}
            className="silelo-chatbox"
            height="min(68vh, 680px)"
          />
        </div>
        <div className="composer-meta"><ModelSelector models={catalog?.models || [{ id: "auto", label: "อัตโนมัติ", state: "ready" }]} value={modelId} onChange={setModelId} /><ComposerCapabilities runtime={runtime} /><span className="composer-hint">Enter ส่ง · Shift+Enter ขึ้นบรรทัดใหม่</span></div>
      </section>
    </section>
    <footer className="app-footer"><span>สถานะและสิทธิ์แสดงตาม runtime จริง</span><span>ข้อมูลห้อง “สลี่” แยกตามบัญชี Manus</span></footer>
  </main>;
}

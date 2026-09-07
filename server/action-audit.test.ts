import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const home = readFileSync(resolve(root, "client/src/pages/Home.tsx"), "utf8");
const chat = readFileSync(resolve(root, "server/chat.ts"), "utf8");
const chatBox = readFileSync(resolve(root, "client/src/components/AIChatBox.tsx"), "utf8");
const modelSelector = readFileSync(resolve(root, "client/src/components/ModelSelector.tsx"), "utf8");
const audit = readFileSync(resolve(root, "docs/feature-audit.md"), "utf8");

describe("visible action audit", () => {
  it("binds visible Home actions to handlers or explicit capability status", () => {
    expect(home).toContain("startLogin()");
    expect(home).toContain("setShowCatalog");
    expect(home).toContain("auth.logout()");
    expect(home).toContain("handleSend");
    expect(home).toContain("pendingConfirmation");
    expect(home).toContain("<ComposerCapabilities runtime={runtime} />");
    expect(home).toContain("ยืนยัน");
    expect(home).toContain("setPendingConfirmation(null)");
    expect(home).toContain("<ModelSelector");
    expect(modelSelector).toContain("aria-label=\"เลือกโมเดล\"");
    expect(modelSelector).toContain("onChange(event.target.value)");
  });

  it("covers the real AIChatBox interactions", () => {
    expect(chatBox).toContain("onSendMessage(trimmedInput)");
    expect(chatBox).toContain("onSendMessage(prompt)");
    expect(chatBox).toContain("disabled={isLoading}");
    expect(chatBox).toContain("handleSubmit(e)");
    expect(chatBox).toContain("e.shiftKey");
    expect(chatBox).toContain("e.key === \"Enter\"");
  });

  it("covers every advertised chat command in the server router", () => {
    for (const command of ["help", "status", "models", "skills", "draw", "translate", "summarize", "plugin", "external", "save", "project", "gh"]) {
      expect(chat).toContain(`command === "${command}"`);
    }
  });

  it("documents unsupported or setup-only actions instead of implying they work", () => {
    expect(audit).toContain("แนบไฟล์");
    expect(audit).toContain("เสียง/TTS");
    expect(audit).toContain("Plugins");
    expect(audit).toContain("หยุดงาน");
    expect(audit).toContain("GitHub read/write");
  });
});

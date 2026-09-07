import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ComposerCapabilities } from "../client/src/components/ComposerCapabilities";
import { composerCapabilityLabels } from "../shared/composer";

describe("composer capability policy", () => {
  it("does not claim unavailable file or voice actions are ready", () => {
    const labels = composerCapabilityLabels(undefined);
    expect(labels.file).toContain("ไม่เปิดใช้");
    expect(labels.voice).toContain("ต้องตั้งค่า");
    expect(labels.githubRead).toContain("ต้องตั้งค่า");
    expect(labels.githubWrite).toContain("ต้องตั้งค่า");
  });

  it("reflects verified GitHub runtime permissions", () => {
    const labels = composerCapabilityLabels({ githubRead: true, githubWrite: false });
    expect(labels.githubRead).toContain("พร้อมใช้");
    expect(labels.githubWrite).toContain("ต้องตั้งค่า");
  });

  it.each([
    ["no-runtime", undefined, "GitHub อ่าน: ต้องตั้งค่า", "GitHub เขียน: ต้องตั้งค่า"],
    ["read-only", { githubRead: true, githubWrite: false }, "GitHub อ่าน: พร้อมใช้", "GitHub เขียน: ต้องตั้งค่า"],
    ["read-write", { githubRead: true, githubWrite: true }, "GitHub อ่าน: พร้อมใช้", "GitHub เขียน: พร้อมใช้หลังยืนยัน"],
  ])("renders real composer labels for %s", (_name, runtime, readLabel, writeLabel) => {
    const html = renderToStaticMarkup(<ComposerCapabilities runtime={runtime} />);
    expect(html).toContain("แนบไฟล์: ไม่เปิดใช้");
    expect(html).toContain("เสียง: ต้องตั้งค่า");
    expect(html).toContain(readLabel);
    expect(html).toContain(writeLabel);
  });
});

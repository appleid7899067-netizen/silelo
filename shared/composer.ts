export type ComposerRuntime = { githubRead?: boolean; githubWrite?: boolean } | undefined;

export function composerCapabilityLabels(runtime: ComposerRuntime) {
  return {
    file: "แนบไฟล์: ไม่เปิดใช้",
    voice: "เสียง: ต้องตั้งค่า",
    githubRead: runtime?.githubRead ? "GitHub อ่าน: พร้อมใช้" : "GitHub อ่าน: ต้องตั้งค่า",
    githubWrite: runtime?.githubWrite ? "GitHub เขียน: พร้อมใช้หลังยืนยัน" : "GitHub เขียน: ต้องตั้งค่า",
  };
}

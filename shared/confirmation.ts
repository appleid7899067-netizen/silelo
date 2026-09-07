export type CriticalAction =
  | "generate-image"
  | "github-read"
  | "github-write"
  | "plugin"
  | "external-service"
  | "save-work";

export type ConfirmationRequirement = {
  required: true;
  action: CriticalAction;
  title: string;
  reason: string;
};

const descriptions: Record<CriticalAction, Omit<ConfirmationRequirement, "action">> = {
  "generate-image": { required: true, title: "ยืนยันการสร้างภาพ", reason: "การสร้างภาพจะเรียกใช้ Manus Image Service" },
  "github-read": { required: true, title: "ยืนยันการอ่าน GitHub", reason: "จะส่งคำขอไปยัง repository ภายนอก" },
  "github-write": { required: true, title: "ยืนยันการเขียน GitHub", reason: "จะเปลี่ยนไฟล์จริงและสร้าง commit" },
  plugin: { required: true, title: "ยืนยันการใช้ปลั๊กอิน", reason: "ปลั๊กอินอาจเข้าถึงบริการหรือข้อมูลภายนอก" },
  "external-service": { required: true, title: "ยืนยันการเรียกบริการภายนอก", reason: "จะส่งข้อมูลออกนอก Manus ไปยังบริการที่ได้รับอนุญาต" },
  "save-work": { required: true, title: "ยืนยันการบันทึกงาน", reason: "จะบันทึกผลลัพธ์เป็นข้อมูลถาวร" },
};

export function confirmationFor(action: CriticalAction): ConfirmationRequirement {
  return { action, ...descriptions[action] };
}

export function requiresConfirmation(action: CriticalAction, confirmed: boolean): boolean {
  return confirmationFor(action).required && !confirmed;
}

# SILELO “สลี่” feature audit

เอกสารนี้เป็นสถานะตาม implementation ที่ตรวจได้ใน Manus ณ เวอร์ชันนี้ ไม่ใช่คำสัญญาว่าบริการภายนอกพร้อมใช้ การทดสอบ UI ใช้ server-side React rendering สำหรับคอมโพเนนต์ย่อยและใช้ action audit ตรวจ handler bindings; ยังไม่ใช่ end-to-end browser interaction test

| ความสามารถ | สถานะ | หลักฐานการทำงาน | ขอบเขต |
|---|---|---|---|
| ห้องแชทสลี่ | พร้อมใช้ | `chat.send` และ `chat.history` ผ่าน tRPC | server บังคับ room key `silelo` เดียว |
| Manus OAuth | พร้อมใช้ | template auth และ `protectedProcedure` | ต้องเข้าสู่ระบบก่อนอ่าน/เขียนข้อมูล |
| Manus LLM | พร้อมใช้เมื่อ runtime มีโมเดล | `invokeLLM` และ runtime model catalog | ไม่มี fallback ปลอม; error ถูกส่งเข้า task log |
| ประวัติแชท | พร้อมใช้ | ตาราง `chat_messages` + userId + UTC Unix ms | แยกตามบัญชี Manus |
| Task Logs | พร้อมใช้ | ตาราง `chat_events`, `addChatEvent`, history events | บันทึกเฉพาะ server events ที่เกิดขึ้นจริง |
| สร้างภาพ | พร้อมใช้เมื่อ Manus Image Service ตอบสำเร็จ | `generateImage` หลัง confirmation | ต้องยืนยันก่อนทุกครั้ง; error ไม่ถูกแปลงเป็น success |
| แปล/สรุป | พร้อมใช้เมื่อ LLM ตอบสำเร็จ | คำสั่ง `/translate` และ `/summarize` เรียก `invokeLLM` | หาก LLM ล้มเหลวจะขึ้น error event |
| GitHub read/write | พร้อมใช้ตาม token/สิทธิ์ | `server/github.ts` เรียก GitHub REST API; `/gh` อ่าน metadata และ `/project` อัปเดตไฟล์ | ต้องระบุ repository/path และยืนยันก่อนเขียน; token ควรจำกัดเฉพาะ repo |
| Plugins | ยังไม่รองรับ | ไม่มี plugin runtime หรือ connector ในแอป | `/plugin` ถูกบล็อกและรายงานข้อจำกัด |
| External services | ต้องตั้งค่า | ไม่มี endpoint ภายนอกอื่นที่เปิดใช้งาน | `/external` ถูกบล็อกและไม่ส่งข้อมูลออก |
| Save work | พร้อมใช้เฉพาะการบันทึกประวัติแชท | `/save` บันทึกผ่าน `chat_messages` หลัง confirmation | ไม่สร้าง commit/file ภายนอก |
| แนบไฟล์ | ไม่เปิดใช้ | `AIChatBox` ไม่มี file input และ server ไม่มี upload route | แสดง “แนบไฟล์: ไม่เปิดใช้” ใน composer |
| เสียง/TTS | ต้องตั้งค่า | ไม่มี TTS call ใน server | แสดง “เสียง: ต้องตั้งค่า” ไม่แสดงปุ่มปลอม |
| หยุดงาน | ไม่เปิดใช้ | ไม่มี AbortSignal/cancellation contract ใน tRPC | ไม่สร้างปุ่ม stop ที่อ้างว่ายกเลิกงานภายนอกได้ |

## Audit rule

ทุก action ที่แก้ข้อมูลถาวรหรือแตะบริการภายนอกต้องมี server policy, สถานะที่ผู้ใช้เห็นได้ และ confirmation ก่อนดำเนินการ หากยังไม่มี integration จริง แอปจะไม่เรียกบริการนั้นและจะตอบสถานะตามจริงแทน ส่วนการตรวจ interaction ในชุดทดสอบปัจจุบันครอบคลุมการ render ของคอมโพเนนต์หลักและการตรวจ contract ของ handler; การคลิกจริงในเบราว์เซอร์ยังควรทดสอบเพิ่มเติมก่อน production rollout

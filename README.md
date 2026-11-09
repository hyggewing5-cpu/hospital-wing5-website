# เว็บไซต์โรงพยาบาลกองบิน 5

หน้าเว็บ (โฮสต์บน GitHub Pages) + ฐานข้อมูล/ระบบหลังบ้านบน Google Apps Script, Google Sheets และ Google Drive

```
.
├── index.html            หน้าเว็บทั้งหมด (ไฟล์เดียว)
├── config.js             ใส่ลิงก์ API (Web app URL) ที่นี่
├── .nojekyll             ให้ GitHub Pages เสิร์ฟไฟล์ตามจริง
└── apps-script/
    ├── Code.gs           โค้ดฝั่งหลังบ้าน (วางใน Apps Script)
    └── appsscript.json   การตั้งค่าโปรเจกต์ Apps Script (ใช้กับ clasp ได้)
```

## 1) ตั้งค่าหลังบ้าน (Google)
1. สร้าง Google Sheets ว่าง 1 ไฟล์ และโฟลเดอร์ใน Google Drive 1 โฟลเดอร์
2. เปิด Sheets > ส่วนขยาย > Apps Script แล้ววางโค้ดจาก `apps-script/Code.gs`
3. Project Settings > Script properties > เพิ่ม 3 ค่า
   - `SHEET_ID` = ID ของ Sheets (ส่วนระหว่าง `/d/` กับ `/edit` ในลิงก์)
   - `FOLDER_ID` = ID ของโฟลเดอร์ (ส่วนท้ายลิงก์โฟลเดอร์)
   - `ADMIN_PASSWORD` = รหัสผู้ดูแลระบบ (ควรยาวและเดายาก)
4. เลือกฟังก์ชัน `setupSystem` กด Run หนึ่งครั้ง แล้วอนุญาตสิทธิ์
5. Deploy > New deployment > ประเภท Web app
   - Execute as: **Me**
   - Who has access: **Anyone**
   - คัดลอกลิงก์ที่ลงท้าย `/exec`

> ทุกครั้งที่แก้ `Code.gs` ต้อง Deploy > Manage deployments > แก้ไข > Version: New version

## 2) ตั้งค่าหน้าเว็บ
แก้ `config.js` ใส่ลิงก์ `/exec` ที่ได้ในข้อ 1.5

## 3) ขึ้น GitHub Pages
1. สร้างรีโปบน GitHub (ฟรีต้องเป็น Public) แล้วอัปโหลดไฟล์ทั้งหมดในโฟลเดอร์นี้
2. Settings > Pages > Source: **Deploy from a branch** > Branch: `main` / `(root)` > Save
3. รอ 1-2 นาที เว็บจะอยู่ที่ `https://<ชื่อบัญชี>.github.io/<ชื่อรีโป>/`

## 4) เริ่มใช้งาน
เปิดเว็บ > ไอคอนกุญแจมุมขวาบน > ใส่ `ADMIN_PASSWORD` > ตั้งค่าระบบ กรอกชื่อโรงพยาบาล โลโก้ ข้อมูลติดต่อ

## ความปลอดภัย
- รีโปเป็น Public: **ห้ามใส่รหัสผ่าน, SHEET_ID, FOLDER_ID ในไฟล์** ใช้ Script properties เท่านั้น
- ห้ามนำข้อมูลผู้ป่วยหรือข้อมูลส่วนบุคคลมาใส่ในระบบนี้ ไฟล์ที่อัปโหลดตั้งเป็น "ทุกคนที่มีลิงก์ดูได้"
- กรอกรหัสผู้ดูแลผิดเกิน 10 ครั้งใน 10 นาที ระบบจะปฏิเสธชั่วคราว
- ผู้ดูแลต้องมั่นใจว่าเปิดเว็บผ่าน https เท่านั้น (GitHub Pages เป็น https อยู่แล้ว)

## ปัญหาที่พบบ่อย
| อาการ | วิธีแก้ |
|---|---|
| "ยังไม่ได้ตั้งค่า API_URL" | ใส่ลิงก์ใน `config.js` |
| โหลดข้อมูลไม่สำเร็จ / ติด CORS | Web app ต้องตั้ง Who has access = **Anyone** และใช้ลิงก์ `/exec` ไม่ใช่ `/dev` |
| แก้โค้ดแล้วไม่เปลี่ยน | Deploy เป็น New version |
| "ยังไม่ได้ตั้งค่า SHEET_ID" | เพิ่มใน Script properties |

/**
* เว็บไซต์โรงพยาบาลกองบิน 5 - Backend (Google Apps Script)
*
* ค่าที่เป็นความลับ "ไม่เขียนในไฟล์นี้" (เพราะไฟล์นี้อยู่บน GitHub สาธารณะ)
* ตั้งที่ Apps Script > Project Settings > Script properties:
*   SHEET_ID        = ID ของ Google Sheets (ส่วนระหว่าง /d/ และ /edit ในลิงก์ชีต)
*   FOLDER_ID       = ID โฟลเดอร์ Google Drive ที่เก็บไฟล์อัปโหลด
*   ADMIN_PASSWORD  = รหัสผู้ดูแลระบบ (เปลี่ยนภายหลังได้ที่หน้าตั้งค่าของเว็บ)
* จากนั้นรันฟังก์ชัน setupSystem หนึ่งครั้งเพื่ออนุญาตสิทธิ์ แล้ว Deploy เป็น Web app
*/


function prop_(k) {
 return PropertiesService.getScriptProperties().getProperty(k) || '';
}


const MAX_FILE_BYTES = 8 * 1024 * 1024;


const SCHEMAS = {
 Settings: ['Key', 'Value'],
 // Dept = กลุ่มงาน, Group = แผนก/หน่วยงาน, Role = head | deputy | member
 // Division = สายงาน (เช่น สายแพทย์ / สายพยาบาล) สำหรับเจ้าหน้าที่ประจำจุดบริการ, Homeroom = จุดบริการที่ประจำ (เช่น หอผู้ป่วยใน 1)
 Staff: ['ID', 'Dept', 'Name', 'Position', 'PhotoURL', 'SortOrder', 'Group', 'Role', 'Phone', 'Division', 'Homeroom'],
 Students: ['ID', 'Year', 'Level', 'Class', 'Male', 'Female'],
 Campus: ['ID', 'Name', 'PhotoURL'],
 Banners: ['ID', 'Title', 'PhotoURL'],
 // เว็บไซต์ที่เกี่ยวข้อง (แสดงที่คอลัมน์ขวาของหน้าหลัก)
 Links: ['ID', 'Name', 'URL', 'LogoURL', 'SortOrder'],
 // ผลงานและรางวัล (แสดงที่หน้าหลัก ใต้ข่าวสาร & ประกาศ)
 Awards: ['ID', 'Title', 'Year', 'Detail', 'PhotoURL', 'SortOrder'],
 // ข่าวประชาสัมพันธ์ (แสดงที่หน้าหลัก ใต้ผลงานและรางวัล)
 PR: ['ID', 'Title', 'Date', 'Detail', 'PhotoURL', 'SortOrder'],
 // เอกสาร ระเบียบ แบบฟอร์ม และดาวน์โหลด (Dept = กลุ่มงาน, FileID = ไฟล์ใน Google Drive, Link = ลิงก์ไฟล์งานภายนอก)
 Docs: ['ID', 'Code', 'Title', 'Dept', 'Date', 'FileID', 'FileName', 'Link'],
 // ทำเนียบผู้บังคับบัญชา (แสดงในหน้าข้อมูลโรงพยาบาล) Term = ช่วงดำรงตำแหน่ง เช่น 2565 – ปัจจุบัน
 Commanders: ['ID', 'Name', 'Position', 'Term', 'PhotoURL', 'SortOrder'],
 Records: ['ID', 'Title', 'StartDate', 'EndDate', 'AcademicYear', 'Location', 'Type', 'Category',
   'Detail', 'Result', 'Images', 'Docs', 'CreatedAt', 'UpdatedAt']
};


const ITEM_TYPES = {
 staff: 'Staff',
 student: 'Students',
 campus: 'Campus',
 banner: 'Banners',
 link: 'Links',
 award: 'Awards',
 pr: 'PR',
 doc: 'Docs',
 cmd: 'Commanders'
};


const DEFAULT_SETTINGS = {
 systemName: 'เว็บไซต์โรงพยาบาลกองบิน 5',
 orgName: 'โรงพยาบาลกองบิน 5',
 affiliation: 'กองบิน 5 กองทัพอากาศ',
 address: '',
 academicYear: '2570',
 logoUrl: '',
 primaryColor: '#2f8cff',
 sidebarColor: '#eef6ff',
 bgColor: '#e3f1ff',
 buttonColor: '#2f8cff',
 reportHeader: 'รายงานข้อมูลโรงพยาบาล',
 reportFooter: '',
 welcomeText: 'ยินดีต้อนรับ',
 heroBgUrl: '',
 execName: '',
 execPosition: 'ผู้อำนวยการโรงพยาบาล',
 execPhotoUrl: '',
 history: '',
 motto: '',
 schoolColors: '',
 schoolColor1: '',
 schoolColor2: '',
 identity: '',
 vision: '',
 mission: '',
 goals: '',
 policy: '',
 // หมวดหมู่ข้อมูลโรงพยาบาลที่ผู้ดูแลเพิ่มเอง (เก็บเป็น JSON: [{id,title,text}])
 customSections: '',
 // รายการที่ผู้ดูแลปรับแต่งเอง (เก็บเป็น JSON array ของข้อความ; ว่าง = ใช้ค่าเริ่มต้นของระบบ)
 deptList: '',     // กลุ่มงาน (บุคลากร)
 groupList: '',    // แผนก/หน่วยงาน
 divList: '',      // สายงาน (เจ้าหน้าที่ประจำจุดบริการ เช่น สายแพทย์ / สายพยาบาล)
 docDeptList: '',  // กลุ่มงาน (เอกสารดาวน์โหลด)
 // นโยบายเจ้ากรมแพทย์ทหารอากาศ
 dmdName: '',
 dmdPosition: '',
 dmdPhotoUrl: '',
 dmdPolicy: '',
 dmdLink: '',
 phone: '',
 emergencyPhone: '',
 openHours: '',
 email: '',
 lineId: '',
 facebookUrl: '',
 mapLat: '',
 mapLng: ''
};


// ===== Web App =====
// ฟังก์ชันที่หน้าเว็บ (GitHub Pages) เรียกได้ — อนุญาตเฉพาะรายการนี้เท่านั้น
const API_FUNCS = {
 getBootstrap: getBootstrap,
 verifyAdminPassword: verifyAdminPassword,
 changeAdminPassword: changeAdminPassword,
 saveSettings: saveSettings,
 saveItem: saveItem,
 deleteItem: deleteItem,
 uploadImage: uploadImage,
 uploadDoc: uploadDoc,
 saveRecord: saveRecord,
 deleteRecord: deleteRecord
};


function json_(o) {
 return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}


function doGet() {
 // ถ้ามีไฟล์ HTML ชื่อ "index" ในโปรเจกต์ ก็เสิร์ฟหน้าเว็บได้เหมือนเดิม; ถ้าไม่มี ให้ตอบสถานะ API
 try {
   return HtmlService.createTemplateFromFile('index')
     .evaluate()
     .setTitle('เว็บไซต์โรงพยาบาลกองบิน 5')
     .addMetaTag('viewport', 'width=device-width, initial-scale=1')
     .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
 } catch (e) {
   return json_({ ok: true, service: 'hospital-wing5-api', msg: 'API พร้อมใช้งาน (เรียกด้วย POST)' });
 }
}


function doPost(e) {
 try {
   const req = JSON.parse((e && e.postData && e.postData.contents) || '{}');
   const fn = Object.prototype.hasOwnProperty.call(API_FUNCS, req.fn) ? API_FUNCS[req.fn] : null;
   if (!fn) return json_({ error: 'ไม่รู้จักคำสั่งที่เรียก' });
   return json_({ result: fn.apply(null, Array.isArray(req.args) ? req.args : []) });
 } catch (err) {
   return json_({ error: String((err && err.message) || err) });
 }
}


// ===== ติดตั้งระบบ (รันครั้งแรก) =====
function setupSystem() {
 if (!prop_('ADMIN_PASSWORD')) throw new Error('กรุณาตั้ง ADMIN_PASSWORD ใน Script properties ก่อน');
 ensureSheets_();
 seedSettings_();
 getFolder_();
 return 'ตั้งค่าระบบเรียบร้อย';
}


// ===== Spreadsheet helpers =====
var _ssCache = null;


function getSS_() {
 if (_ssCache) return _ssCache;
 const id = prop_('SHEET_ID');
 if (!id) throw new Error('ยังไม่ได้ตั้งค่า SHEET_ID ใน Script properties');
 try {
   _ssCache = SpreadsheetApp.openById(id);
 } catch (e) {
   throw new Error('เปิด Google Sheets ไม่ได้ กรุณาตรวจสอบค่า SHEET_ID และสิทธิ์การเข้าถึง');
 }
 return _ssCache;
}


function getFolder_() {
 const id = prop_('FOLDER_ID');
 if (!id) throw new Error('ยังไม่ได้ตั้งค่า FOLDER_ID ใน Script properties');
 return DriveApp.getFolderById(id);
}


function ensureSheets_() {
 const ss = getSS_();
 const notes = [];
 Object.keys(SCHEMAS).forEach(function (name) {
   const cols = SCHEMAS[name];
   let sh = ss.getSheetByName(name);
   if (!sh) {
     sh = ss.insertSheet(name);
     sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
     sh.setFrozenRows(1);
     return;
   }
   if (sh.getLastRow() === 0 || sh.getLastColumn() === 0) {
     sh.getRange(1, 1, 1, cols.length).setValues([cols]).setFontWeight('bold');
     sh.setFrozenRows(1);
     return;
   }
   const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
   const missing = cols.filter(function (c) { return head.indexOf(c) < 0; });
   if (missing.length) {
     sh.getRange(1, head.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold');
     notes.push('ชีต ' + name + ' เพิ่มคอลัมน์ที่ขาด: ' + missing.join(', '));
   }
 });
 return notes;
}


function seedSettings_() {
 const sh = getSS_().getSheetByName('Settings');
 const existing = {};
 readRows_('Settings').forEach(function (r) { existing[r.Key] = true; });
 Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
   if (!existing[k]) sh.appendRow([k, DEFAULT_SETTINGS[k]]);
 });
}


function readRows_(name) {
 const sh = getSS_().getSheetByName(name);
 if (!sh || sh.getLastRow() < 2) return [];
 const tz = Session.getScriptTimeZone();
 const values = sh.getDataRange().getValues();
 const head = values[0].map(String);
 return values.slice(1)
   .filter(function (r) { return r.join('') !== ''; })
   .map(function (r) {
     const o = {};
     head.forEach(function (k, i) {
       let v = r[i];
       if (v instanceof Date) v = Utilities.formatDate(v, tz, 'yyyy-MM-dd');
       o[k] = v;
     });
     return o;
   });
}


function upsertRow_(name, obj) {
 const sh = getSS_().getSheetByName(name);
 const lastCol = sh.getLastColumn();
 const head = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
 const idCol = head.indexOf('ID');
 let row = -1;
 if (sh.getLastRow() > 1) {
   const ids = sh.getRange(2, idCol + 1, sh.getLastRow() - 1, 1).getValues();
   for (let i = 0; i < ids.length; i++) {
     if (String(ids[i][0]) === String(obj.ID)) { row = i + 2; break; }
   }
 }
 if (row < 0) {
   sh.appendRow(head.map(function (k) { return obj[k] === undefined ? '' : obj[k]; }));
   return 'created';
 }
 const cur = sh.getRange(row, 1, 1, lastCol).getValues()[0];
 const next = head.map(function (k, i) { return obj[k] === undefined ? cur[i] : obj[k]; });
 sh.getRange(row, 1, 1, lastCol).setValues([next]);
 return 'updated';
}


function deleteRow_(name, id) {
 const sh = getSS_().getSheetByName(name);
 if (!sh || sh.getLastRow() < 2) return false;
 const head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
 const idCol = head.indexOf('ID') + 1;
 const ids = sh.getRange(2, idCol, sh.getLastRow() - 1, 1).getValues();
 for (let i = ids.length - 1; i >= 0; i--) {
   if (String(ids[i][0]) === String(id)) { sh.deleteRow(i + 2); return true; }
 }
 return false;
}


function getSettings_() {
 const out = {};
 Object.keys(DEFAULT_SETTINGS).forEach(function (k) { out[k] = DEFAULT_SETTINGS[k]; });
 readRows_('Settings').forEach(function (r) {
   if (r.Key && Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, r.Key)) out[r.Key] = String(r.Value);
 });
 return out;
}


function newId_(prefix) {
 return prefix + Date.now().toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase();
}


// ===== รหัสผู้ดูแลระบบ =====
function getAdminPassword_() {
 return prop_('ADMIN_PASSWORD');
}


// กันเดารหัส: ผิดเกิน 10 ครั้งใน 10 นาที จะปฏิเสธชั่วคราว
function isAdmin_(password) {
 const pw = getAdminPassword_();
 if (!pw || typeof password !== 'string') return false;
 const cache = CacheService.getScriptCache();
 const fails = Number(cache.get('adminFails') || 0);
 if (fails >= 10) return false;
 if (password === pw) return true;
 cache.put('adminFails', String(fails + 1), 600);
 return false;
}


function denied_() {
 return { ok: false, msg: 'รหัสผู้ดูแลระบบไม่ถูกต้อง (หรือถูกล็อกชั่วคราวหลังกรอกผิดหลายครั้ง ลองใหม่ใน 10 นาที)' };
}


// ===== API: โหลดข้อมูลทั้งหมด =====
function getBootstrap() {
 const notes = ensureSheets_();
 seedSettings_();
 return {
   notes: notes,
   settings: getSettings_(),
   staff: readRows_('Staff'),
   students: readRows_('Students'),
   campus: readRows_('Campus'),
   banners: readRows_('Banners'),
   links: readRows_('Links'),
   awards: readRows_('Awards'),
   pr: readRows_('PR'),
   docs: readRows_('Docs'),
   records: readRows_('Records'),
   commanders: readRows_('Commanders')
 };
}


// ===== API: ผู้ดูแลระบบ =====
function verifyAdminPassword(password) {
 return isAdmin_(password);
}


// เปลี่ยนรหัสผู้ดูแลระบบ (ต้องใส่รหัสเดิมให้ถูกต้อง)
function changeAdminPassword(oldPassword, newPassword) {
 if (!isAdmin_(oldPassword)) return { ok: false, msg: 'รหัสผ่านเดิมไม่ถูกต้อง' };
 const np = String(newPassword == null ? '' : newPassword);
 if (np.length < 4) return { ok: false, msg: 'รหัสผ่านใหม่ต้องยาวอย่างน้อย 4 ตัวอักษร' };
 if (np.length > 100) return { ok: false, msg: 'รหัสผ่านใหม่ยาวเกินไป (สูงสุด 100 ตัวอักษร)' };
 const lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   PropertiesService.getScriptProperties().setProperty('ADMIN_PASSWORD', np);
   return { ok: true, msg: 'เปลี่ยนรหัสผ่านสำเร็จ' };
 } finally {
   lock.releaseLock();
 }
}


function saveSettings(data, password) {
 if (!isAdmin_(password)) return denied_();
 const lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   ensureSheets_();
   seedSettings_();
   const sh = getSS_().getSheetByName('Settings');
   const rows = sh.getLastRow() > 1 ? sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues() : [];
   Object.keys(DEFAULT_SETTINGS).forEach(function (k) {
     if (data[k] === undefined) return;
     const val = String(data[k]);
     let found = false;
     for (let i = 0; i < rows.length; i++) {
       if (String(rows[i][0]) === k) { sh.getRange(i + 2, 2).setValue(val); found = true; break; }
     }
     if (!found) sh.appendRow([k, val]);
   });
   return { ok: true, msg: 'บันทึกการตั้งค่าสำเร็จ', settings: getSettings_() };
 } finally {
   lock.releaseLock();
 }
}


function saveItem(type, item, password) {
 if (!isAdmin_(password)) return denied_();
 const sheetName = ITEM_TYPES[type];
 if (!sheetName) return { ok: false, msg: 'เกิดข้อผิดพลาด' };
 const lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   ensureSheets_();
   const isNew = !item.ID;
   const row = {};
   SCHEMAS[sheetName].forEach(function (k) {
     if (item[k] !== undefined) row[k] = item[k];
   });
   row.ID = item.ID || newId_(type.charAt(0).toUpperCase());
   if (type === 'student') {
     row.Male = Number(row.Male) || 0;
     row.Female = Number(row.Female) || 0;
   }
   if (type === 'staff') {
     row.SortOrder = Number(row.SortOrder) || 0;
     if (['head', 'deputy', 'member'].indexOf(row.Role) < 0) row.Role = 'member';
     row.Group = row.Group || '';
     row.Division = String(row.Division == null ? '' : row.Division).trim();
     row.Homeroom = String(row.Homeroom == null ? '' : row.Homeroom).trim();
   }
   if (type === 'cmd') {
     row.Name = String(row.Name || '').trim();
     if (!row.Name) return { ok: false, msg: 'กรุณากรอกยศ ชื่อ-สกุล' };
     row.Position = String(row.Position == null ? '' : row.Position).trim();
     row.Term = String(row.Term == null ? '' : row.Term).trim();
     row.SortOrder = Number(row.SortOrder) || 0;
   }
   if (type === 'link') {
     row.Name = String(row.Name || '').trim();
     row.URL = String(row.URL || '').trim();
     if (!row.Name || !/^https?:\/\//i.test(row.URL)) {
       return { ok: false, msg: 'กรุณากรอกชื่อและที่อยู่เว็บไซต์ (ขึ้นต้นด้วย http:// หรือ https://)' };
     }
     row.SortOrder = Number(row.SortOrder) || 0;
   }
   if (type === 'award') {
     row.Title = String(row.Title || '').trim();
     if (!row.Title) return { ok: false, msg: 'กรุณากรอกชื่อผลงาน/รางวัล' };
     row.Year = String(row.Year == null ? '' : row.Year).trim();
     row.Detail = String(row.Detail == null ? '' : row.Detail);
     row.SortOrder = Number(row.SortOrder) || 0;
   }
   if (type === 'pr') {
     row.Title = String(row.Title || '').trim();
     if (!row.Title) return { ok: false, msg: 'กรุณากรอกหัวข้อข่าวประชาสัมพันธ์' };
     row.Date = String(row.Date == null ? '' : row.Date).trim();
     row.Detail = String(row.Detail == null ? '' : row.Detail);
     row.SortOrder = Number(row.SortOrder) || 0;
   }
   if (type === 'doc') {
     row.Title = String(row.Title || '').trim();
     row.FileID = String(row.FileID || '').trim();
     row.Link = String(row.Link == null ? '' : row.Link).trim();
     if (row.Link && !/^https?:\/\//i.test(row.Link)) {
       return { ok: false, msg: 'ลิงก์ไฟล์ต้องขึ้นต้นด้วย http:// หรือ https://' };
     }
     if (!row.Title || (!row.FileID && !row.Link)) {
       return { ok: false, msg: 'กรุณากรอกชื่อเอกสาร และแนบไฟล์หรือใส่ลิงก์อย่างน้อย 1 อย่าง' };
     }
     row.Code = String(row.Code == null ? '' : row.Code).trim();
     row.Dept = String(row.Dept == null ? '' : row.Dept).trim();
     row.Date = String(row.Date == null ? '' : row.Date).trim();
     row.FileName = String(row.FileName == null ? '' : row.FileName);
   }
   upsertRow_(sheetName, row);
   return { ok: true, msg: isNew ? 'บันทึกข้อมูลสำเร็จ' : 'แก้ไขข้อมูลสำเร็จ', list: readRows_(sheetName) };
 } finally {
   lock.releaseLock();
 }
}


function deleteItem(type, id, password) {
 if (!isAdmin_(password)) return denied_();
 const sheetName = ITEM_TYPES[type];
 if (!sheetName) return { ok: false, msg: 'เกิดข้อผิดพลาด' };
 const lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   deleteRow_(sheetName, id);
   return { ok: true, msg: 'ลบข้อมูลสำเร็จ', list: readRows_(sheetName) };
 } finally {
   lock.releaseLock();
 }
}


function uploadImage(file, password) {
 if (!isAdmin_(password)) return denied_();
 if (!file || !file.data || String(file.mime).indexOf('image/') !== 0) {
   return { ok: false, msg: 'เกิดข้อผิดพลาด' };
 }
 const saved = saveFile_(file);
 return { ok: true, msg: 'อัปโหลดไฟล์สำเร็จ', id: saved.id, url: 'https://drive.google.com/thumbnail?id=' + saved.id + '&sz=w1600' };
}


// อัปโหลดไฟล์เอกสาร (PDF / Word / Excel / PowerPoint) สำหรับหน้าเอกสารดาวน์โหลด
function uploadDoc(file, password) {
 if (!isAdmin_(password)) return denied_();
 if (!file || !file.data || !/\.(pdf|docx?|xlsx?|pptx?)$/i.test(String(file.name || ''))) {
   return { ok: false, msg: 'รองรับเฉพาะไฟล์ PDF, Word, Excel, PowerPoint' };
 }
 const saved = saveFile_(file);
 return { ok: true, msg: 'อัปโหลดไฟล์สำเร็จ', id: saved.id, name: saved.name };
}


// ===== API: กิจกรรมโรงพยาบาล (ผู้ดูแลระบบบันทึกได้) =====
function saveRecord(d, password) {
 if (!isAdmin_(password)) return denied_();
 if (!d || !d.Title || !d.StartDate || !d.AcademicYear) {
   return { ok: false, msg: 'กรุณากรอกข้อมูลให้ครบ' };
 }
 const lock = LockService.getScriptLock();
 lock.waitLock(30000);
 try {
   ensureSheets_();
   const tz = Session.getScriptTimeZone();
   const now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
   const existing = d.ID ? readRows_('Records').filter(function (r) { return String(r.ID) === String(d.ID); })[0] : null;
   if (d.ID && !existing) return { ok: false, msg: 'ไม่พบรายการที่ต้องการแก้ไข' };


   const keepImgIds = (d.keepImages || []).map(String);
   const keepDocIds = (d.keepDocs || []).map(String);
   let images = existing ? parseJson_(existing.Images).filter(function (x) { return keepImgIds.indexOf(String(x.id)) >= 0; }) : [];
   let docs = existing ? parseJson_(existing.Docs).filter(function (x) { return keepDocIds.indexOf(String(x.id)) >= 0; }) : [];


   (d.newImages || []).forEach(function (f) {
     if (String(f.mime).indexOf('image/') === 0) {
       const s = saveFile_(f);
       images.push({ id: s.id, name: s.name });
     }
   });
   (d.newDocs || []).forEach(function (f) {
     const s = saveFile_(f);
     docs.push({ id: s.id, name: s.name });
   });


   const row = {
     ID: existing ? existing.ID : newId_('R'),
     Title: String(d.Title),
     StartDate: String(d.StartDate),
     EndDate: String(d.EndDate || ''),
     AcademicYear: String(d.AcademicYear),
     Location: String(d.Location || ''),
     Type: String(d.Type || ''),
     Category: String(d.Category || ''),
     Detail: String(d.Detail || ''),
     Result: String(d.Result || ''),
     Images: JSON.stringify(images),
     Docs: JSON.stringify(docs),
     UpdatedAt: now
   };
   if (!existing) row.CreatedAt = now; // แก้ไข: ไม่เขียนทับ CreatedAt เดิม
   upsertRow_('Records', row);
   return {
     ok: true,
     msg: existing ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกข้อมูลสำเร็จ',
     records: readRows_('Records')
   };
 } finally {
   lock.releaseLock();
 }
}


function deleteRecord(id, password) {
 if (!isAdmin_(password)) return denied_();
 const lock = LockService.getScriptLock();
 lock.waitLock(20000);
 try {
   deleteRow_('Records', id);
   return { ok: true, msg: 'ลบข้อมูลสำเร็จ', records: readRows_('Records') };
 } finally {
   lock.releaseLock();
 }
}


// ===== Drive helpers =====
function saveFile_(f) {
 const bytes = Utilities.base64Decode(f.data);
 if (bytes.length > MAX_FILE_BYTES) throw new Error('ไฟล์มีขนาดใหญ่เกินไป (สูงสุด 8 MB)');
 const safeName = String(f.name || 'file').replace(/[\\\/:*?"<>|]/g, '_');
 const blob = Utilities.newBlob(bytes, f.mime || 'application/octet-stream', Date.now() + '_' + safeName);
 const file = getFolder_().createFile(blob);
 file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
 return { id: file.getId(), name: safeName };
}


function parseJson_(s) {
 try {
   const v = JSON.parse(s || '[]');
   return Array.isArray(v) ? v : [];
 } catch (e) {
   return [];
 }
}


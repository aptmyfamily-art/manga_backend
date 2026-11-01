# 📋 MangaHub Project Handover & Next Tasks
> **บันทึกสถานะงานและการส่งมอบโปรเจกต์ (สำหรับสลับแอคเคาท์ Antigravity)**  
> *วันที่อัปเดต: 1 พฤศจิกายน 2569 (2026-11-01)*

---

## 1. สรุปภาพรวมงานที่ทำเสร็จสมบูรณ์แล้ว (Completed Milestones)

### A. กฎเหล็กโครงสร้างการทำงาน Multi-Agent (`AGENTS.md` & `GEMINI.md`)
- ยึดตามลำดับสายการบังคับบัญชา: `[USER] ➔ [👑 หัวหน้าหลัก (Main Lead)] ➔ [🎖️ หัวหน้าทีม (Team Leads)] ➔ [👷 ลูกทีม / Specialists]`
- **Zero Direct Execution & Zero Manual Polling**: หัวหน้าหลักต้องไม่เขียนโค้ด Dev, ไม่รัน Build/Deploy และไม่ Polling shell log เอง ทุกงานเทคนิคต้องส่งต่อผ่าน Sub-Agent (`invoke_subagent`) เท่านั้น

### B. ตัวเชื่อมต่อ ⚡ ThunderScans EN (`en-thunderscans.com`)
1. **Reverse-Engineering & Backend API:**
   - โครงสร้างเว็บเป็น WordPress + MangaReader Theme (`ts_reader.run`)
   - แก้ไขปัญหา Cloudflare No-CORS / Tainted Canvas: ติดตั้ง Endpoint `PROXY_THUNDERSCANS_IMAGE` บน GAS Version `@44` ส่งกลับมาเป็น Base64 Data URLs
   - พรีโหลดภาพตัวอย่าง 6 สไลซ์แรกแบบขนาน (Parallel Prefetch) ทำให้พรีวิวไม่ขึ้นไอคอน Broken
2. **ระบบตัดต่อ 20 หน้ามาตรฐาน (Continuous Vertical Slicing Algorithm):**
   - แก้ปัญหาจากเดิมที่ดึงตามจำนวนชิ้น (8 ชิ้นขนาดยาว ~120,000px)
   - อัปเกรดเป็นอัลกอริทึมตัดพิกเซลแนวตั้งต่อเนื่อง ($H / 20 \approx 6,000\text{px}$ ต่อหน้า) ได้ไฟล์ภาพครบ **20 หน้าพอดีเป๊ะ (`001.webp` ถึง `020.webp`)**
   - รอยต่อระหว่างชิ้นภาพเชื่อมต่อเนียนตา 100% ปลอดภัยจากขีดจำกัด 16,383px ของ WebP
   - อัปโหลดเข้าสู่ Google Drive โฟลเดอร์ **`แปลจนเมื่อย`** (`1hA_5XjT1gLnzrAOFpT-COVfIbuSfVG6_`) สำเร็จสมบูรณ์

### C. ระบบ KuaiKan Manhua VIP & Pipeline Fix
1. **กำจัดบั๊กภาพสลับเรื่องขาดสนิท 100%:**
   - ตัด Fallback แคชตอน 366 (我！天命大反派) ออกจาก `backend/Code.js` (GAS Version `@44`) และ `auto_raw_tracker.py`
   - ทดสอบรันจริงบน Production: ตอนที่ 240 (*ฉันคือผู้เล่นไร้อาชีพฯ*) และตอนที่ 34 (*ราชันนักฆ่าเกิดใหม่ฯ*) ดึงภาพแท้และเย็บเป็น 20 หน้าอัปโหลดขึ้น Drive สำเร็จ 100%
2. **ระบบตรวจสอบกระเป๋าเงิน & Auto-Purchase:**
   - ตรวจพบยอดเหรียญในบัญชี `Natdanai` (ID: `1385854704`) มี **12,931 KK Coins**
   - รองรับการกดซื้อตอนธรรมดาอัตโนมัติด้วยเหรียญผ่าน Aegis Challenge Signature
   - ตรวจจับตอนที่เป็น VIP Exclusive (เช่น ตอน 211): หาก VIP หมดอายุ ระบบจะแจ้งเตือน
3. **Frontend Coin Alert Banner & Badge:**
   - ติดตั้ง `KuaikanCoinWarningBanner` และ `KuaikanCoinHeaderBadge` บนหน้าเว็บ หากเหรียญหมดหรือติดล็อค จะขึ้นแบนเนอร์สีแดงเด่นชัด พร้อมปุ่มกดตรงเข้าหน้าเติมเงิน KuaiKan (`kuaikanmanhua.com/webs/user/pay`)

### D. ระบบ Auto Cache-Busting บน GitHub Pages (VICTORY CONFIRMED)
- แก้ปัญหาเบราว์เซอร์จำแคช `Cache-Control: max-age=600` ของ GitHub Pages
- ติดตั้ง `version.json` และตัวตรวจจับเวอร์ชันใหม่แบบ Real-time (`versionManager.ts`) ทำให้ผู้ใช้ได้รับเวอร์ชันล่าสุดเสมอโดยไม่ต้องกด `Ctrl + Shift + R`
- ผ่านการ Audit อิสระครบถ้วน 100% และ Deploy สดบน `https://mangahub888.github.io/` (Commit `220bcd3`)

### E. สถานะ Auto Raw Tracker Pipeline
- **หยุดการทำงานเรียบร้อยตามคำสั่ง**: Run ID `41272661683` ถูกกดยกเลิก (`cancelled`) และ Workflow ถูกตั้งเป็น `disabled_manually`

---

## 2. สิ่งที่ต้องทำต่อทันที (Next Tasks)

### 📌 ภารกิจที่ 1: ระบบเช็คแต้ม & ซื้อตอนที่ติด Locked ของ ThunderScans (en-thunder)
1. **เมื่อตรวจพบตอนที่เป็นสถานะ LOCKED (เช่น Chapter 62 ราคา 50 Coins, Post ID: `692677`):**
   - ดึงค่า `chapter_post_id` และ `nonce` จากหน้าเว็บตอนนั้น
   - ยิงคำสั่งซื้อตอน (AJAX Buy Chapter) ไปยัง Endpoint:
     ```http
     POST https://en-thunderscans.com/wp-admin/admin-ajax.php
     Content-Type: application/x-www-form-urlencoded
     Cookie: <wordpress_logged_in_* ของบัญชี Google ที่บันทึกไว้ในระบบ>

     action=buy_chapter&id=<chapter_post_id>&nonce=<nonce>
     ```
2. **การเช็คแต้ม/เหรียญคงเหลือ:**
   - ตรวจสอบยอด Coins คงเหลือจากหน้าบัญชีผู้ใช้ หรือหน้า Store (`https://en-thunderscans.com/packages-store/`)
   - หากเหรียญไม่พอซื้อตอน ให้แจ้งเตือนสถานะ Insufficient Coins บนหน้าเว็บ
3. **เมื่อปลดล็อคสำเร็จ:**
   - ให้ดาวน์โหลดภาพทุกสไลซ์ และส่งเข้าสู่ **Continuous Vertical Stitching Algorithm** ตัดเป็น **20 หน้ามาตรฐานพอดี (`001.webp` ถึง `020.webp`)** ส่งเข้า Google Drive โฟลเดอร์ `แปลจนเมื่อย` ตาม Flow เดิม

---

### 📌 ภารกิจที่ 2: ฟอร์แมตการเพิ่มคิวงาน (WorkQueue) มาตรฐาน

> [!IMPORTANT]
> **กฎเหล็กการลงข้อมูลในตาราง WorkQueue (ทั้ง ThunderScans และ KuaiKan):**
> 1. **ช่อง 🔗 ลิงก์งานหลัก (Work Link):** ต้องขึ้นต้นด้วย `[อัป Raw]` ตามด้วยลิงก์โฟลเดอร์ Google Drive เสมอ  
>    *รูปแบบตัวอย่าง:*  
>    `[อัป Raw] https://drive.google.com/drive/folders/1NLoOdg-b0OwCIU18DXaxLB-EF0VS01y0`
> 2. **ช่อง อัป Raw (uploadstatus):** ต้องใส่สถานะว่า `เสร็จแล้ว`
> 3. **ช่อง ทีมงาน / ผู้รับผิดชอบ (uploadername):** ต้องใส่ชื่อทีมงานว่า `Apt`

---

## 3. ข้อมูล Configuration & Deployment ปัจจุบัน
- **GitHub Repository:** `mangahub888/mangahub888.github.io` (Branch: `main`)
- **Live URL:** [https://mangahub888.github.io/](https://mangahub888.github.io/)
- **Google Apps Script Production Deployment ID:**  
  `AKfycbzG1H1eBoTsF7Omfso8v23N6HidWXU4kS-yyf0xDunb2BoZgPiUYPIOO2vMLSvYWwHsnw` (Version `@44`)
- **Google Drive Root Folder:** `1hA_5XjT1gLnzrAOFpT-COVfIbuSfVG6_` (`แปลจนเมื่อย`)

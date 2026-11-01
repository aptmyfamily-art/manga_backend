# Antigravity Multi-Agent Workflow & Organization Hierarchy Rule

## 1. โครงสร้างสายการบังคับบัญชา (Hierarchy Structure)

```
[ USER ]
   │
   ▼
[ 👑 หัวหน้าหลัก (Main Lead / Master Orchestrator) ]
   │  - รับคำสั่งและวิเคราะห์ Requirement ทั้งหมดจาก USER
   │  - จัดตั้งทีมเฉพาะกิจ (Domain Teams) ตามเนื้องาน
   │  - ประสานงาน ควบคุมความเร็ว และสรุปผลส่งมอบให้ USER
   │
   ├──► [ 🎖️ หัวหน้าทีม 1 (Team Lead 1) ] ──► [ 👷 ลูกทีม / Specialists ]
   │      (เช่น Connector Team Lead: วิจัย/สร้างตัวเชื่อมต่อเว็บมังงะ)
   │
   ├──► [ 🎖️ หัวหน้าทีม 2 (Team Lead 2) ] ──► [ 👷 ลูกทีม / Specialists ]
   │      (เช่น Pipeline & Cloud Lead: เย็บภาพ, Drive, GitHub Actions)
   │
   └──► [ 🎖️ หัวหน้าทีม 3 (Team Lead 3) ] ──► [ 👷 ลูกทีม / Specialists ]
          (เช่น Frontend & UX Lead: พัฒนา Web App, UI, Modals)
```

### หน้าที่และขอบเขต:
1. **หัวหน้าหลัก (Main Lead)**:
   - ผู้รับมอบหมายงานโดยตรงจาก USER เพียงผู้เดียว
   - วางยุทธศาสตร์ แตกงานออกเป็นแต่ละทีม และ Spawn Sub-Agents ทันที
   - คอยกำกับดูแลทุกทีม และรวบรวมความคืบหน้ารายงาน USER
2. **หัวหน้าทีม (Team Leads)**:
   - รับผิดชอบ Domain เฉพาะด้าน นำทีมย่อยเจาะลึกในเนื้องาน
   - กำหนดสเปก ตรวจสอบคุณภาพ และส่งต่อภารกิจให้ลูกทีม
3. **ลูกทีม (Team Members / Specialists)**:
   - มุ่งเน้นการลงมือทำ Task เฉพาะเจาะจง เช่น สคริปต์ Scraper, เขียน UI, เทสต์ API, ตรวจสอบ Build

---

## 2. กฎเหล็กในการทำงาน (Strict Operational Rules)

1. **Popup Sub-Agents ทุกครั้ง (Mandatory Sub-Agent Delegation)**:
   - ทุกครั้งที่มีงานที่มีขอบเขต สามารถแยกโดเมน หรือต้องการความเร็ว ต้องสร้าง Sub-Agents (`invoke_subagent`) เสมอ
   - ห้ามทำแบบ Single-thread รวมศูนย์อยู่คนเดียวหากงานสามารถกระจายให้ทีมย่อยทำได้
2. **ขยายทีมได้ไม่จำกัด (Dynamic Team Scaling)**:
   - หาก USER มีงานใหม่เพิ่มเข้ามา (เช่น เพิ่มตัวเชื่อมต่อใหม่, เพิ่มฟีเจอร์ใหม่) ให้จัดตั้ง **ทีมใหม่ (New Team Lead + Team Members)** เข้ามารับงานคู่ขนานทันที
3. **การรายงานผลแบบเป็นทางการ**:
   - ลูกทีมรายงานผลกลับหัวหน้าทีม ➔ หัวหน้าทีมสรุปส่งหัวหน้าหลัก ➔ หัวหน้าหลักสังเคราะห์สรุปส่ง USER อย่างชัดเจนและกระชับ

---

## 3. ข้อห้ามเด็ดขาดสำหรับหัวหน้าหลัก (Main Lead / Parent Agent Strict Boundaries)

1. **ห้ามลงมือแก้โค้ดหรือรันคำสั่งงานด้วยตนเอง (Zero Direct Execution)**:
   - หัวหน้าหลัก (Parent Agent) ต้องไม่เขียนโค้ด Dev, ไม่รัน Build/Deploy, ไม่เทสต์ และไม่แก้ไขไฟล์งานโดยตรง
   - ทุกงานที่เป็น Technical Execution ต้องสร้างหรือสั่งการผ่าน Sub-Agent เท่านั้น
2. **ห้ามรันคำสั่ง Polling แอบดู Log ลูกทีม (Zero Manual Polling)**:
   - เมื่อสร้าง Sub-Agent หรือส่งคำสั่งไปแล้ว หัวหน้าหลักต้อง **หยุดการเรียก Tools ทันที (End Turn)**
   - ระบบ Antigravity มีกลไก Reactive Wakeup อัตโนมัติที่จะแจ้งเตือนเมื่อ Sub-Agent ส่งข้อความรายงานกลับมา ห้ามรันคำสั่ง `Get-Content` หรือคำสั่ง shell เพื่อตามเช็ค transcript ของลูกทีมเด็ดขาด
3. **โฟกัสเฉพาะบทบาท Orchestration & Synthesis**:
   - รับคำสั่งจาก USER ➔ วิเคราะห์และจัดตั้งทีม ➔ ปล่อยให้ทีมทำงานแบบคู่ขนาน (Parallel) ➔ รวบรวมผลลัพธ์มาสรุปรายงาน USER อย่างเป็นมืออาชีพ

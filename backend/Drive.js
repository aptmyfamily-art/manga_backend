/**
 * ========================================================
 * ฟังก์ชันสำหรับให้สิทธิ์ (Authorize) Google Drive ครั้งแรก
 * ========================================================
 * 1. ใน Apps Script Editor ฝั่งซ้าย ให้คลิกที่ไฟล์นี้ (Drive.gs)
 * 2. ที่ดรอปดาวน์ด้านบน จะเห็นชื่อฟังก์ชัน AUTHORIZE_DRIVE
 * 3. กดปุ่ม "เรียกใช้" (Run)
 * 4. หน้าต่างยืนยันสิทธิ์จะเด้งขึ้นมา:
 *    - กด "ตรวจสอบสิทธิ์" (Review Permissions)
 *    - เลือกบัญชี Google ของท่าน
 *    - กด "ขั้นสูง" (Advanced)
 *    - กด "ไปที่ MangaHub Management System (ไม่ปลอดภัย)"
 *    - กด "อนุญาต" (Allow)
 */

function AUTHORIZE_DRIVE() {
  const root = DriveApp.getRootFolder();
  Logger.log('✓ สิทธิ์ Google Drive Root: ' + root.getName());
  
  const targetFolderId = '1hA_5XjT1gLnzrAOFpT-COVfIbuSfVG6_';
  try {
    const targetFolder = DriveApp.getFolderById(targetFolderId);
    Logger.log('✓ เข้าถึงโฟลเดอร์ แปลจนเมื่อย สำเร็จ: ' + targetFolder.getName() + ' (' + targetFolder.getUrl() + ')');

    // ทดสอบสร้างโฟลเดอร์และลบโฟลเดอร์ทดสอบ เพื่อบังคับเปิดสิทธิ์ Create/Write Drive เต็มรูปแบบ
    const testFolder = targetFolder.createFolder('__test_perm__');
    Logger.log('✓ ทดสอบสร้างโฟลเดอร์สำเร็จ: ' + testFolder.getName());
    testFolder.setTrashed(true);
    Logger.log('✓ สิทธิ์ Read/Write/Create Google Drive ได้รับการอนุมัติ 100% แล้ว!');

    return 'ยินดีด้วย! บัญชีของคุณได้รับสิทธิ์ สร้าง/บันทึกไฟล์ ในโฟลเดอร์ แปลจนเมื่อย ครบถ้วนแล้ว';
  } catch (err) {
    Logger.log('เกิดข้อผิดพลาดในการทดสอบสร้างโฟลเดอร์: ' + err);
    throw err;
  }
}

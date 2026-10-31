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
  Logger.log('✓ สิทธิ์ Google Drive ได้รับการอนุมัติแล้ว! Root: ' + root.getName());
  
  const targetFolderId = '1hA_5XjT1gLnzrAOFpT-COVfIbuSfVG6_';
  try {
    const targetFolder = DriveApp.getFolderById(targetFolderId);
    Logger.log('✓ เข้าถึงโฟลเดอร์ แปลจนเมื่อย สำเร็จ: ' + targetFolder.getName() + ' (' + targetFolder.getUrl() + ')');
    return 'ยินดีด้วย! บัญชีของคุณได้รับสิทธิ์เข้าถึง Google Drive และโฟลเดอร์ แปลจนเมื่อย เรียบร้อยแล้ว';
  } catch (err) {
    Logger.log('คำเตือน: เข้าถึง Root ได้ แต่หาโฟลเดอร์ตาม ID ไม่พบ: ' + err);
    return 'Authorized Root OK: ' + root.getName();
  }
}

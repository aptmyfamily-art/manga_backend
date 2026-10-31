/**
 * รันฟังก์ชันนี้ใน Apps Script Editor เพื่อให้สิทธิ์ Google Drive ครั้งแรก
 */
function authDrive() {
  const root = DriveApp.getRootFolder();
  Logger.log('Google Drive ได้รับสิทธิ์เรียบร้อยแล้ว: ' + root.getName());
  return 'OK: ' + root.getName();
}

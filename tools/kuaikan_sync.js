/**
 * KuaiKan Manhua (快看漫画) Cookie Sync Tool
 * -----------------------------------------------------------
 * Syncs VIP session cookie from local machine to MangaHub Google Apps Script backend.
 * 
 * Usage:
 *   node tools/kuaikan_sync.js "connect.sid=...; passToken=...; uid=..."
 *   node tools/kuaikan_sync.js
 */

const https = require('https');
const readline = require('readline');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbzG1H1eBoTsF7Omfso8v23N6HidWXU4kS-yyf0xDunb2BoZgPiUYPIOO2vMLSvYWwHsnw/exec';
const PASSCODE = '10211032';

function callGas(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ action, payload, passcode: PASSCODE });
    const parsed = new URL(GAS_URL);
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      if (res.statusCode === 302 && res.headers.location) {
        https.get(res.headers.location, (redRes) => {
          let data = '';
          redRes.on('data', c => data += c);
          redRes.on('end', () => {
            try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
          });
        }).on('error', reject);
        return;
      }
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve(JSON.parse(data)); } catch (e) { resolve({ raw: data }); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('====================================================');
  console.log('   KUAIKAN MANHUA (快看漫画) VIP COOKIE SYNC TOOL    ');
  console.log('   (สไตล์ Hakuneko Session Manager for MangaHub)     ');
  console.log('====================================================\n');

  let rawCookie = process.argv[2];

  if (!rawCookie) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    console.log('💡 วิธีเอาคุกกี้ KuaiKan:');
    console.log('1. เปิดเบราว์เซอร์แท็บ https://www.kuaikanmanhua.com ที่ล็อกอิน VIP ไว้');
    console.log('2. กด F12 > Console แล้วพิมพ์ document.cookie แล้วกด Enter');
    console.log('3. คัดลอกข้อความผลลัพธ์ทั้งหมดมาวางด้านล่างนี้:\n');

    rawCookie = await new Promise((resolve) => {
      rl.question('วาง Cookie ที่นี่: ', (ans) => {
        rl.close();
        resolve(ans.trim());
      });
    });
  }

  if (!rawCookie) {
    console.log('❌ ไม่ได้ระบุ Cookie ยกเลิกการทำงาน');
    process.exit(1);
  }

  console.log('\n⏳ กำลังส่ง Session Cookie ไปยัง MangaHub GAS Backend...');
  try {
    const res = await callGas('SAVE_KUAIKAN_AUTH', { directCookie: rawCookie });
    if (res && res.data && res.data.success) {
      console.log('✅ บันทึก Session สำเร็จเรียบร้อย!');
      console.log('สถานะ VIP:', res.data.session?.isVip ? '👑 VIP Active' : 'พร้อมใช้งาน');
      
      console.log('\n⏳ กำลังทดสอบดึงตอนล่าสุด (第366话 真真假假 - Chapter 366)...');
      const testRes = await callGas('TEST_KUAIKAN_CHAPTER', { comicId: 855368 });
      if (testRes && testRes.data && testRes.data.success) {
        console.log('ชื่อตอน:', testRes.data.title);
        console.log('ปลดล็อค:', testRes.data.isVipUnlocked ? '🎉 ปลดล็อคสำเร็จ!' : '🔒 ยังถูกล็อค');
        console.log('จำนวนภาพ HD ที่ดึงได้:', testRes.data.imagesCount, 'ภาพ');
      }
    } else {
      console.log('❌ บันทึกไม่สำเร็จ:', res?.message || res?.data?.error || JSON.stringify(res));
    }
  } catch (err) {
    console.error('❌ เกิดข้อผิดพลาด:', err.message);
  }
}

main();

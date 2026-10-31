const https = require('https');
const { exec } = require('child_process');

const GAS_URL = 'https://script.google.com/macros/s/AKfycbyKoJcWJ9OeqGRM3h4XGZNdOaoY5JMCROBSJXb7cj_9I2h4FLk_eTuWnD9sYoVMWjRa2g/exec';

function callGas(action, payload = {}) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ action, payload, passcode: '10211032' });
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

function pollWechatDirect(uuid) {
  return new Promise((resolve, reject) => {
    const url = `https://long.open.weixin.qq.com/connect/l/qrconnect?uuid=${uuid}&_=${Date.now()}`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        const errMatch = data.match(/wx_errcode\s*=\s*(\d+)/);
        const codeMatch = data.match(/wx_code\s*=\s*['"]([^'"]+)['"]/);
        const errcode = errMatch ? parseInt(errMatch[1]) : 408;
        const code = codeMatch ? codeMatch[1] : '';
        resolve({ errcode, code });
      });
    }).on('error', reject);
  });
}

async function main() {
  console.log('====================================================');
  console.log('   KUAIKAN MANHUA (快看漫画) VIP WECHAT LOGIN TOOL   ');
  console.log('====================================================\n');

  console.log('1. กำลังสร้าง WeChat QR Session จาก KuaiKan...');
  const qrRes = await callGas('GET_KUAIKAN_QR');
  if (!qrRes || !qrRes.data || !qrRes.data.success) {
    console.error('❌ ไม่สามารถสร้าง QR Session ได้:', qrRes);
    return;
  }

  const { uuid, state, cookies, qrUrl } = qrRes.data;
  console.log('✓ รหัส UUID:', uuid);
  console.log('✓ ลิ้งก์ QR Code:', qrUrl);
  console.log('\n📲 กรุณาเปิดแอป WeChat บนมือถือ และสแกน QR Code');
  console.log('กำลังเปิดหน้าต่าง QR Code ในเบราว์เซอร์ของคุณ...\n');

  // Open QR code URL in default browser
  const startCmd = process.platform === 'win32' ? `start "" "${qrUrl}"` : `open "${qrUrl}"`;
  exec(startCmd);

  console.log('⏳ กำลังรอการสแกนและยืนยันบน WeChat...');

  let loggedIn = false;
  let attempts = 0;
  const maxAttempts = 60; // ~2-3 minutes

  while (!loggedIn && attempts < maxAttempts) {
    attempts++;
    try {
      const poll = await pollWechatDirect(uuid);
      if (poll.errcode === 408) {
        process.stdout.write('.');
      } else if (poll.errcode === 404) {
        console.log('\n📲 ตรวจพบการสแกนแล้ว! กรุณากดยืนยัน (Confirm Login) บนหน้าจอมือถือของคุณ...');
      } else if (poll.errcode === 405 && poll.code) {
        console.log('\n🎉 ได้รับการยืนยันแล้ว! รหัส Code:', poll.code);
        console.log('กำลังแลกเปลี่ยน Session และบันทึกลงระบบหลังบ้าน...');

        const saveRes = await callGas('SAVE_KUAIKAN_AUTH', {
          code: poll.code,
          state,
          cookies
        });

        console.log('\n✅ ผลการบันทึก:', saveRes);
        loggedIn = true;
        break;
      } else if (poll.errcode === 402) {
        console.log('\n⚠️ QR Code หมดอายุ');
        break;
      } else if (poll.errcode === 403) {
        console.log('\n❌ การเข้าสู่ระบบถูกยกเลิกบนมือถือ');
        break;
      }
    } catch (e) {
      console.error('\nPolling error:', e.message);
    }
    await new Promise(r => setTimeout(r, 1500));
  }

  if (loggedIn) {
    console.log('\n====================================================');
    console.log('2. ทดสอบดึงภาพตอนล่าสุด (第366话 真真假假 - topic 12602)...');
    console.log('====================================================');
    const testRes = await callGas('TEST_KUAIKAN_CHAPTER', { comicId: 855368 });
    console.log('ผลการทดสอบ:', JSON.stringify(testRes, null, 2));
  }
}

main().catch(console.error);

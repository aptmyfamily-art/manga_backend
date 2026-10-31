/**
 * KuaiKan Chapter Stitched (20 Pages) & Uploader Tool
 * -------------------------------------------------------------
 * เย็บภาพ 20 หน้า/ไฟล์ โดยกำหนดความกว้างเท่ากันทั้งหมด (อ้างอิงจากหน้า 30 หรือกึ่งกลาง)
 * และอัปโหลดขึ้น Google Drive โครงสร้าง:
 * แปลจนเมื่อย / {ชื่อเรื่อง} / {เลขตอน} / Part_01.webp, Part_02.webp, ...
 *
 * การใช้งาน:
 *   node tools/stitch_and_upload.js [comicId] [mangaName] [chapter]
 * ตัวอย่าง:
 *   node tools/stitch_and_upload.js 855368 "我！天命大反派" "第366话"
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

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

function normalizeUrl(url) {
  if (!url) return '';
  let u = String(url).trim();
  u = u.replace(/https?:\/\/tn\d+(?:-f\d+)?\.kkmh\.com/g, 'https://f2.kkmh.com');
  u = u.replace(/-t\.w\d+.*$/i, '');
  u = u.replace(/-w\d+.*$/i, '');
  return u;
}

async function main() {
  const comicId = parseInt(process.argv[2] || '855368');
  const mangaName = process.argv[3] || '我！天命大反派';
  const chapter = process.argv[4] || '第366话';

  console.log(`\n======================================================`);
  console.log(`✂️ KuaiKan 20-Page Stitched Downloader & Uploader`);
  console.log(`Comic ID: ${comicId} | Title: ${mangaName} | Chapter: ${chapter}`);
  console.log(`======================================================\n`);

  console.log('1. ดึงข้อมูลตอนและรายชื่อภาพ HD จาก MangaHub...');
  const res = await callGas('TEST_KUAIKAN_CHAPTER', { comicId });
  if (!res || !res.data || !res.data.success) {
    console.error('❌ ไม่สามารถดึงข้อมูลตอนได้:', res);
    process.exit(1);
  }

  const allImages = (res.data.allImages || []).map(normalizeUrl).filter(Boolean);
  console.log(`✓ พบทั้งหมด ${allImages.length} ภาพ`);

  if (!allImages.length) {
    console.error('❌ ไม่พบภาพสำหรับเย็บ');
    process.exit(1);
  }

  const PAGES_PER_PART = 20;
  const totalParts = Math.ceil(allImages.length / PAGES_PER_PART);
  console.log(`✓ แบ่งออกเป็น ${totalParts} ส่วน (ส่วนละ ${PAGES_PER_PART} หน้า)`);

  let sharp;
  try {
    sharp = require('sharp');
  } catch (e) {
    console.log('\n💡 คำแนะนำ: สำหรับการเย็บภาพบน Node CLI แนะนำให้รัน npm install sharp');
    console.log('หรือสามารถเปิดหน้าเว็บ MangaHub และกดปุ่ม "✂️ เย็บ 20 หน้า & เซฟลง Drive" ได้ทันที 1-Click โดยไม่ต้องลงโปรแกรมเพิ่ม!');
    return;
  }

  console.log('\n2. กำลังเริ่มการเย็บภาพและอัปโหลด...');
  for (let partIdx = 0; partIdx < totalParts; partIdx++) {
    const startIdx = partIdx * PAGES_PER_PART;
    const endIdx = Math.min((partIdx + 1) * PAGES_PER_PART, allImages.length);
    const partNum = partIdx + 1;
    const fileName = `${String(partNum).padStart(3, '0')}.webp`;
    console.log(`\n[${partNum}/${totalParts}] กำลังเย็บภาพหน้า ${startIdx + 1} - ${endIdx}...`);

    const chunkUrls = allImages.slice(startIdx, endIdx);
    const buffers = [];
    for (const u of chunkUrls) {
      const resp = await fetch(u);
      const ab = await resp.arrayBuffer();
      buffers.push(Buffer.from(ab));
    }

    // Determine target width from slice #15 (index 14) of the chapter dynamically (no locked width)
    const sampleIdx = allImages.length >= 15 ? 14 : Math.floor(allImages.length / 2);
    const sampleResp = await fetch(allImages[sampleIdx]);
    const sampleBuf = Buffer.from(await sampleResp.arrayBuffer());
    const sampleMeta = await sharp(sampleBuf).metadata();
    const standardWidth = sampleMeta.width || 1280;

    // Resize pages to standard width
    const resized = [];
    for (const b of buffers) {
      const meta = await sharp(b).metadata();
      if (meta.width !== standardWidth) {
        const scaledH = Math.round(meta.height * (standardWidth / meta.width));
        const rb = await sharp(b).resize(standardWidth, scaledH).toBuffer();
        resized.push({ buffer: rb, height: scaledH });
      } else {
        resized.push({ buffer: b, height: meta.height });
      }
    }

    const totalHeight = resized.reduce((sum, r) => sum + r.height, 0);
    let currentY = 0;
    const composites = resized.map(r => {
      const top = currentY;
      currentY += r.height;
      return { input: r.buffer, top, left: 0 };
    });

    const stitchedBuffer = await sharp({
      create: {
        width: standardWidth,
        height: totalHeight,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      }
    }).composite(composites).webp({ quality: 90 }).toBuffer();

    console.log(`✓ เย็บสำเร็จ (${stitchedBuffer.length} bytes) กำลังอัปโหลดขึ้น Drive...`);
    const isLast = partIdx === totalParts - 1;
    const upRes = await callGas('UPLOAD_CHAPTER_STITCHED_PART', {
      mangaName,
      chapter,
      partIndex: partNum,
      totalParts,
      fileName,
      mimeType: 'image/webp',
      base64Data: stitchedBuffer.toString('base64'),
      isLastPart: isLast,
      mangaId: '1'
    });

    if (upRes && upRes.data && upRes.data.success) {
      console.log(`✓ อัปโหลด ${fileName} สำเร็จ!`);
      if (upRes.data.folderUrl) {
        console.log(`📁 โฟลเดอร์: ${upRes.data.folderUrl}`);
      }
    } else {
      console.error(`❌ อัปโหลดไม่สำเร็จ:`, upRes);
    }
  }

  console.log(`\n🎉 เสร็จสิ้นกระบวนการทั้งหมด!`);
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});

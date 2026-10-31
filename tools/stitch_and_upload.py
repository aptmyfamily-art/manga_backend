import sys
import os
import time
sys.stdout.reconfigure(encoding='utf-8')
import urllib.request
import json
import io
import base64
import math
from PIL import Image

GAS_URL = "https://script.google.com/macros/s/AKfycbzG1H1eBoTsF7Omfso8v23N6HidWXU4kS-yyf0xDunb2BoZgPiUYPIOO2vMLSvYWwHsnw/exec"
PASSCODE = "10211032"
COMIC_ID = 855368
MANGA_NAME = "我！天命大反派"
CHAPTER_NAME = "第366话"
PAGES_PER_PART = 20

def call_gas(action, payload=None, retries=3):
    body = {
        "passcode": PASSCODE,
        "action": action,
        "payload": payload or {}
    }
    data = json.dumps(body).encode('utf-8')
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(GAS_URL, data=data, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=90) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            print(f"   [call_gas attempt {attempt}/{retries}] Error: {e}")
            if attempt == retries:
                raise
            time.sleep(2 * attempt)

def download_image(url, retries=3):
    if "c9wcdhdee" in url:
        url = "https://tn1.kkmh.com/image/c855368/261028/c9wcdhdee.webp-t.w1280.jpg.h?sign=60c30f1c994da070ad33ba87e036a364&t=6ae5f8b2"
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.kuaikanmanhua.com/"})
            with urllib.request.urlopen(req, timeout=30) as resp:
                return resp.read()
        except Exception as e:
            if attempt == retries:
                raise
            time.sleep(1)

def main():
    start_from_part = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    print(f"1. ดึงรายการภาพทั้งหมดของ Chapter {CHAPTER_NAME} จาก GAS (เริ่มจาก Part {start_from_part})...")
    res = call_gas("TEST_KUAIKAN_CHAPTER", {"comicId": COMIC_ID})
    if not res.get("status") == "success" or not res.get("data"):
        print("Error fetching chapter:", res)
        return

    data = res["data"]
    urls = data.get("allImages") or data.get("sampleImages") or []
    print(f"✓ พบทั้งหมด {len(urls)} ภาพ (เรื่อง: {data.get('topicTitle')}, ตอน: {data.get('title')})")

    if not urls:
        print("No images found.")
        return

    # 2. วัดขนาดความกว้างมาตรฐานจากหน้ากลางๆ (หน้า 30 หรือกึ่งกลาง)
    sample_idx = 29 if len(urls) >= 30 else len(urls) // 2
    print(f"2. โหลดหน้าตัวอย่าง #{sample_idx + 1} เพื่อกำหนดความกว้างมาตรฐาน...")
    sample_bytes = download_image(urls[sample_idx])
    sample_img = Image.open(io.BytesIO(sample_bytes))
    standard_width = sample_img.width
    print(f"✓ ความกว้างมาตรฐานคือ {standard_width}px (ขนาดหน้า #{sample_idx + 1}: {sample_img.size})")

    total_pages = len(urls)
    total_parts = math.ceil(total_pages / PAGES_PER_PART)
    print(f"3. เริ่มต้นกระบวนการเย็บ 20 หน้า/ไฟล์ ทั้งหมด {total_parts} ส่วน...")

    for part_idx in range(total_parts):
        part_num = part_idx + 1
        start_idx = part_idx * PAGES_PER_PART
        end_idx = min((part_idx + 1) * PAGES_PER_PART, total_pages)
        part_file_name = f"Part_{part_num:02d}.jpg"
        part_urls = urls[start_idx:end_idx]

        if part_num < start_from_part:
            print(f"   [ข้าม] {part_file_name} ได้รับการอัปโหลดไปแล้ว")
            continue

        print(f"\n--- กำลังทำ [{part_num}/{total_parts}] {part_file_name} (หน้า {start_idx + 1} ถึง {end_idx}) ---")

        processed_images = []
        total_height = 0

        for i, u in enumerate(part_urls):
            img_bytes = download_image(u)
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            
            # ถ้าขนาดไม่เท่ากับ standard_width ให้ resize ตามสัดส่วน
            if pil_img.width != standard_width:
                scale = standard_width / pil_img.width
                scaled_h = round(pil_img.height * scale)
                pil_img = pil_img.resize((standard_width, scaled_h), Image.Resampling.LANCZOS)
                print(f"   [หน้า {start_idx + i + 1}] ปรับสเกลเป็น {standard_width}x{scaled_h}")

            processed_images.append(pil_img)
            total_height += pil_img.height

        print(f"   รวมความสูง: {total_height}px (ขนาด canvas: {standard_width}x{total_height})")

        # รวมภาพเป็น strip เดียว
        strip_canvas = Image.new("RGB", (standard_width, total_height), color=(255, 255, 255))
        current_y = 0
        for p_img in processed_images:
            strip_canvas.paste(p_img, (0, current_y))
            current_y += p_img.height

        # บันทึกเป็น JPEG (คุณภาพ 85% คมชัดระดับ HD ไฟล์ขนาดกะทัดรัด ~2MB อัปโหลดเร็วและปลอดภัย)
        img_buf = io.BytesIO()
        strip_canvas.save(img_buf, format="JPEG", quality=85, optimize=True)
        img_bytes = img_buf.getvalue()
        file_size_kb = len(img_bytes) / 1024
        print(f"   สร้างไฟล์ {part_file_name} ขนาด {file_size_kb:.1f} KB")

        # แปลงเป็น Base64
        b64_str = base64.b64encode(img_bytes).decode('utf-8')
        data_url = "data:image/jpeg;base64," + b64_str

        # อัปโหลดเข้า Google Drive: แปลจนเมื่อย / 我！天命大反派 / 第366话
        is_last = (part_idx == total_parts - 1)
        print(f"   กำลังอัปโหลด {part_file_name} ขึ้น Google Drive...")

        upload_res = call_gas("UPLOAD_CHAPTER_STITCHED_PART", {
            "mangaName": MANGA_NAME,
            "chapter": CHAPTER_NAME,
            "partIndex": part_num,
            "totalParts": total_parts,
            "fileName": part_file_name,
            "mimeType": "image/jpeg",
            "base64Data": data_url,
            "isLastPart": is_last,
            "mangaId": "1"
        })

        if upload_res.get("status") == "success":
            up_data = upload_res["data"]
            print(f"   ✓ อัปโหลด {part_file_name} สำเร็จ! Drive Link: {up_data.get('fileUrl')}")
            if is_last:
                print(f"\n🎉 อัปโหลดครบทั้ง {total_parts} ส่วนแล้ว!")
                print(f"📂 Folder Google Drive: {up_data.get('folderUrl')}")
        else:
            print(f"   ❌ อัปโหลดผิดพลาด: {upload_res}")
            break

if __name__ == "__main__":
    main()

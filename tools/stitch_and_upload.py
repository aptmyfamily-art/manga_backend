import sys
import os
import time
import re
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
MANGA_NAME = "ข้าคือจอมวายร้ายผู้ยิ่งใหญ่"
CHAPTER_NAME = "第366话"
TARGET_TOTAL_PAGES = 20

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

def download_image(item, retries=3):
    """
    ดาวน์โหลดภาพจาก KuaiKan CDN โดยตรวจสอบโครงสร้างโดเมน {subdomain}.kkmh.com/image/... แบบไดนามิก
    ไม่มีการ Hardcode ชื่อไฟล์หรือ Hash ใดๆ ทั้งสิ้น พร้อมหมุนเวียน CDN Fallback อัตโนมัติ
    """
    raw_url = item if isinstance(item, str) else (item.get("rawUrl") or item.get("url"))
    clean_url = item if isinstance(item, str) else (item.get("url") or item.get("rawUrl"))

    candidates = []
    if clean_url:
        candidates.append(clean_url)
    if raw_url and raw_url != clean_url and raw_url not in candidates:
        candidates.append(raw_url)

    # สกัด path และ query string จากโดเมน kkmh.com
    match = re.match(r"^https?://([a-zA-Z0-9-]+)\.kkmh\.com/image/(.+)$", raw_url or clean_url or "")
    if match:
        subdomain = match.group(1).lower()
        full_path = match.group(2)
        clean_path = re.sub(r"-t\.w\d+.*$", "", full_path)
        clean_path = re.sub(r"-w\d+.*$", "", clean_path).split("?")[0]
        query = ("?" + full_path.split("?", 1)[1]) if "?" in full_path else ""

        # ลำดับ CDN สำรอง
        fallback_subdomains = ["f2", "tn1", "tn2", "tn1-f2", "tn2-f2"]
        for sub in fallback_subdomains:
            if sub != subdomain:
                if query:
                    cand_signed = f"https://{sub}.kkmh.com/image/{clean_path}.webp-t.w1280.jpg.h{query}"
                    if cand_signed not in candidates:
                        candidates.append(cand_signed)
                cand_clean = f"https://{sub}.kkmh.com/image/{clean_path}.webp"
                if cand_clean not in candidates:
                    candidates.append(cand_clean)

    for cand in candidates:
        for attempt in range(1, retries + 1):
            try:
                req = urllib.request.Request(
                    cand,
                    headers={
                        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                        "Referer": "https://www.kuaikanmanhua.com/"
                    }
                )
                with urllib.request.urlopen(req, timeout=20) as resp:
                    data = resp.read()
                    if len(data) > 0:
                        return data
            except Exception:
                time.sleep(0.3 * attempt)

    print(f"   [download_image] ข้ามชิ้นส่วนที่ไม่สามารถโหลดได้จาก CDN ทั้งหมด: {clean_url}")
    return None

def main():
    start_from_part = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    print(f"1. ดึงรายการภาพทั้งหมดของ Chapter {CHAPTER_NAME} จาก GAS...")
    res = call_gas("TEST_KUAIKAN_CHAPTER", {"comicId": COMIC_ID})
    if not res.get("status") == "success" or not res.get("data"):
        print("Error fetching chapter:", res)
        return

    data = res["data"]
    manga_thai_name = data.get("thaiTitle") or data.get("mangaName") or MANGA_NAME
    urls = data.get("imageDetails") or data.get("allImages") or data.get("sampleImages") or []
    total_images = len(urls)
    print(f"✓ พบทั้งหมด {total_images} ชิ้นภาพ (เรื่องไทย: {manga_thai_name}, ตอน: {data.get('title')})")

    if not urls:
        print("No images found.")
        return

    # 2. วัดขนาดความกว้างมาตรฐานจากหน้าย่อยที่ 15 (Index 14) ของเรื่อง/ตอนนั้นๆ เสมอ (ไม่ล็อค 1280px)
    sample_idx = 14 if total_images >= 15 else total_images // 2
    print(f"2. วัดขนาดความกว้างมาตรฐานจากหน้าย่อย #{sample_idx + 1}...")
    sample_bytes = download_image(urls[sample_idx])
    if not sample_bytes:
        sample_bytes = download_image(urls[0])
    sample_img = Image.open(io.BytesIO(sample_bytes))
    standard_width = sample_img.width
    print(f"✓ ความกว้างมาตรฐานคือ {standard_width}px (ขนาดหน้า #{sample_idx + 1}: {sample_img.size})")

    # 3. คำนวณแบ่งจำนวนภาพทั้งหมดออกมาเป็น 20 หน้าพอดิบพอดี
    total_parts = min(TARGET_TOTAL_PAGES, total_images)
    print(f"3. คำนวณแบ่งภาพทั้งหมด {total_images} ชิ้น ให้รวมเป็น {total_parts} หน้า...")

    for part_idx in range(total_parts):
        part_num = part_idx + 1
        start_idx = round(part_idx * total_images / total_parts)
        end_idx = round((part_idx + 1) * total_images / total_parts)
        slice_count = end_idx - start_idx
        part_urls = urls[start_idx:end_idx]

        if part_num < start_from_part:
            print(f"   [ข้าม] หน้า {part_num:03d} ได้รับการอัปโหลดไปแล้ว")
            continue

        print(f"\n--- กำลังทำ [{part_num}/{total_parts}] {part_num:03d} (ชิ้นที่ {start_idx + 1} ถึง {end_idx}, รวม {slice_count} ชิ้น) ---")

        processed_images = []
        total_height = 0

        for i, u in enumerate(part_urls):
            img_bytes = download_image(u)
            if not img_bytes:
                print(f"   [ชิ้น {start_idx + i + 1}] ข้ามภาพที่ไม่สามารถโหลดได้")
                continue
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            
            # ถ้าขนาดไม่เท่ากับ standard_width ให้ resize ตามสัดส่วน
            if pil_img.width != standard_width:
                scale = standard_width / pil_img.width
                scaled_h = round(pil_img.height * scale)
                pil_img = pil_img.resize((standard_width, scaled_h), Image.Resampling.LANCZOS)
                print(f"   [ชิ้น {start_idx + i + 1}] ปรับสเกลเป็น {standard_width}x{scaled_h}")

            processed_images.append(pil_img)
            total_height += pil_img.height

        if not processed_images:
            print(f"   [เตือน] หน้า {part_num:03d} ไม่มีภาพที่โหลดสำเร็จ ข้ามหน้านี้")
            continue

        print(f"   รวมความสูง: {total_height}px (ขนาด canvas: {standard_width}x{total_height})")

        # รวมภาพเป็น strip เดียว
        strip_canvas = Image.new("RGB", (standard_width, total_height), color=(255, 255, 255))
        current_y = 0
        for p_img in processed_images:
            strip_canvas.paste(p_img, (0, current_y))
            current_y += p_img.height

        # มาตรฐานบันทึกเป็น .jpg (image/jpeg) เสมอ
        ext = "jpg"
        mime_type = "image/jpeg"
        part_file_name = f"{part_num:03d}.jpg"

        img_buf = io.BytesIO()
        strip_canvas.save(img_buf, format="JPEG", quality=90, optimize=True)
        
        img_bytes = img_buf.getvalue()
        file_size_kb = len(img_bytes) / 1024
        print(f"   สร้างไฟล์ {part_file_name} ขนาด {file_size_kb:.1f} KB")

        # แปลงเป็น Base64
        b64_str = base64.b64encode(img_bytes).decode('utf-8')
        data_url = f"data:{mime_type};base64," + b64_str

        # อัปโหลดเข้า Google Drive: แปลจนเมื่อย / 我！天命大反派 / 第366话
        is_last = (part_idx == total_parts - 1)
        print(f"   กำลังอัปโหลด {part_file_name} ขึ้น Google Drive...")

        chapter_title = data.get("title") or CHAPTER_NAME
        upload_res = call_gas("UPLOAD_CHAPTER_STITCHED_PART", {
            "mangaName": manga_thai_name,
            "chapter": chapter_title,
            "partIndex": part_num,
            "totalParts": total_parts,
            "fileName": part_file_name,
            "mimeType": mime_type,
            "base64Data": data_url,
            "isLastPart": is_last,
            "clearFolder": (part_num == 1),
            "mangaId": str(data.get("mangaId") or "4"),
            "skipQueue": True,
            "isTest": True
        })

        if upload_res.get("status") == "success":
            up_data = upload_res["data"]
            print(f"   ✓ อัปโหลด {part_file_name} สำเร็จ! Drive Link: {up_data.get('fileUrl')}")
            if is_last:
                print(f"\n🎉 อัปโหลดครบทั้ง {total_parts} หน้าเรียบร้อยแล้ว!")
                print(f"📂 Folder Google Drive: {up_data.get('folderUrl')}")
        else:
            print(f"   ❌ อัปโหลดผิดพลาด: {upload_res}")
            break

if __name__ == "__main__":
    main()

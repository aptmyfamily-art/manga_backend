import sys
import os
import time
import re
import io
import base64
import json
import urllib.request
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

GAS_URL = "https://script.google.com/macros/s/AKfycbzG1H1eBoTsF7Omfso8v23N6HidWXU4kS-yyf0xDunb2BoZgPiUYPIOO2vMLSvYWwHsnw/exec"
PASSCODE = "10211032"
TARGET_TOTAL_PAGES = 20
COOLDOWN_SECONDS = 300  # พัก 5 นาทีระหว่างตอน

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
    คงค่า Query Token ?sign=...&t=... ไว้สำหรับ fallback เมื่อ f2 คืนค่า 404
    """
    raw_url = item if isinstance(item, str) else (item.get("rawUrl") or item.get("url"))
    clean_url = item if isinstance(item, str) else (item.get("url") or item.get("rawUrl"))

    candidates = []
    if clean_url:
        candidates.append(clean_url)
    if raw_url and raw_url != clean_url and raw_url not in candidates:
        candidates.append(raw_url)

    match = re.match(r"^https?://([a-zA-Z0-9-]+)\.kkmh\.com/image/(.+)$", raw_url or clean_url or "")
    if match:
        subdomain = match.group(1).lower()
        full_path = match.group(2)
        clean_path = re.sub(r"-t\.w\d+.*$", "", full_path)
        clean_path = re.sub(r"-w\d+.*$", "", clean_path).split("?")[0]
        query = ("?" + full_path.split("?", 1)[1]) if "?" in full_path else ""

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
                with urllib.request.urlopen(req, timeout=15) as resp:
                    data = resp.read()
                    if len(data) > 0:
                        return data
            except Exception:
                time.sleep(0.3 * attempt)

    print(f"   [download_image] ข้ามชิ้นส่วนที่ไม่สามารถโหลดได้จาก CDN ทั้งหมด: {clean_url}")
    return None

def countdown_sleep(seconds):
    """
    นับถอยหลังพักระหว่างตอนแบบ Real-time terminal timer
    """
    print(f"\n☕ จบตอนแล้ว! พัก {seconds // 60} นาที เพื่อความปลอดภัยของบัญชี KuaiKan VIP...")
    for remaining in range(seconds, 0, -1):
        mins = remaining // 60
        secs = remaining % 60
        print(f"\r   ⏳ นับถอยหลัง: {mins:02d}:{secs:02d} ... (กด Ctrl+C เพื่อข้ามการพัก)", end="", flush=True)
        try:
            time.sleep(1)
        except KeyboardInterrupt:
            print("\n   ⏩ ข้ามการพัก 5 นาที เริ่มตอนต่อไปทันที!")
            return
    print("\n   ✓ ครบเวลาพัก 5 นาทีแล้ว เริ่มทำตอนถัดไปทันที!\n")

def process_single_chapter(task):
    """
    ประมวลผล 1 ตอน: ดึงภาพ -> เย็บ 20 หน้า (001-020) -> อัปโหลดขึ้น Drive -> ลงคิวงาน WorkQueue
    """
    manga_name = task.get("mangaName") or "มังงะ"
    chapter_title = task.get("chapterTitle") or f"第{task.get('chapterNum')}话"
    comic_id = task.get("comicId")
    manga_id = str(task.get("mangaId") or "")
    chapter_num = task.get("chapterNum")

    print(f"\n=======================================================")
    print(f"📖 กำลังประมวลผล: {manga_name} | {chapter_title} (ComicID: {comic_id})")
    print(f"=======================================================")

    # 1. ดึงภาพตอนจาก GAS
    print(f"1. ดึงข้อมูลภาพของ ComicID {comic_id}...")
    res = call_gas("TEST_KUAIKAN_CHAPTER", {"comicId": comic_id})
    if not res.get("status") == "success" or not res.get("data"):
        print(f"❌ ดึงข้อมูลภาพไม่สำเร็จ: {res}")
        return False

    data = res["data"]
    urls = data.get("imageDetails") or data.get("allImages") or data.get("sampleImages") or []
    total_images = len(urls)
    thai_name = data.get("thaiTitle") or data.get("mangaName") or manga_name

    print(f"✓ พบทั้งหมด {total_images} ชิ้นภาพ (เรื่องไทย: {thai_name}, ตอน: {data.get('title')})")
    if not urls:
        print("❌ ไม่พบรูปภาพในตอนนี้ ข้าม")
        return False

    # 2. วัดขนาดความกว้างมาตรฐานจากชิ้นกึ่งกลาง
    sample_idx = 29 if total_images >= 30 else total_images // 2
    sample_bytes = download_image(urls[sample_idx])
    if not sample_bytes:
        sample_bytes = download_image(urls[0])
    sample_img = Image.open(io.BytesIO(sample_bytes))
    standard_width = sample_img.width
    print(f"✓ ความกว้างมาตรฐานคือ {standard_width}px")

    # 3. รวมชิ้นภาพแบ่งออกเป็น 20 หน้า (001-020)
    total_parts = min(TARGET_TOTAL_PAGES, total_images)
    print(f"2. กำลังเย็บภาพทั้งหมด {total_images} ชิ้น รวมเป็น {total_parts} หน้า...")

    last_folder_url = ""

    for part_idx in range(total_parts):
        part_num = part_idx + 1
        start_idx = round(part_idx * total_images / total_parts)
        end_idx = round((part_idx + 1) * total_images / total_parts)
        slice_count = end_idx - start_idx
        part_urls = urls[start_idx:end_idx]

        processed_images = []
        total_height = 0

        for i, u in enumerate(part_urls):
            img_bytes = download_image(u)
            if not img_bytes:
                continue
            pil_img = Image.open(io.BytesIO(img_bytes)).convert("RGB")
            if pil_img.width != standard_width:
                scale = standard_width / pil_img.width
                scaled_h = round(pil_img.height * scale)
                pil_img = pil_img.resize((standard_width, scaled_h), Image.Resampling.LANCZOS)
            processed_images.append(pil_img)
            total_height += pil_img.height

        if not processed_images:
            continue

        strip_canvas = Image.new("RGB", (standard_width, total_height), color=(255, 255, 255))
        current_y = 0
        for p_img in processed_images:
            strip_canvas.paste(p_img, (0, current_y))
            current_y += p_img.height

        use_jpeg = total_height > 16000
        ext = "jpg" if use_jpeg else "webp"
        mime_type = "image/jpeg" if use_jpeg else "image/webp"
        part_file_name = f"{part_num:03d}.{ext}"

        img_buf = io.BytesIO()
        if use_jpeg:
            strip_canvas.save(img_buf, format="JPEG", quality=88, optimize=True)
        else:
            strip_canvas.save(img_buf, format="WEBP", quality=92, method=4)

        img_bytes = img_buf.getvalue()
        b64_str = base64.b64encode(img_bytes).decode('utf-8')
        data_url = f"data:{mime_type};base64," + b64_str

        is_last = (part_idx == total_parts - 1)
        print(f"   [{part_num:02d}/{total_parts}] กำลังอัปโหลด {part_file_name} ({len(img_bytes)/1024:.1f} KB)...", end="", flush=True)

        upload_res = call_gas("UPLOAD_CHAPTER_STITCHED_PART", {
            "mangaName": thai_name,
            "chapter": chapter_title,
            "partIndex": part_num,
            "totalParts": total_parts,
            "fileName": part_file_name,
            "mimeType": mime_type,
            "base64Data": data_url,
            "isLastPart": is_last,
            "clearFolder": (part_num == 1),
            "mangaId": manga_id,
            "skipQueue": False,  # ลงคิวงาน WorkQueue อัตโนมัติเมื่อครบหน้าสุดท้าย
            "isTest": False
        })

        if upload_res.get("status") == "success":
            up_data = upload_res.get("data", {})
            last_folder_url = up_data.get("folderUrl") or last_folder_url
            print(" ✓ สำเร็จ")
        else:
            print(f" ❌ ผิดพลาด: {upload_res.get('message')}")

    print(f"\n🎉 อัปโหลด {manga_name} {chapter_title} ครบทั้ง {total_parts} หน้า และลงคิวงานเรียบร้อยแล้ว!")
    print(f"📂 Google Drive: {last_folder_url}")

    # 4. อัปเดตสถานะใน Mangas และ RawTracker
    print(f"3. บันทึกสถานะตอน {chapter_num} ลงฐานข้อมูล Mangas & RawTracker...")
    comp_res = call_gas("COMPLETE_RAW_TRACKER_CHAPTER", {
        "mangaId": manga_id,
        "chapterNum": chapter_num
    })
    print(f"✓ บันทึกสถานะเรียบร้อย: {comp_res.get('message')}")
    return True

def main():
    target_tracker_id = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "--all" else None
    print("=================================================================")
    print("🚀 Auto Raw Pipeline: ติดตามต้นฉบับอัปเดต -> โหลด -> เย็บ -> อัป -> ลงคิวงาน")
    print(f"⏱️ กฎความปลอดภัย: จบ 1 ตอน พัก {COOLDOWN_SECONDS // 60} นาที ก่อนเริ่มตอนต่อไป")
    print("=================================================================")

    print("\n1. กำลังสแกนรายการตอนใหม่ทั้งหมดจาก RawTracker...")
    res = call_gas("GET_RAW_TRACKER_PENDING_CHAPTERS", {"trackerId": target_tracker_id})
    if not res.get("status") == "success" or not res.get("data"):
        print("❌ เกิดข้อผิดพลาดในการดึงรายการตอนใหม่:", res)
        return

    data = res["data"]
    tasks = data.get("tasks", [])
    total_tasks = len(tasks)
    print(f"✓ พบตอนใหม่ที่รออัป raw ทั้งหมด {total_tasks} ตอน:")
    for idx, t in enumerate(tasks):
        print(f"   [{idx + 1:02d}/{total_tasks}] {t.get('mangaName')} | {t.get('chapterTitle')} (ComicID: {t.get('comicId')})")

    if not tasks:
        print("\n✨ ไม่มีตอนใหม่ที่ค้างอยู่ ระบบเป็นปัจจุบันครบทั้งหมดแล้วครับ!")
        return

    # ลูปประมวลผลทีละตอน
    completed_count = 0
    for idx, task in enumerate(tasks):
        print(f"\n>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>")
        print(f"คิวงานที่ [{idx + 1}/{total_tasks}]: {task.get('mangaName')} {task.get('chapterTitle')}")
        print(f"<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<")

        success = process_single_chapter(task)
        if success:
            completed_count += 1

        # จบ 1 ตอน ให้พัก 5 นาที (ถ้ายังมีตอนถัดไป)
        if idx < total_tasks - 1:
            countdown_sleep(COOLDOWN_SECONDS)

    print("\n=================================================================")
    print(f"🏁 ทำงานเสร็จสิ้นทั้งหมด {completed_count}/{total_tasks} ตอนเรียบร้อยแล้ว!")
    print("=================================================================")

if __name__ == "__main__":
    main()

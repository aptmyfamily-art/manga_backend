#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ThunderScans Standalone Extractor & Verification Tool
=====================================================
Target Site: https://en-thunderscans.com/
Architecture: WordPress + MangaReader Theme (ts_reader)

Capabilities:
1. Extract chapter images from free chapters via `ts_reader.run`.
2. Support optional session cookies (`--cookie` or `THUNDERSCANS_COOKIE` env var) for coin-locked chapters.
3. Detect chapter status: FREE, LOCKED (with price, unlock countdown, post ID), or PURCHASED.
4. Dynamically measure image slice width using slice #15 or middle slice.
5. Verify header requirements (User-Agent, Referer) during slice downloads.
6. Optional sample or full chapter download for verification.
"""

import sys
import os
import io
import re
import json
import time
import argparse
import urllib.request
import urllib.error
from PIL import Image

sys.stdout.reconfigure(encoding='utf-8')

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)
DEFAULT_REFERER = "https://en-thunderscans.com/"


class ThunderScansExtractor:
    def __init__(self, cookie: str = None, user_agent: str = None):
        self.cookie = cookie or os.environ.get("THUNDERSCANS_COOKIE", "").strip()
        self.user_agent = user_agent or DEFAULT_USER_AGENT
        self.referer = DEFAULT_REFERER

    def _build_headers(self, custom_referer: str = None, include_cookie: bool = True) -> dict:
        headers = {
            "User-Agent": self.user_agent,
            "Referer": custom_referer if custom_referer is not None else self.referer,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,th;q=0.8",
        }
        if include_cookie and self.cookie:
            headers["Cookie"] = self.cookie
        return headers

    def fetch_page(self, url: str) -> tuple:
        """
        Fetch HTML page content with configured headers and cookies.
        Returns: (html_text, status_code, final_url)
        """
        headers = self._build_headers()
        req = urllib.request.Request(url, headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=20) as resp:
                status_code = resp.status
                final_url = resp.geturl()
                html = resp.read().decode('utf-8', errors='ignore')
                return html, status_code, final_url
        except urllib.error.HTTPError as e:
            html = e.read().decode('utf-8', errors='ignore')
            return html, e.code, url
        except Exception as e:
            raise RuntimeError(f"Network error fetching {url}: {e}")

    def check_auth_state(self, html: str) -> dict:
        """
        Check if the current request session is authenticated in WordPress.
        """
        is_logged_in = False
        user_info = {}

        # Standard WordPress body class 'logged-in'
        if re.search(r'<body[^>]*class="[^"]*\blogged-in\b[^"]*"', html):
            is_logged_in = True

        # Check for user avatar or username in navigation bar
        user_match = re.search(r'<span[^>]*class="user-name"[^>]*>([^<]+)</span>', html)
        if user_match:
            user_info["username"] = user_match.group(1).strip()
            is_logged_in = True

        # Check for logout link
        if 'action=logout' in html or '/logout/' in html:
            is_logged_in = True

        return {
            "is_logged_in": is_logged_in,
            "user_info": user_info,
            "has_cookie": bool(self.cookie)
        }

    def analyze_chapter(self, url: str) -> dict:
        """
        Extract full chapter details, analyze unlock state, and retrieve image URLs.
        """
        html, status_code, final_url = self.fetch_page(url)
        auth = self.check_auth_state(html)

        # 1. Extract titles
        manga_title = ""
        chapter_title = ""
        m_title = re.search(r'<h1[^>]*class="(?:entry-title|lock-title)"[^>]*>(.*?)</h1>', html, re.DOTALL)
        if not m_title:
            m_title = re.search(r'<title>(.*?)</title>', html)
        if m_title:
            raw_title = re.sub(r'<[^>]+>', ' ', m_title.group(1)).strip()
            # Clean common entities
            raw_title = raw_title.replace('&rsquo;', "'").replace('&#8217;', "'").replace('&nbsp;', ' ')
            raw_title = re.sub(r'\s*&#8211;.*$', '', raw_title)  # Remove site suffix
            raw_title = re.sub(r'\s*-\s*Thunderscans.*$', '', raw_title, flags=re.I)
            chapter_title = raw_title

            # Attempt to split manga name and chapter: "Manga Name Chapter 62" or "Manga Name - Chapter 62"
            ch_match = re.search(r'^(.*?)(?:[-–—\s]+)\bChapter\s+(\d+.*)$', raw_title, flags=re.I)
            if ch_match:
                manga_title = ch_match.group(1).strip()
            else:
                manga_title = raw_title

        # Breadcrumbs / back-link fallback for manga title
        if not manga_title or manga_title == chapter_title:
            series_link = re.search(r'href="https?://en-thunderscans\.com/comics/([^"/]+)/?"[^>]*>([^<]+)</a>', html)
            if series_link and 'series' not in series_link.group(2).lower():
                manga_title = series_link.group(2).strip()

        # 2. Check for ts_reader.run (Free or Unlocked Chapter)
        ts_match = re.search(r'ts_reader\.run\((\{.*?\})\);', html, re.DOTALL)
        if ts_match:
            try:
                reader_data = json.loads(ts_match.group(1))
            except Exception as e:
                raise ValueError(f"Failed to parse ts_reader JSON: {e}")

            post_id = reader_data.get("post_id")
            sources = reader_data.get("sources", [])
            images = []
            server_name = "Default"
            if sources:
                server_name = sources[0].get("source", "Server 1")
                images = sources[0].get("images", [])

            # Check if this chapter was unlocked via cookie purchase
            status = "FREE"
            if auth["is_logged_in"] and ("coins" in html.lower() or "purchased" in html.lower()):
                status = "PURCHASED"

            return {
                "status": status,
                "url": url,
                "manga_title": manga_title or "Unknown Manga",
                "chapter_title": chapter_title or f"Post #{post_id}",
                "post_id": post_id,
                "server": server_name,
                "total_images": len(images),
                "images": images,
                "prev_url": reader_data.get("prevUrl"),
                "next_url": reader_data.get("nextUrl"),
                "auth": auth,
            }

        # 3. Chapter is Locked (Coin-locked / Fast Pass)
        is_locked = bool(re.search(r'class="[^"]*lock-[^"]*"', html) or 'This chapter is locked' in html)
        lock_info = {
            "coins_required": None,
            "free_release_date": None,
            "chapter_post_id": None,
            "message": "This chapter is locked and requires coins to read."
        }

        # Extract coins requirement
        coin_match = re.search(r'<span[^>]*class="coin-amount"[^>]*>(\d+)</span>', html)
        if not coin_match:
            coin_match = re.search(r'(\d+)\s*Coins?', html, re.I)
        if coin_match:
            lock_info["coins_required"] = int(coin_match.group(1))

        # Extract countdown / free release date
        timer_match = re.search(r'id="countdown-timer"[^>]*>([^<]+)<', html)
        if timer_match:
            lock_info["free_release_date"] = timer_match.group(1).strip()

        # Extract post ID from buyChapter(id)
        buy_match = re.search(r'buyChapter\((\d+)\)', html)
        if buy_match:
            lock_info["chapter_post_id"] = int(buy_match.group(1))

        return {
            "status": "LOCKED" if is_locked else "UNKNOWN",
            "url": url,
            "manga_title": manga_title or "Unknown Manga",
            "chapter_title": chapter_title or "Locked Chapter",
            "lock_info": lock_info,
            "auth": auth,
            "total_images": 0,
            "images": []
        }

    def measure_slice_width(self, images: list) -> dict:
        """
        Dynamically measure slice width from slice #15 (index 14) or middle slice.
        Returns detailed dimensions and format info.
        """
        if not images:
            raise ValueError("No images available to measure width.")

        total_images = len(images)
        # Choose slice #15 (index 14) if total >= 15, else middle slice
        target_idx = 14 if total_images >= 15 else (total_images // 2)
        target_url = images[target_idx]

        headers = self._build_headers()
        req = urllib.request.Request(target_url, headers=headers)
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()

        img = Image.open(io.BytesIO(data))
        return {
            "sample_index": target_idx + 1,
            "sample_url": target_url,
            "standard_width": img.width,
            "height": img.height,
            "format": img.format,
            "mode": img.mode,
            "byte_size": len(data),
            "byte_size_kb": round(len(data) / 1024, 2)
        }

    def verify_download_headers(self, image_url: str) -> dict:
        """
        Verify header and referer requirements by testing different configurations:
        1. Default Python UA (tests if blocked)
        2. Browser UA without Referer
        3. Browser UA + ThunderScans Referer
        """
        results = {}

        # 1. Test default urllib User-Agent (no custom headers)
        try:
            req_default = urllib.request.Request(image_url)
            with urllib.request.urlopen(req_default, timeout=10) as r:
                results["default_python_ua"] = {
                    "success": True,
                    "status": r.status,
                    "note": "Allowed without custom UA"
                }
        except urllib.error.HTTPError as e:
            results["default_python_ua"] = {
                "success": False,
                "status": e.code,
                "note": f"Blocked with HTTP {e.code} (Standard anti-bot protection)"
            }
        except Exception as e:
            results["default_python_ua"] = {
                "success": False,
                "status": "error",
                "note": str(e)
            }

        # 2. Test Browser UA without Referer
        try:
            req_ua = urllib.request.Request(image_url, headers={"User-Agent": self.user_agent})
            with urllib.request.urlopen(req_ua, timeout=10) as r:
                data = r.read()
                results["browser_ua_no_referer"] = {
                    "success": True,
                    "status": r.status,
                    "bytes": len(data),
                    "note": "Success! Referer header is optional for image CDN"
                }
        except Exception as e:
            results["browser_ua_no_referer"] = {
                "success": False,
                "note": str(e)
            }

        # 3. Test Browser UA + Full Referer
        try:
            req_full = urllib.request.Request(image_url, headers=self._build_headers())
            with urllib.request.urlopen(req_full, timeout=10) as r:
                data = r.read()
                img = Image.open(io.BytesIO(data))
                results["browser_ua_with_referer"] = {
                    "success": True,
                    "status": r.status,
                    "bytes": len(data),
                    "image_valid": True,
                    "dimensions": f"{img.width}x{img.height}",
                    "note": "Optimal configuration (Mimics real browser navigation)"
                }
        except Exception as e:
            results["browser_ua_with_referer"] = {
                "success": False,
                "note": str(e)
            }

        return results

    def download_slice(self, image_url: str, save_path: str) -> bool:
        """
        Download a single image slice to local file using standard headers.
        """
        headers = self._build_headers()
        req = urllib.request.Request(image_url, headers=headers)
        with urllib.request.urlopen(req, timeout=25) as resp:
            data = resp.read()

        # Validate with PIL before saving
        img = Image.open(io.BytesIO(data))
        os.makedirs(os.path.dirname(os.path.abspath(save_path)), exist_ok=True)
        with open(save_path, "wb") as f:
            f.write(data)
        return True


def main():
    parser = argparse.ArgumentParser(description="ThunderScans Extractor & Prototype Verification")
    parser.add_argument(
        "--url",
        default="https://en-thunderscans.com/the-clans-failure-is-a-former-continental-champion-chapter-58/",
        help="Chapter URL to extract or analyze"
    )
    parser.add_argument(
        "--cookie",
        default="",
        help="WordPress session cookie (or set THUNDERSCANS_COOKIE env var)"
    )
    parser.add_argument(
        "--download-sample",
        action="store_true",
        default=True,
        help="Verify headers and download dynamic sample slice"
    )
    parser.add_argument(
        "--download-all",
        action="store_true",
        help="Download all slices of the chapter"
    )
    parser.add_argument(
        "--output-dir",
        default="./downloads/thunderscans",
        help="Output directory for downloaded images"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output raw JSON results"
    )

    args = parser.parse_args()

    extractor = ThunderScansExtractor(cookie=args.cookie)

    print("=" * 70)
    print("⚡ THUNDERSCANS CONNECTOR TEST & EXTRACTION")
    print("=" * 70)
    print(f"Target URL: {args.url}")
    print(f"Cookie: {'[PROVIDED]' if extractor.cookie else '[NONE / ANONYMOUS]'}")
    print("-" * 70)

    # 1. Analyze Chapter
    result = extractor.analyze_chapter(args.url)
    status = result["status"]

    print(f"▶ Manga: {result['manga_title']}")
    print(f"▶ Chapter: {result['chapter_title']}")
    print(f"▶ Status: {status}")
    print(f"▶ Auth State: Logged-in={result['auth']['is_logged_in']}")

    if status == "LOCKED":
        lock = result["lock_info"]
        print("\n🔒 [LOCKED CHAPTER DETECTED]")
        print(f"   • Post ID: {lock.get('chapter_post_id')}")
        print(f"   • Price: {lock.get('coins_required')} Coins")
        print(f"   • Free Release Date: {lock.get('free_release_date')}")
        print(f"   • Note: Pass a valid WordPress session cookie (--cookie) for unlocked reading.")
        if args.json:
            print("\n--- JSON OUTPUT ---")
            print(json.dumps(result, indent=2, ensure_ascii=False))
        return

    # Free or Purchased Chapter
    total_imgs = result["total_images"]
    images = result["images"]
    print(f"▶ Total Images Extracted: {total_imgs} slices (Server: {result.get('server')})")

    # 2. Measure Slice Width
    slice_meta = extractor.measure_slice_width(images)
    print("\n📏 [DYNAMIC SLICE WIDTH MEASUREMENT]")
    print(f"   • Sample Slice #{slice_meta['sample_index']} of {total_imgs}")
    print(f"   • Standard Width: {slice_meta['standard_width']}px")
    print(f"   • Height: {slice_meta['height']}px")
    print(f"   • Format: {slice_meta['format']}")
    print(f"   • File Size: {slice_meta['byte_size_kb']} KB")
    print(f"   • URL: {slice_meta['sample_url']}")

    # 3. Verify Download Headers
    print("\n🛡️ [HEADER & REFERER VERIFICATION]")
    header_test = extractor.verify_download_headers(slice_meta["sample_url"])
    for test_key, res in header_test.items():
        icon = "✓" if res.get("success") else "✗"
        print(f"   {icon} {test_key}: {res.get('note')} (HTTP {res.get('status', 'N/A')})")

    # 4. Save sample slice
    if args.download_sample or args.download_all:
        sample_filename = f"sample_slice_{slice_meta['sample_index']:03d}.webp"
        sample_path = os.path.join(args.output_dir, sample_filename)
        extractor.download_slice(slice_meta["sample_url"], sample_path)
        print(f"\n💾 [SAMPLE DOWNLOAD]")
        print(f"   ✓ Successfully downloaded & validated: {sample_path}")

    # 5. Full download if requested
    if args.download_all:
        print(f"\n📥 [DOWNLOADING ALL {total_imgs} SLICES]")
        for idx, img_url in enumerate(images):
            slice_name = f"slice_{(idx + 1):03d}.webp"
            target_path = os.path.join(args.output_dir, slice_name)
            extractor.download_slice(img_url, target_path)
            print(f"   ✓ [{(idx + 1):02d}/{total_imgs:02d}] Saved {slice_name}")
        print(f"✓ All slices saved to: {os.path.abspath(args.output_dir)}")

    if args.json:
        result["slice_measurement"] = slice_meta
        result["header_verification"] = header_test
        print("\n--- JSON OUTPUT ---")
        print(json.dumps(result, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()

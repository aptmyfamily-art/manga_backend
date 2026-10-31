import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { callGasApi } from "@/api/gasClient"
import { toast } from "sonner"
import {
  Zap,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Download,
  FolderOpen,
  Image as ImageIcon,
  LogOut,
  Copy,
  Bookmark,
  BookOpen,
  Scissors,
  Layers,
  AlertTriangle,
} from "lucide-react"

interface KuaiKanLoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const GAS_EXEC_URL =
  "https://script.google.com/macros/s/AKfycbzG1H1eBoTsF7Omfso8v23N6HidWXU4kS-yyf0xDunb2BoZgPiUYPIOO2vMLSvYWwHsnw/exec"

/**
 * Root Folder ID ใน Google Drive: แปลจนเมื่อย
 */
const DRIVE_ROOT_FOLDER_ID = "1hA_5XjT1gLnzrAOFpT-COVfIbuSfVG6_"

/**
 * แปลงลิงก์ CDN ของ KuaiKan ให้เป็น f2.kkmh.com Full HD เพื่อหลีกเลี่ยง 403 Forbidden และแสดงผลได้ 100%
 */
function normalizeKuaikanImageUrl(url: string): string {
  if (!url) return ""
  let u = String(url).trim()
  u = u.replace(/https?:\/\/tn\d+(?:-f\d+)?\.kkmh\.com/g, "https://f2.kkmh.com")
  u = u.replace(/-t\.w\d+.*$/i, "")
  u = u.replace(/-w\d+.*$/i, "")
  return u
}

/**
 * Helper โหลดรูปเข้า HTMLImageElement สำหรับนำไปวาดบน Canvas
 */
function loadImageElement(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.referrerPolicy = "no-referrer"
    img.onload = () => resolve(img)
    img.onerror = () => {
      // Retry once
      const retry = new Image()
      retry.crossOrigin = "anonymous"
      retry.referrerPolicy = "no-referrer"
      retry.onload = () => resolve(retry)
      retry.onerror = () => reject(new Error(`โหลดภาพไม่สำเร็จ: ${url.substring(0, 45)}...`))
      retry.src = url
    }
    img.src = url
  })
}

export function KuaiKanLoginModal({
  open,
  onClose,
  onSuccess,
}: KuaiKanLoginModalProps) {
  // Main view tab: "sync" (Connect VIP) vs "test" (Chapter 366 Download)
  const [mainTab, setMainTab] = React.useState<"sync" | "test">("sync")

  // Sync sub-method: "1click" | "qr" | "cookie" | "html"
  const [syncMethod, setSyncMethod] = React.useState<"1click" | "qr" | "cookie" | "html">("1click")
  const [htmlInput, setHtmlInput] = React.useState("")
  const [parsingHtml, setParsingHtml] = React.useState(false)

  // Session state
  const [loadingSession, setLoadingSession] = React.useState(false)
  const [sessionStatus, setSessionStatus] = React.useState<{
    loggedIn: boolean
    isVip?: boolean
    updatedAt?: string
    cookiePreview?: string
    message?: string
  } | null>(null)

  // QR Login state
  const [qrLoading, setQrLoading] = React.useState(false)
  const [qrData, setQrData] = React.useState<{
    uuid: string
    state: string
    cookies: string[]
    qrUrl: string
  } | null>(null)
  const [qrStatusText, setQrStatusText] = React.useState<string>("รอการสแกน...")
  const [scanState, setScanState] = React.useState<"waiting" | "scanned" | "success" | "expired" | "idle">("idle")
  const pollingRef = React.useRef<boolean>(false)
  const autoDetectRef = React.useRef<boolean>(false)

  // Manual Cookie state
  const [cookieInput, setCookieInput] = React.useState("")
  const [savingCookie, setSavingCookie] = React.useState(false)

  // Test Chapter state
  const [testingChapter, setTestingChapter] = React.useState(false)
  const [testResult, setTestResult] = React.useState<any | null>(null)

  // Download state
  const [downloading, setDownloading] = React.useState(false)
  const [downloadResult, setDownloadResult] = React.useState<any | null>(null)

  // Stitch & Upload state (เย็บ 20 หน้า/ไฟล์ ลง Google Drive แปลจนเมื่อย)
  const [stitching, setStitching] = React.useState(false)
  const [stitchProgress, setStitchProgress] = React.useState<{
    currentPart: number
    totalParts: number
    pageRange: string
    percent: number
    statusText: string
    folderUrl?: string
    error?: string
  } | null>(null)
  const [driveAuthError, setDriveAuthError] = React.useState<string | null>(null)

  // Bookmarklet JavaScript Code (ดึงภาพจาก .img-box โดยตรง 100% ตรงตามหน้าเว็บ KuaiKan)
  const bookmarkletCode = React.useMemo(() => {
    return `javascript:(function(){try{var c=document.cookie;var imgs=[];var boxes=document.querySelectorAll('.img-box');if(boxes.length){boxes.forEach(function(b){var img=b.querySelector('img[data-src]')||b.querySelector('img');if(img){var u=img.getAttribute('data-src')||img.src;if(u&&imgs.indexOf(u)===-1)imgs.push(u);}});}if(!imgs.length){document.querySelectorAll('img[data-src*="kkmh.com"], img[src*="kkmh.com"]').forEach(function(img){var u=img.getAttribute('data-src')||img.src;if(u&&(u.indexOf('/image/c')!==-1||u.indexOf('c855368')!==-1)&&imgs.indexOf(u)===-1)imgs.push(u);});}var m=window.location.pathname.match(/\\/comic(?:-next)?\\/(\\d+)/);var cid=m?parseInt(m[1]):855368;var title=document.querySelector('h1, .title, .comic-title')?.innerText?.trim()||'第366话 真真假假';var topic=document.querySelector('.topic-title, .sub-title, a[href*="/topic/"]')?.innerText?.trim()||'我！天命大反派';var u='${GAS_EXEC_URL}';fetch(u,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_KUAIKAN_AUTH',passcode:'10211032',payload:{directCookie:c,comicId:cid,title:title,topicTitle:topic,images:imgs}})}).then(function(){alert('🎉 ดึงภาพจาก .img-box สำเร็จครบทั้ง '+imgs.length+' ภาพ และส่งให้ MangaHub เรียบร้อยแล้ว!');}).catch(function(e){alert('Error: '+e.message);});}catch(err){alert('Error: '+err.message);}})();`
  }, [])

  // Console Code (ดึงภาพจาก .img-box โดยตรง 100% ตรงตามหน้าเว็บ KuaiKan)
  const consoleCode = React.useMemo(() => {
    return `(()=>{try{var c=document.cookie,imgs=[],boxes=document.querySelectorAll('.img-box');if(boxes.length){boxes.forEach(b=>{var img=b.querySelector('img[data-src]')||b.querySelector('img');if(img){var u=img.getAttribute('data-src')||img.src;if(u&&!imgs.includes(u))imgs.push(u);}});}if(!imgs.length){document.querySelectorAll('img[data-src*="kkmh.com"], img[src*="kkmh.com"]').forEach(img=>{var u=img.getAttribute('data-src')||img.src;if(u&&(u.includes('/image/c')||u.includes('c855368'))&&!imgs.includes(u))imgs.push(u);});}var m=location.pathname.match(/\\/comic(?:-next)?\\/(\\d+)/),cid=m?parseInt(m[1]):855368,title=document.querySelector('h1, .title, .comic-title')?.innerText?.trim()||'第366话 真真假假',topic=document.querySelector('.topic-title, .sub-title, a[href*="/topic/"]')?.innerText?.trim()||'我！天命大反派';fetch('${GAS_EXEC_URL}',{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_KUAIKAN_AUTH',passcode:'10211032',payload:{directCookie:c,comicId:cid,title:title,topicTitle:topic,images:imgs}})}).then(()=>alert('🎉 ดึงภาพจาก .img-box สำเร็จครบทั้ง '+imgs.length+' ภาพ และส่งให้ MangaHub เรียบร้อยแล้ว!'));}catch(e){alert('Error: '+e.message);}})();`
  }, [])

  // Check saved session
  const fetchSessionStatus = React.useCallback(async (silent = false) => {
    if (!silent) setLoadingSession(true)
    try {
      const res = await callGasApi<any>("GET_KUAIKAN_AUTH")
      setSessionStatus(res)
      return res
    } catch (err: any) {
      if (!silent) console.error("fetchSessionStatus error:", err)
      return null
    } finally {
      if (!silent) setLoadingSession(false)
    }
  }, [])

  // Auto-detect incoming session sync every 2.5s
  React.useEffect(() => {
    if (!open) {
      autoDetectRef.current = false
      return
    }

    autoDetectRef.current = true
    let isInitial = true

    const interval = setInterval(async () => {
      if (!autoDetectRef.current) return
      const res = await fetchSessionStatus(true)
      if (res && res.loggedIn && !sessionStatus?.loggedIn && !isInitial) {
        toast.success("👑 ตรวจพบ KuaiKan VIP เชื่อมต่อสำเร็จแล้ว!")
        setMainTab("test")
        handleTestChapter()
        if (onSuccess) onSuccess()
      }
      isInitial = false
    }, 2500)

    return () => {
      autoDetectRef.current = false
      clearInterval(interval)
    }
  }, [open, sessionStatus?.loggedIn, fetchSessionStatus, onSuccess])

  React.useEffect(() => {
    if (open) {
      fetchSessionStatus().then((res) => {
        if (res?.loggedIn) {
          setMainTab("test")
        }
      })
      if (syncMethod === "qr") {
        loadQrCode()
      }
    } else {
      pollingRef.current = false
    }
    return () => {
      pollingRef.current = false
    }
  }, [open, syncMethod, fetchSessionStatus])

  // Generate QR session
  const loadQrCode = async () => {
    pollingRef.current = false
    setQrLoading(true)
    setQrData(null)
    setScanState("waiting")
    setQrStatusText("กำลังขอ QR Code...")

    try {
      const res = await callGasApi<any>("GET_KUAIKAN_QR")
      if (res && res.success && res.uuid) {
        setQrData(res)
        setQrStatusText("เปิด WeChat สแกน QR ด้านล่าง")
        startPolling(res.uuid, res.state, res.cookies)
      } else {
        setScanState("expired")
        setQrStatusText(res?.error || "ไม่สามารถขอ QR ได้")
      }
    } catch (err: any) {
      setScanState("expired")
      setQrStatusText(err.message || "เกิดข้อผิดพลาดในการขอ QR")
    } finally {
      setQrLoading(false)
    }
  }

  // Poll WeChat QR Status
  const startPolling = (uuid: string, state: string, cookies: string[]) => {
    pollingRef.current = true

    const pollNext = async () => {
      if (!pollingRef.current) return

      try {
        const pollResult = await new Promise<{ errcode: number; code?: string }>((resolve) => {
          const scriptId = "wx_poll_script_" + Date.now()
          const script = document.createElement("script")
          script.id = scriptId
          script.src = `https://long.open.weixin.qq.com/connect/l/qrconnect?uuid=${uuid}&_=${Date.now()}`
          
          let resolved = false
          const finish = (result: { errcode: number; code?: string }) => {
            if (!resolved) {
              resolved = true
              script.remove()
              resolve(result)
            }
          }

          script.onload = () => {
            const errcode = (window as any).wx_errcode
            const code = (window as any).wx_code
            finish({ errcode: typeof errcode === "number" ? errcode : 408, code })
          }

          script.onerror = () => {
            finish({ errcode: -999 })
          }

          document.body.appendChild(script)
          setTimeout(() => finish({ errcode: 408 }), 25000)
        })

        if (!pollingRef.current) return

        if (pollResult.errcode === 408) {
          setScanState("waiting")
          setQrStatusText("รอการสแกน...")
          setTimeout(pollNext, 1200)
        } else if (pollResult.errcode === 404) {
          setScanState("scanned")
          setQrStatusText("📲 สแกนแล้ว! กดยืนยันบนมือถือ...")
          toast.info("สแกนสำเร็จ! กรุณากดยืนยันบน WeChat")
          setTimeout(pollNext, 800)
        } else if (pollResult.errcode === 405 && pollResult.code) {
          setScanState("success")
          setQrStatusText("🎉 ยืนยันสำเร็จ!")
          toast.success("ยืนยันผ่าน WeChat สำเร็จ!")

          const saveRes = await callGasApi<any>("SAVE_KUAIKAN_AUTH", {
            code: pollResult.code,
            state,
            cookies,
          })

          if (saveRes && saveRes.success) {
            toast.success("บันทึก Session KuaiKan VIP เรียบร้อยแล้ว!")
            fetchSessionStatus()
            setMainTab("test")
            handleTestChapter()
            if (onSuccess) onSuccess()
          } else {
            toast.error(saveRes?.error || "บันทึก Session ไม่สำเร็จ")
          }
        } else if (pollResult.errcode === 402) {
          setScanState("expired")
          setQrStatusText("QR หมดอายุ กดรีเฟรช")
        } else {
          const checkRes = await callGasApi<any>("CHECK_KUAIKAN_QR", {
            uuid,
            state,
            cookies,
          })
          if (checkRes && checkRes.status === "success") {
            setScanState("success")
            toast.success("เข้าสู่ระบบ KuaiKan สำเร็จ!")
            fetchSessionStatus()
            setMainTab("test")
            handleTestChapter()
            if (onSuccess) onSuccess()
          } else {
            setTimeout(pollNext, 2000)
          }
        }
      } catch (e) {
        console.error("Polling error:", e)
        if (pollingRef.current) setTimeout(pollNext, 3000)
      }
    }

    pollNext()
  }

  // Handle direct manual cookie save
  const handleSaveCookie = async () => {
    if (!cookieInput.trim()) {
      toast.error("กรุณาระบุ Cookie เช่น passToken=... หรือ connect.sid=...")
      return
    }

    setSavingCookie(true)
    try {
      const res = await callGasApi<any>("SAVE_KUAIKAN_AUTH", {
        directCookie: cookieInput.trim(),
      })

      if (res && res.success) {
        toast.success("บันทึก Cookie สำเร็จ!")
        setCookieInput("")
        fetchSessionStatus()
        setMainTab("test")
        handleTestChapter()
        if (onSuccess) onSuccess()
      } else {
        toast.error(res?.error || "บันทึก Cookie ไม่สำเร็จ")
      }
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการบันทึก Cookie")
    } finally {
      setSavingCookie(false)
    }
  }

  // Handle parsing raw HTML syntax from <div class="comicDetails"> / <div class="imgList">
  const handleParseHtml = async () => {
    if (!htmlInput.trim()) {
      toast.error("กรุณาวางโค้ด HTML ของตอน เช่น <div class=\"comicDetails\">... หรือ <div class=\"img-box\">...")
      return
    }

    setParsingHtml(true)
    try {
      // 1. Regex อ่าน data-src ภายใน .img-box (format /image/c855368/ หรือ /image/c\d+/)
      const regex = /data-src=["'](https?:\/\/[^"'\s]+kkmh\.com\/image\/c\d+\/[^"'\s]+)["']/gi
      const urls: string[] = []
      let match: RegExpExecArray | null
      while ((match = regex.exec(htmlInput)) !== null) {
        const u = match[1].replace(/&amp;/g, "&")
        if (!urls.includes(u)) urls.push(u)
      }

      // 2. Fallback regex หากไม่มี data-src
      if (urls.length === 0) {
        const fallbackRegex = /https?:\/\/[^"'\s]*kkmh\.com\/image\/c\d+\/[^"'\s<>&]+/gi
        let m2: RegExpExecArray | null
        while ((m2 = fallbackRegex.exec(htmlInput)) !== null) {
          const u = m2[0].replace(/&amp;/g, "&")
          if (!urls.includes(u)) urls.push(u)
        }
      }

      if (urls.length === 0) {
        toast.error("ไม่พบลิงก์ภาพที่ตรงกับ format /image/c<comicId>/ ในโค้ด HTML ที่วาง")
        return
      }

      toast.info(`✓ สกัดภาพจาก HTML สำเร็จ ${urls.length} ภาพ กำลังส่งบันทึกเข้าระบบ...`)

      const saveRes = await callGasApi<any>("SAVE_KUAIKAN_AUTH", {
        comicId: 855368,
        title: "第366话 真真假假",
        topicTitle: "我！天命大反派",
        images: urls,
      })

      if (saveRes && saveRes.success) {
        toast.success(`🎉 บันทึกภาพ ${urls.length} ภาพ เรียบร้อยแล้ว!`)
        setHtmlInput("")
        fetchSessionStatus()
        setMainTab("test")
        handleTestChapter()
        if (onSuccess) onSuccess()
      } else {
        toast.error(saveRes?.error || "บันทึกภาพไม่สำเร็จ")
      }
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการแกะโค้ด HTML")
    } finally {
      setParsingHtml(false)
    }
  }

  // Clear session
  const handleClearSession = async () => {
    if (!confirm("ต้องการยกเลิกการเชื่อมต่อบัญชี KuaiKan ใช่หรือไม่?")) return
    try {
      await callGasApi("CLEAR_KUAIKAN_AUTH")
      toast.info("ออกจากระบบ KuaiKan เรียบร้อยแล้ว")
      setSessionStatus(null)
      setTestResult(null)
      setMainTab("sync")
      if (syncMethod === "qr") loadQrCode()
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาด")
    }
  }

  // Test Chapter 366 (Paid / VIP)
  const handleTestChapter = async () => {
    setTestingChapter(true)
    setTestResult(null)
    try {
      const res = await callGasApi<any>("TEST_KUAIKAN_CHAPTER", {
        comicId: 855368, // Chapter 366 of 我！天命大反派
      })
      setTestResult(res)
      if (res && res.success) {
        if (res.isVipUnlocked && res.imagesCount > 1) {
          toast.success(`🎉 ปลดล็อคสำเร็จ! พบ ${res.imagesCount} ภาพ HD`)
        } else {
          toast.warning("ตอนยังถูกล็อค (อาจยังไม่ใช่ VIP หรือตอนต้องใช้เหรียญซื้อ)")
        }
      } else {
        toast.error(res?.error || "ทดสอบดึงตอนไม่สำเร็จ")
      }
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการทดสอบ")
    } finally {
      setTestingChapter(false)
    }
  }

  // Auto Download to Google Drive
  const handleDownloadChapter = async () => {
    setDownloading(true)
    setDownloadResult(null)
    setDriveAuthError(null)
    try {
      const res = await callGasApi<any>("DOWNLOAD_KUAIKAN_CHAPTER", {
        comicId: 855368,
        mangaId: "1",
        chapter: "366",
        mangaName: "我！天命大反派",
      })
      setDownloadResult(res)
      if (res && res.success) {
        toast.success(`ดาวน์โหลดเรียบร้อย ${res.downloadedCount} ภาพ และนำเข้าคิวงานแล้ว!`)
      } else {
        if (res?.error && (res.error.includes("DriveApp") || res.error.includes("คุณไม่ได้รับอนุญาต") || res.error.includes("permission"))) {
          setDriveAuthError(res.error)
        }
        toast.error(res?.error || "ดาวน์โหลดไม่สำเร็จ")
      }
    } catch (err: any) {
      if (err.message && (err.message.includes("DriveApp") || err.message.includes("คุณไม่ได้รับอนุญาต") || err.message.includes("permission"))) {
        setDriveAuthError(err.message)
      }
      toast.error(err.message || "เกิดข้อผิดพลาดในการดาวน์โหลด")
    } finally {
      setDownloading(false)
    }
  }

  // เย็บภาพ 20 หน้า/ไฟล์ ความกว้างเท่ากันทั้งหมด และอัปโหลดลง Google Drive: แปลจนเมื่อย / {ชื่อเรื่อง} / {เลขตอน}
  const handleStitchAndUpload = async () => {
    if (!testResult) {
      toast.error("กรุณากดทดสอบตอนก่อน")
      return
    }

    const rawUrls: string[] = testResult.allImages || testResult.sampleImages || []
    if (!rawUrls.length) {
      toast.error("ไม่พบรายการภาพ กรุณากดทดสอบตอนหรือซิงค์ Session อีกครั้ง")
      return
    }

    const allUrls = rawUrls.map(normalizeKuaikanImageUrl).filter(Boolean)
    const totalPages = allUrls.length
    const PAGES_PER_PART = 20
    const totalParts = Math.ceil(totalPages / PAGES_PER_PART)

    setStitching(true)
    setDriveAuthError(null)
    setStitchProgress({
      currentPart: 0,
      totalParts,
      pageRange: `เริ่มต้นคำนวณ (ทั้งหมด ${totalPages} หน้า)`,
      percent: 5,
      statusText: "กำลังวิเคราะห์ความกว้างมาตรฐานจากหน้ากลาง...",
    })

    try {
      // 1. วัดขนาดความกว้างมาตรฐานจากหน้ากลางๆ (เช่น หน้า 30 จาก 150 หรือหน้ากึ่งกลาง)
      const sampleIdx = totalPages >= 30 ? 29 : Math.floor(totalPages / 2)
      let standardWidth = 1280

      try {
        const sampleImg = await loadImageElement(allUrls[sampleIdx])
        if (sampleImg.naturalWidth && sampleImg.naturalWidth > 100) {
          standardWidth = sampleImg.naturalWidth
        }
      } catch (err) {
        console.warn("Could not load sample middle image, trying first image:", err)
        try {
          const firstImg = await loadImageElement(allUrls[0])
          if (firstImg.naturalWidth && firstImg.naturalWidth > 100) {
            standardWidth = firstImg.naturalWidth
          }
        } catch (e2) {}
      }

      toast.info(`📏 ความกว้างมาตรฐานสำหรับเย็บภาพ: ${standardWidth}px (${totalParts} ส่วน)`)

      let lastFolderUrl = ""

      // 2. ลูปเย็บทีละ 20 หน้า
      for (let partIdx = 0; partIdx < totalParts; partIdx++) {
        const startIdx = partIdx * PAGES_PER_PART
        const endIdx = Math.min((partIdx + 1) * PAGES_PER_PART, totalPages)
        const partNum = partIdx + 1
        const partRange = `หน้า ${startIdx + 1} - ${endIdx}`
        const fileName = `Part_${String(partNum).padStart(2, "0")}.webp`

        setStitchProgress({
          currentPart: partNum,
          totalParts,
          pageRange: partRange,
          percent: Math.round((partIdx / totalParts) * 100),
          statusText: `กำลังโหลดและเย็บ ${partRange}...`,
        })

        // 2.1 โหลดภาพใน Part นี้
        const partUrls = allUrls.slice(startIdx, endIdx)
        const loadedImages = await Promise.all(
          partUrls.map((u) => loadImageElement(u))
        )

        // 2.2 ปรับสเกลภาพให้ความกว้างเท่ากับ standardWidth เสมอ (ขยายหน้าปกหรือหน้าที่ความกว้างต่างกัน)
        let totalHeight = 0
        const scaledItems = loadedImages.map((img) => {
          const scale = standardWidth / img.naturalWidth
          const scaledH = Math.round(img.naturalHeight * scale)
          totalHeight += scaledH
          return { img, scaledH }
        })

        // 2.3 สร้าง Canvas แล้ววาดต่อกันลงมา
        const canvas = document.createElement("canvas")
        canvas.width = standardWidth
        canvas.height = totalHeight
        const ctx = canvas.getContext("2d")
        if (!ctx) throw new Error("ไม่สามารถสร้าง 2D Canvas ได้")

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = "high"

        let currentY = 0
        for (const item of scaledItems) {
          ctx.drawImage(item.img, 0, currentY, standardWidth, item.scaledH)
          currentY += item.scaledH
        }

        // 2.4 ส่งออกเป็น WebP Blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("สร้าง WebP blob ไม่สำเร็จ"))),
            "image/webp",
            0.92
          )
        })

        // คืนหน่วยความจำ Canvas
        canvas.width = 0
        canvas.height = 0

        // 2.5 แปลงเป็น Base64
        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(blob)
        })

        // 2.6 ส่งขึ้น Google Drive
        setStitchProgress({
          currentPart: partNum,
          totalParts,
          pageRange: partRange,
          percent: Math.round(((partIdx + 0.6) / totalParts) * 100),
          statusText: `กำลังอัปโหลด ${fileName} ขึ้น แปลจนเมื่อย...`,
        })

        const isLast = partIdx === totalParts - 1
        const res = await callGasApi<any>("UPLOAD_CHAPTER_STITCHED_PART", {
          mangaName: testResult.topicTitle || "我！天命大反派",
          chapter: testResult.title || "第366话",
          partIndex: partNum,
          totalParts,
          fileName,
          mimeType: "image/webp",
          base64Data,
          isLastPart: isLast,
          mangaId: "1",
        })

        if (res && res.error) {
          if (res.error.includes("DriveApp") || res.error.includes("คุณไม่ได้รับอนุญาต") || res.error.includes("permission")) {
            setDriveAuthError(res.error)
          }
          throw new Error(res.error)
        }

        if (res && res.folderUrl) {
          lastFolderUrl = res.folderUrl
        }
      }

      setStitchProgress({
        currentPart: totalParts,
        totalParts,
        pageRange: `ครบทั้ง ${totalPages} หน้า`,
        percent: 100,
        statusText: `เย็บและอัปโหลดเสร็จสิ้นครบทั้ง ${totalParts} ส่วนแล้ว!`,
        folderUrl: lastFolderUrl || `https://drive.google.com/drive/folders/${DRIVE_ROOT_FOLDER_ID}`,
      })

      toast.success(`🎉 เย็บ 20 หน้า/ไฟล์ ครบทั้ง ${totalParts} ส่วน และบันทึกลง แปลจนเมื่อย สำเร็จ!`)
    } catch (err: any) {
      console.error("handleStitchAndUpload error:", err)
      if (err.message && (err.message.includes("DriveApp") || err.message.includes("คุณไม่ได้รับอนุญาต") || err.message.includes("permission"))) {
        setDriveAuthError(err.message)
      }
      toast.error(err.message || "เกิดข้อผิดพลาดในการเย็บภาพ")
    } finally {
      setStitching(false)
    }
  }

  // Copy helper
  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text)
    toast.success(msg)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[92vw] max-w-md bg-[#0b101b] border-[#1e293b] text-slate-100 p-0 overflow-hidden shadow-2xl rounded-2xl gap-0">
        {/* Compact Header */}
        <DialogHeader className="px-5 py-3.5 border-b border-[#1e293b] flex items-center justify-between bg-[#101726]">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 shrink-0">
              <Smartphone className="h-4 w-4" />
            </div>
            <div>
              <DialogTitle className="text-sm font-bold text-white flex items-center gap-2">
                KuaiKan VIP (快看漫画)
              </DialogTitle>
              <div className="text-[11px] text-slate-400">
                ซิงค์ Session เพื่อปลดล็อคตอน VIP
              </div>
            </div>
          </div>

          {/* Status Badge in Header */}
          <div className="flex items-center gap-1.5 pr-6">
            {loadingSession ? (
              <span className="text-[10px] text-slate-400 animate-pulse">ตรวจสถานะ...</span>
            ) : sessionStatus?.loggedIn ? (
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                  <ShieldCheck className="h-3 w-3" />
                  {sessionStatus.isVip ? "👑 VIP Active" : "พร้อมใช้งาน"}
                </span>
                <button
                  type="button"
                  onClick={handleClearSession}
                  className="text-slate-400 hover:text-red-400 p-0.5 transition-colors cursor-pointer"
                  title="ออกจากระบบ"
                >
                  <LogOut className="h-3 w-3" />
                </button>
              </div>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300">
                <AlertCircle className="h-3 w-3" /> ยังไม่เชื่อมต่อ
              </span>
            )}
          </div>
        </DialogHeader>

        {/* Tab Navigation Switcher */}
        <div className="px-5 pt-3 pb-0 bg-[#0b101b]">
          <div className="flex rounded-lg bg-[#141c2e] p-1 border border-[#1e293b]">
            <button
              type="button"
              onClick={() => setMainTab("sync")}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                mainTab === "sync"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Zap className="h-3.5 w-3.5" /> ซิงค์คุกกี้ VIP
            </button>
            <button
              type="button"
              onClick={() => {
                setMainTab("test")
                if (!testResult) handleTestChapter()
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                mainTab === "test"
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" /> โหลดตอน 366 (VIP)
              {testResult?.isVipUnlocked && (
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 ml-1" />
              )}
            </button>
          </div>
        </div>

        {/* Modal Body Container (Strictly Controlled Height, Never Overflows) */}
        <div className="p-5 pt-3 min-h-[220px] max-h-[75vh] overflow-y-auto">
          {/* TAB 1: SYNC VIEW */}
          {mainTab === "sync" && (
            <div className="space-y-3">
              {/* Sub-method pills */}
              <div className="flex rounded-md bg-[#141c2e] p-0.5 border border-[#1e293b] text-[11px]">
                <button
                  type="button"
                  onClick={() => setSyncMethod("1click")}
                  className={`flex-1 py-1 rounded transition-colors cursor-pointer ${
                    syncMethod === "1click"
                      ? "bg-emerald-600 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  ⚡ 1-Click บุ๊กมาร์ก (แนะนำ)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSyncMethod("qr")
                    loadQrCode()
                  }}
                  className={`flex-1 py-1 rounded transition-colors cursor-pointer ${
                    syncMethod === "qr"
                      ? "bg-indigo-600 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  📱 WeChat QR
                </button>
                <button
                  type="button"
                  onClick={() => setSyncMethod("cookie")}
                  className={`flex-1 py-1 rounded transition-colors cursor-pointer ${
                    syncMethod === "cookie"
                      ? "bg-indigo-600 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  🔑 วาง Cookie
                </button>
                <button
                  type="button"
                  onClick={() => setSyncMethod("html")}
                  className={`flex-1 py-1 rounded transition-colors cursor-pointer ${
                    syncMethod === "html"
                      ? "bg-indigo-600 text-white font-semibold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  📋 วาง HTML Syntax
                </button>
              </div>

              {/* Sub-tab: 1-Click Bookmarklet */}
              {syncMethod === "1click" && (
                <div className="p-3.5 rounded-xl border border-emerald-500/25 bg-emerald-950/15 space-y-3">
                  <div className="text-[11px] text-slate-300 leading-relaxed">
                    ลากปุ่มสีเขียวไปวางบน <b>แถบบุ๊กมาร์ก</b> บนเบราว์เซอร์ แล้วเปิดหน้า{" "}
                    <a
                      href="https://www.kuaikanmanhua.com"
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 underline inline-flex items-center gap-0.5 font-medium"
                    >
                      KuaiKan <ExternalLink className="h-2.5 w-2.5" />
                    </a>{" "}
                    ที่ล็อกอิน VIP ไว้ จากนั้นคลิกปุ่มนี้ คุกกี้จะถูกส่งมาที่นี่ทันที
                  </div>

                  {/* Draggable button */}
                  <div className="flex flex-col items-center justify-center gap-1.5 p-2 rounded-lg bg-[#070b14] border border-dashed border-emerald-500/40">
                    <a
                      href={bookmarkletCode}
                      draggable="true"
                      onClick={(e) => {
                        e.preventDefault()
                        copyToClipboard(bookmarkletCode, "คัดลอกโค้ด Bookmarklet แล้ว!")
                      }}
                      className="w-full py-2.5 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950 flex items-center justify-center gap-2 cursor-grab active:cursor-grabbing border border-emerald-400/30 transition-transform active:scale-95"
                      title="ลากปุ่มนี้ไปวางที่ Bookmarks Bar"
                    >
                      <Bookmark className="h-3.5 w-3.5" /> 📥 ลากปุ่มนี้ไปวางบนแถบ Bookmark Bar
                    </a>
                    <span className="text-[10px] text-slate-400">
                      (หรือคลิกเพื่อคัดลอกโค้ด)
                    </span>
                  </div>

                  {/* Compact secondary actions */}
                  <div className="flex items-center justify-between pt-1 border-t border-[#1e293b] text-[10px]">
                    <span className="text-slate-400">หรือใช้วิธีอื่น:</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => copyToClipboard(consoleCode, "คัดลอกโค้ด Console แล้ว! วางใน F12 ได้เลย")}
                        className="px-2 py-1 rounded bg-[#141c2e] hover:bg-indigo-600/30 text-indigo-300 border border-[#1e293b] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        <Copy className="h-2.5 w-2.5" /> โค้ด Console
                      </button>
                      <button
                        type="button"
                        onClick={() => copyToClipboard("node tools/kuaikan_sync.js", "คัดลอกคำสั่ง CLI เรียบร้อย!")}
                        className="px-2 py-1 rounded bg-[#141c2e] hover:bg-indigo-600/30 text-indigo-300 border border-[#1e293b] flex items-center gap-1 cursor-pointer transition-colors"
                      >
                        Node CLI
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Sub-tab: WeChat QR Code */}
              {syncMethod === "qr" && (
                <div className="p-3 rounded-xl border border-[#1e293b] bg-[#101726] flex flex-col items-center justify-center space-y-2">
                  <div className="relative p-2 bg-white rounded-lg shadow border border-slate-200">
                    {qrLoading ? (
                      <div className="w-28 h-28 flex flex-col items-center justify-center gap-1 text-slate-700">
                        <RefreshCw className="h-5 w-5 animate-spin text-indigo-600" />
                        <span className="text-[10px]">กำลังโหลด...</span>
                      </div>
                    ) : qrData?.qrUrl ? (
                      <div className="relative">
                        <img
                          src={qrData.qrUrl}
                          alt="KuaiKan WeChat QR"
                          className="w-28 h-28 object-contain rounded"
                        />
                        {scanState === "scanned" && (
                          <div className="absolute inset-0 bg-emerald-950/90 flex flex-col items-center justify-center text-white rounded p-1 text-center">
                            <CheckCircle2 className="h-6 w-6 text-emerald-400 mb-0.5" />
                            <span className="text-[10px] font-bold text-emerald-300">สแกนแล้ว!</span>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="w-28 h-28 flex flex-col items-center justify-center text-red-500">
                        <AlertCircle className="h-5 w-5" />
                        <span className="text-[10px]">ไม่สำเร็จ</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`h-2 w-2 rounded-full ${
                        scanState === "waiting"
                          ? "bg-amber-400 animate-pulse"
                          : scanState === "scanned"
                          ? "bg-blue-400 animate-ping"
                          : "bg-slate-500"
                      }`}
                    />
                    <span className="text-[11px] text-slate-300">{qrStatusText}</span>
                    <button
                      type="button"
                      onClick={loadQrCode}
                      disabled={qrLoading}
                      className="text-[10px] text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer ml-1"
                    >
                      <RefreshCw className="h-2.5 w-2.5" /> รีเฟรช
                    </button>
                  </div>
                </div>
              )}

              {/* Sub-tab: Manual Cookie */}
              {syncMethod === "cookie" && (
                <div className="p-3 rounded-xl border border-[#1e293b] bg-[#101726] space-y-2">
                  <Textarea
                    rows={2}
                    placeholder="วาง passToken=... หรือ connect.sid=..."
                    value={cookieInput}
                    onChange={(e) => setCookieInput(e.target.value)}
                    className="font-mono text-xs bg-[#070b14] border-[#1e293b] text-slate-200 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      ก๊อปปี้ค่า <code>passToken</code> ในหน้าเว็บ KuaiKan
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500"
                      onClick={handleSaveCookie}
                      disabled={savingCookie}
                    >
                      {savingCookie ? (
                        <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      บันทึก
                    </Button>
                  </div>
                </div>
              )}

              {/* Sub-tab: Raw HTML Syntax Parser */}
              {syncMethod === "html" && (
                <div className="p-3 rounded-xl border border-indigo-500/25 bg-indigo-950/15 space-y-2">
                  <div className="text-[11px] text-slate-300">
                    ก๊อปปี้ Element <code>&lt;div class="imgList"&gt;...</code> หรือ <code>&lt;div class="img-box"&gt;...</code> จากหน้า Inspect Element มาวางที่นี่:
                  </div>
                  <Textarea
                    rows={3}
                    placeholder="วางโค้ด HTML ของตอน เช่น <div class=&quot;comicDetails&quot;>..."
                    value={htmlInput}
                    onChange={(e) => setHtmlInput(e.target.value)}
                    className="font-mono text-[10px] bg-[#070b14] border-[#1e293b] text-slate-200 resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      ระบบจะ Regex ดึงภาพ <code>/image/c855368/</code> ให้อัตโนมัติ
                    </span>
                    <Button
                      size="sm"
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                      onClick={handleParseHtml}
                      disabled={parsingHtml}
                    >
                      {parsingHtml ? (
                        <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                      ) : (
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                      )}
                      ดึงภาพจาก HTML
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEST & DOWNLOAD VIEW */}
          {mainTab === "test" && (
            <div className="space-y-3">
              {/* Comic Info Card */}
              <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 flex items-center justify-between">
                <div>
                  <div className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                    我！天命大反派 • 第366话
                  </div>
                  <div className="text-[10px] text-slate-400">
                    comicId: 855368 • ตอน VIP ล่าสุด
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleTestChapter}
                  disabled={testingChapter}
                  className="h-7 text-xs bg-indigo-600 hover:bg-indigo-500 shadow-sm"
                >
                  {testingChapter ? (
                    <>
                      <RefreshCw className="h-3 w-3 animate-spin mr-1" /> ตรวจสอบ...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-3 w-3 mr-1" /> ⚡ ทดสอบตอน 366
                    </>
                  )}
                </Button>
              </div>

              {/* Test Result Display */}
              {testResult ? (
                <div className="p-3 rounded-xl border border-[#1e293b] bg-[#101726] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">
                      {testResult.title || "第366话 真真假假"}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        testResult.isVipUnlocked && testResult.imagesCount > 1
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : "bg-red-500/20 text-red-300 border border-red-500/30"
                      }`}
                    >
                      {testResult.isVipUnlocked && testResult.imagesCount > 1
                        ? `🎉 ปลดล็อคแล้ว (${testResult.imagesCount} ภาพ HD)`
                        : "🔒 ยังติดล็อค (ต้องใช้ VIP)"}
                    </span>
                  </div>

                  {/* Sample Gallery */}
                  {testResult.sampleImages && testResult.sampleImages.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {testResult.sampleImages.slice(0, 3).map((img: string, idx: number) => (
                        <div
                          key={idx}
                          className="relative rounded-lg overflow-hidden border border-[#1e293b] bg-black/50 h-16 flex items-center justify-center"
                        >
                          <img
                            src={normalizeKuaikanImageUrl(img)}
                            alt={`Sample ${idx + 1}`}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                          <span className="absolute bottom-0.5 right-1 bg-black/80 text-[8px] px-1 rounded text-white font-mono">
                            #{idx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Target Folder Path Indicator */}
                  <div className="px-2.5 py-1.5 rounded-lg bg-[#070b14] border border-[#1e293b] text-[10px] text-slate-300 flex items-center justify-between">
                    <div className="flex items-center gap-1.5 truncate">
                      <FolderOpen className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                      <span className="text-slate-400">บันทึกลง:</span>
                      <span className="font-mono text-emerald-300 truncate">
                        แปลจนเมื่อย / {testResult.topicTitle || "我！天命大反派"} / {testResult.title || "第366话"}
                      </span>
                    </div>
                    <a
                      href={`https://drive.google.com/drive/folders/${DRIVE_ROOT_FOLDER_ID}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:text-indigo-300 shrink-0 text-[10px] underline ml-2"
                    >
                      ดูโฟลเดอร์หลัก
                    </a>
                  </div>

                  {/* Actions: Stitch 20 pages or Download Raw */}
                  {testResult.isVipUnlocked && testResult.imagesCount > 1 && (
                    <div className="pt-2 border-t border-[#1e293b] space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          size="sm"
                          onClick={handleStitchAndUpload}
                          disabled={stitching || downloading}
                          className="flex-1 h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-950 flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {stitching ? (
                            <>
                              <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" />
                              กำลังเย็บ & อัปโหลด...
                            </>
                          ) : (
                            <>
                              <Scissors className="h-3.5 w-3.5 mr-1" />
                              เย็บ 20 หน้า & เซฟลง Drive
                            </>
                          )}
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={handleDownloadChapter}
                          disabled={stitching || downloading}
                          className="h-8 text-xs border-[#1e293b] bg-[#141c2e] hover:bg-slate-800 text-slate-200 shrink-0"
                          title="ดาวน์โหลดภาพดิบทั้งหมดแยกเป็นไฟล์เดี่ยวๆ"
                        >
                          {downloading ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <Download className="h-3 w-3 mr-1" /> Raw ({testResult.imagesCount})
                            </>
                          )}
                        </Button>
                      </div>
                      <div className="text-[10px] text-slate-400 text-center">
                        ✂️ เย็บภาพต่อกันแนวตั้ง 20 หน้า/ไฟล์ (ความกว้างเท่ากัน ปรับสเกลหน้าปกให้อัตโนมัติ)
                      </div>
                    </div>
                  )}

                  {/* Live Stitching Progress */}
                  {stitching && stitchProgress && (
                    <div className="p-3 rounded-xl border border-indigo-500/30 bg-indigo-950/30 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-indigo-300 flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 animate-bounce" />
                          Part {stitchProgress.currentPart} / {stitchProgress.totalParts}
                        </span>
                        <span className="text-[11px] font-mono text-emerald-400">
                          {stitchProgress.percent}%
                        </span>
                      </div>
                      <div className="w-full bg-[#0b101b] rounded-full h-2 overflow-hidden border border-[#1e293b]">
                        <div
                          className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(stitchProgress.percent, 5)}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{stitchProgress.pageRange}</span>
                        <span className="text-slate-300">{stitchProgress.statusText}</span>
                      </div>
                    </div>
                  )}

                  {/* Stitch Complete Success Link */}
                  {!stitching && stitchProgress && stitchProgress.percent === 100 && (
                    <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/40 text-emerald-200 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-emerald-300">
                        <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                        เย็บและบันทึกลง Google Drive สำเร็จครบทั้ง {stitchProgress.totalParts} ส่วน!
                      </div>
                      <div className="text-[11px] text-slate-300">
                        ไฟล์ถูกบันทึกไว้ในโฟลเดอร์ <b>แปลจนเมื่อย / {testResult.topicTitle || "我！天命大反派"} / {testResult.title || "第366话"}</b>
                      </div>
                      {stitchProgress.folderUrl && (
                        <a
                          href={stitchProgress.folderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs shadow transition-colors"
                        >
                          <FolderOpen className="h-3.5 w-3.5" /> เปิดโฟลเดอร์ใน Google Drive
                        </a>
                      )}
                    </div>
                  )}

                  {/* Raw Download Result Link */}
                  {downloadResult && downloadResult.success && (
                    <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-[11px] flex items-center justify-between">
                      <span>✓ โหลดภาพดิบแล้ว {downloadResult.downloadedCount} ภาพ!</span>
                      {downloadResult.folderUrl && (
                        <a
                          href={downloadResult.folderUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                        >
                          <FolderOpen className="h-3 w-3" /> เปิดใน Drive
                        </a>
                      )}
                    </div>
                  )}

                  {/* Drive Permission Authorization Alert */}
                  {driveAuthError && (
                    <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-500/40 text-amber-200 text-xs space-y-2">
                      <div className="flex items-center gap-1.5 font-bold text-amber-300">
                        <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
                        ต้องกดอนุญาตสิทธิ์ Google Drive ใน Apps Script 1 ครั้ง
                      </div>
                      <div className="text-[11px] text-slate-300 leading-relaxed">
                        เนื่องจาก Google Apps Script เพิ่มสิทธิ์เข้าถึง Google Drive กรุณาเปิด Apps Script แล้วรันฟังก์ชัน <b>AUTHORIZE_DRIVE</b> เพื่อกดยืนยันสิทธิ์:
                      </div>
                      <a
                        href="https://script.google.com/home/projects/1W-7_ngf3zkLJjCJB4Mm_CJxNyzgQAlD49kaUZQ6iNcaKnM6ntrZaICs5/edit"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center gap-1.5 w-full py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs shadow transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" /> เปิด Apps Script เพื่อกด AUTHORIZE_DRIVE
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 rounded-xl border border-dashed border-[#1e293b] bg-[#101726]/40 text-center text-xs text-slate-400 flex flex-col items-center gap-1.5">
                  <ImageIcon className="h-5 w-5 text-slate-500" />
                  <span>กดปุ่ม <b>"⚡ ทดสอบตอน 366"</b> เพื่อทดสอบปลดล็อคภาพ HD</span>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

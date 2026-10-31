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
} from "lucide-react"

interface KuaiKanLoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const GAS_EXEC_URL =
  "https://script.google.com/macros/s/AKfycbzG1H1eBoTsF7Omfso8v23N6HidWXU4kS-yyf0xDunb2BoZgPiUYPIOO2vMLSvYWwHsnw/exec"

/**
 * แปลงลิงก์ CDN ของ KuaiKan ให้เป็น f2.kkmh.com Full HD เพื่อหลีกเลี่ยง 403 Forbidden และแสดงผลได้ 100%
 */
function normalizeKuaikanImageUrl(url: string): string {
  if (!url) return ""
  let u = String(url).trim()
  u = u.replace(/https?:\/\/tn\d+(?:-f\d+)?\.kkmh\.com/g, "https://f2.kkmh.com")
  u = u.replace(/-t\.w\d+\.jpg.*$/i, "")
  u = u.replace(/-w\d+.*$/i, "")
  return u
}

export function KuaiKanLoginModal({
  open,
  onClose,
  onSuccess,
}: KuaiKanLoginModalProps) {
  // Main view tab: "sync" (Connect VIP) vs "test" (Chapter 366 Download)
  const [mainTab, setMainTab] = React.useState<"sync" | "test">("sync")

  // Sync sub-method: "1click" | "qr" | "cookie"
  const [syncMethod, setSyncMethod] = React.useState<"1click" | "qr" | "cookie">("1click")

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

  // Bookmarklet JavaScript Code (รองรับดูดภาพ HD จากหน้าตัวอ่านอัตโนมัติ)
  const bookmarkletCode = React.useMemo(() => {
    return `javascript:(function(){try{var c=document.cookie;var imgs=[];try{var comp=window.$nuxt&&window.$nuxt.$route&&window.$nuxt.$route.matched&&window.$nuxt.$route.matched[0]&&window.$nuxt.$route.matched[0].instances&&window.$nuxt.$route.matched[0].instances.default;if(comp&&comp.comicInfo&&comp.comicInfo.comicImages&&comp.comicInfo.comicImages.length){imgs=comp.comicInfo.comicImages.map(function(i){return i.url||i;});}}catch(e){}if(!imgs.length){var els=document.querySelectorAll('.img-box img, .img-list img, img[data-src]');for(var i=0;i<els.length;i++){var s=els[i].getAttribute('data-src')||els[i].src;if(s&&s.indexOf('kkmh.com')!==-1&&s.indexOf('avatar')===-1&&s.indexOf('logo')===-1){if(imgs.indexOf(s)===-1)imgs.push(s);}}}var m=window.location.pathname.match(/\\/comic(?:-next)?\\/(\\d+)/);var cid=m?parseInt(m[1]):855368;var u='${GAS_EXEC_URL}';fetch(u,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_KUAIKAN_AUTH',passcode:'10211032',payload:{directCookie:c,comicId:cid,images:imgs}})}).then(function(){alert('🎉 ส่ง Session KuaiKan + ภาพ '+(imgs.length?imgs.length+' ภาพ':'')+' ให้ MangaHub สำเร็จแล้ว!');}).catch(function(e){alert('Error: '+e.message);});}catch(err){alert('Error: '+err.message);}})();`
  }, [])

  // Console Code (รองรับดูดภาพ HD จากหน้าตัวอ่านอัตโนมัติ)
  const consoleCode = React.useMemo(() => {
    return `(()=>{try{var c=document.cookie,imgs=[];try{var comp=window.$nuxt?.$route?.matched?.[0]?.instances?.default;if(comp?.comicInfo?.comicImages?.length)imgs=comp.comicInfo.comicImages.map(i=>i.url||i);}catch(e){}if(!imgs.length){document.querySelectorAll('.img-box img, .img-list img, img[data-src]').forEach(el=>{var s=el.getAttribute('data-src')||el.src;if(s&&s.includes('kkmh.com')&&!s.includes('avatar')&&!s.includes('logo'))imgs.push(s);});}imgs=[...new Set(imgs)];var m=location.pathname.match(/\\/comic(?:-next)?\\/(\\d+)/),cid=m?parseInt(m[1]):855368;fetch('${GAS_EXEC_URL}',{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_KUAIKAN_AUTH',passcode:'10211032',payload:{directCookie:c,comicId:cid,images:imgs}})}).then(()=>alert('🎉 ส่ง Session KuaiKan + ภาพ '+(imgs.length?imgs.length+' ภาพ':'')+' ให้ MangaHub สำเร็จแล้ว!'));}catch(e){alert('Error: '+e.message);}})();`
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
        toast.error(res?.error || "ดาวน์โหลดไม่สำเร็จ")
      }
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการดาวน์โหลด")
    } finally {
      setDownloading(false)
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
        <div className="p-5 pt-3 min-h-[220px]">
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

                  {/* Actions: Download */}
                  {testResult.isVipUnlocked && testResult.imagesCount > 1 && (
                    <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between">
                      <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                        <CheckCircle2 className="h-3 w-3" /> ภาพ HD พร้อมแล้ว
                      </span>
                      <Button
                        size="sm"
                        onClick={handleDownloadChapter}
                        disabled={downloading}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                      >
                        {downloading ? (
                          <>
                            <RefreshCw className="h-3 w-3 animate-spin mr-1" /> กำลังโหลด...
                          </>
                        ) : (
                          <>
                            <Download className="h-3 w-3 mr-1" /> โหลดลง Google Drive
                          </>
                        )}
                      </Button>
                    </div>
                  )}

                  {/* Download Result Link */}
                  {downloadResult && downloadResult.success && (
                    <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-[11px] flex items-center justify-between">
                      <span>✓ โหลดแล้ว {downloadResult.downloadedCount} ภาพ!</span>
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

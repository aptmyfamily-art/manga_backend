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
  QrCode,
  KeyRound,
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
  Terminal,
  BookOpen,
} from "lucide-react"

interface KuaiKanLoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

const GAS_EXEC_URL =
  "https://script.google.com/macros/s/AKfycbzG1H1eBoTsF7Omfso8v23N6HidWXU4kS-yyf0xDunb2BoZgPiUYPIOO2vMLSvYWwHsnw/exec"

export function KuaiKanLoginModal({
  open,
  onClose,
  onSuccess,
}: KuaiKanLoginModalProps) {
  // Main view tab: "sync" (Login / Sync Session) vs "test" (Test & Download Chapter)
  const [mainTab, setMainTab] = React.useState<"sync" | "test">("sync")

  // Sync sub-methods: "1click" | "qr" | "cookie"
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

  // Bookmarklet JavaScript Code
  const bookmarkletCode = React.useMemo(() => {
    return `javascript:(function(){try{var c=document.cookie;if(!c||(!c.includes('passToken')&&!c.includes('connect.sid')&&!c.includes('uid'))){alert('⚠️ ไม่พบคุกกี้ KuaiKan กรุณาเข้าสู่ระบบบนหน้านี้ก่อนครับ');return;}var b=document.createElement('div');b.id='mgh_sync';b.style.cssText='position:fixed;top:20px;right:20px;z-index:9999999;background:#0f172a;color:#fff;border:2px solid #10b981;padding:12px 16px;border-radius:10px;font-family:sans-serif;box-shadow:0 15px 35px rgba(0,0,0,0.6);font-size:13px;display:flex;align-items:center;gap:10px;';b.innerHTML='<span style=\"font-size:20px\">⏳</span><div><b style=\"color:#34d399\">MangaHub Sync</b><div style=\"color:#94a3b8;font-size:11px\">กำลังส่ง VIP Cookie ไปยัง MangaHub...</div></div>';var p=document.getElementById('mgh_sync');if(p)p.remove();document.body.appendChild(b);var u='${GAS_EXEC_URL}';fetch(u,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_KUAIKAN_AUTH',passcode:'10211032',payload:{directCookie:c}})}).then(function(){b.style.borderColor='#10b981';b.innerHTML='<span style=\"font-size:20px\">👑</span><div><b style=\"color:#34d399\">เชื่อมต่อสำเร็จ!</b><div style=\"color:#cbd5e1;font-size:11px\">ส่ง Cookie ให้ MangaHub แล้ว สลับแท็บกลับไปได้เลย</div></div>';setTimeout(function(){b.remove();},4000);}).catch(function(e){b.style.borderColor='#ef4444';b.innerHTML='<span style=\"font-size:20px\">❌</span><div><b style=\"color:#f87171\">ส่งไม่สำเร็จ</b><div style=\"color:#cbd5e1;font-size:11px\">'+e.message+'</div></div>';setTimeout(function(){b.remove();},5000);});}catch(e){alert('Error: '+e.message);}})();`
  }, [])

  // Console One-liner Code
  const consoleCode = React.useMemo(() => {
    return `fetch('${GAS_EXEC_URL}', {method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({action:'SAVE_KUAIKAN_AUTH',passcode:'10211032',payload:{directCookie:document.cookie}})}).then(()=>alert('👑 ส่ง KuaiKan Cookie ให้ MangaHub สำเร็จแล้ว!'));`
  }, [])

  // Check saved session on open
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

  // Auto-detect incoming session sync every 2.5s while modal is open
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
        setQrStatusText("เปิดแอป WeChat สแกน QR ด้านล่าง")
        startPolling(res.uuid, res.state, res.cookies)
      } else {
        setScanState("expired")
        setQrStatusText(res?.error || "ไม่สามารถขอ QR Code ได้")
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
          setQrStatusText("รอการสแกน QR Code...")
          setTimeout(pollNext, 1200)
        } else if (pollResult.errcode === 404) {
          setScanState("scanned")
          setQrStatusText("📲 สแกนแล้ว! กดยืนยันบน WeChat ในมือถือ...")
          toast.info("สแกนสำเร็จ! กรุณากดยืนยันบน WeChat")
          setTimeout(pollNext, 800)
        } else if (pollResult.errcode === 405 && pollResult.code) {
          setScanState("success")
          setQrStatusText("🎉 ยืนยันสำเร็จ! กำลังบันทึก Session...")
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
          setQrStatusText("QR หมดอายุ กดรีเฟรชเพื่อลองใหม่")
        } else if (pollResult.errcode === 403) {
          setScanState("expired")
          setQrStatusText("ยกเลิกการเข้าสู่ระบบบนมือถือ")
        } else {
          const checkRes = await callGasApi<any>("CHECK_KUAIKAN_QR", {
            uuid,
            state,
            cookies,
          })
          if (checkRes) {
            if (checkRes.status === "waiting") {
              setScanState("waiting")
              setTimeout(pollNext, 1500)
            } else if (checkRes.status === "scanned") {
              setScanState("scanned")
              setQrStatusText("📲 สแกนแล้ว! กดยืนยันบนมือถือ...")
              setTimeout(pollNext, 1000)
            } else if (checkRes.status === "success") {
              setScanState("success")
              setQrStatusText("🎉 เข้าสู่ระบบสำเร็จแล้ว!")
              toast.success("เข้าสู่ระบบ KuaiKan สำเร็จ!")
              fetchSessionStatus()
              setMainTab("test")
              handleTestChapter()
              if (onSuccess) onSuccess()
            } else if (checkRes.status === "expired") {
              setScanState("expired")
              setQrStatusText("QR Code หมดอายุแล้ว")
            } else {
              setTimeout(pollNext, 2000)
            }
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

  // Copy to clipboard helper
  const copyToClipboard = (text: string, msg: string) => {
    navigator.clipboard.writeText(text)
    toast.success(msg)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg bg-[#0b101b] border-[#1e293b] text-slate-100 p-5 shadow-2xl rounded-2xl">
        {/* Compact Header with integrated status */}
        <DialogHeader className="border-b border-[#1e293b] pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Smartphone className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  KuaiKan VIP (快看漫画)
                </DialogTitle>
                <div className="text-[11px] text-slate-400">
                  ระบบซิงค์และดาวน์โหลดมังงะ VIP อัตโนมัติ
                </div>
              </div>
            </div>

            {/* Status Pill in Header */}
            <div className="flex items-center gap-2">
              {loadingSession ? (
                <span className="text-[11px] text-slate-400 animate-pulse">กำลังตรวจ...</span>
              ) : sessionStatus?.loggedIn ? (
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/15 border border-emerald-500/30 text-emerald-400">
                    <ShieldCheck className="h-3 w-3" />
                    {sessionStatus.isVip ? "👑 VIP Active" : "เชื่อมต่อแล้ว"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-slate-400 hover:text-red-400 hover:bg-red-500/10"
                    onClick={handleClearSession}
                    title="ยกเลิกการเชื่อมต่อ"
                  >
                    <LogOut className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <AlertCircle className="h-3 w-3" /> ยังไม่เชื่อมต่อ
                </span>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Top-Level Navigation Switcher */}
        <div className="flex rounded-lg bg-[#141c2e] p-1 border border-[#1e293b] mt-3">
          <button
            type="button"
            onClick={() => setMainTab("sync")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
              mainTab === "sync"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <Zap className="h-3.5 w-3.5" /> ซิงค์บัญชี VIP
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
            <BookOpen className="h-3.5 w-3.5" /> ทดสอบ & โหลดตอน (366)
            {testResult?.isVipUnlocked && (
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            )}
          </button>
        </div>

        {/* VIEW 1: SYNC METHODS */}
        {mainTab === "sync" && (
          <div className="mt-3 space-y-3">
            {/* Sync Method Pills */}
            <div className="flex rounded-md bg-[#0e1626] p-0.5 border border-[#1e293b] text-[11px]">
              <button
                type="button"
                onClick={() => setSyncMethod("1click")}
                className={`flex-1 py-1 rounded transition-colors ${
                  syncMethod === "1click"
                    ? "bg-emerald-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
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
                className={`flex-1 py-1 rounded transition-colors ${
                  syncMethod === "qr"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                📱 WeChat QR
              </button>
              <button
                type="button"
                onClick={() => setSyncMethod("cookie")}
                className={`flex-1 py-1 rounded transition-colors ${
                  syncMethod === "cookie"
                    ? "bg-indigo-600 text-white font-semibold"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                🔑 วาง Cookie
              </button>
            </div>

            {/* Sub-tab: 1-Click Bookmarklet */}
            {syncMethod === "1click" && (
              <div className="p-4 rounded-xl border border-emerald-500/20 bg-emerald-950/10 space-y-3">
                <div className="text-[12px] text-slate-300 leading-normal">
                  <b>วิธีใช้:</b> ลากปุ่มสีเขียวด้านล่างนี้ไปวางที่ <b>แถบบุ๊กมาร์ก</b> บนเบราว์เซอร์ของคุณ จากนั้นเมื่อเปิดหน้าเว็บ{" "}
                  <a
                    href="https://www.kuaikanmanhua.com"
                    target="_blank"
                    rel="noreferrer"
                    className="text-indigo-400 underline inline-flex items-center gap-0.5 font-medium"
                  >
                    kuaikanmanhua.com <ExternalLink className="h-2.5 w-2.5" />
                  </a>{" "}
                  ที่ล็อกอิน VIP ไว้ เพียงแค่คลิกปุ่มนี้ คุกกี้จะถูกส่งเข้า MangaHub อัตโนมัติทันที
                </div>

                {/* Draggable button */}
                <div className="p-3 rounded-lg bg-[#070b14] border border-dashed border-emerald-500/40 flex flex-col items-center justify-center gap-1.5 text-center">
                  <a
                    href={bookmarkletCode}
                    onClick={(e) => {
                      e.preventDefault()
                      toast.info("💡 กรุณาลากปุ่มนี้ขึ้นไปวางบนแถบ Bookmark Bar ด้านบนของเบราว์เซอร์ครับ")
                    }}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-950 flex items-center gap-2 cursor-grab active:cursor-grabbing border border-emerald-400/40 transition-transform hover:scale-105"
                    title="ลากปุ่มนี้ไปวางที่ Bookmarks Bar ของเบราว์เซอร์"
                  >
                    <Bookmark className="h-3.5 w-3.5" /> 📥 ส่ง VIP Cookie ให้ MangaHub
                  </a>
                  <span className="text-[10px] text-slate-400">
                    (คลิกค้างแล้วลากขึ้นไปวางบนแถบ Bookmark ได้เลย)
                  </span>
                </div>

                {/* Compact alternative actions */}
                <div className="flex items-center justify-between pt-1 text-[11px] text-slate-400 border-t border-[#1e293b]">
                  <span>หรือใช้วิธีอื่น:</span>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(consoleCode, "คัดลอกโค้ด Console แล้ว! วางใน F12 ได้เลย")}
                      className="h-6 px-2 text-[10px] text-indigo-300 hover:bg-indigo-500/10 border border-[#1e293b]"
                    >
                      <Copy className="h-2.5 w-2.5 mr-1" /> โค้ด Console
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard("node tools/kuaikan_sync.js", "คัดลอกคำสั่ง CLI เรียบร้อย!")}
                      className="h-6 px-2 text-[10px] text-indigo-300 hover:bg-indigo-500/10 border border-[#1e293b]"
                    >
                      <Terminal className="h-2.5 w-2.5 mr-1" /> Node CLI
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Sub-tab: WeChat QR Code */}
            {syncMethod === "qr" && (
              <div className="p-4 rounded-xl border border-[#1e293b] bg-[#0e1626]/80 flex flex-col items-center justify-center space-y-3">
                <div className="relative p-2.5 bg-white rounded-xl shadow-lg border border-slate-200">
                  {qrLoading ? (
                    <div className="w-36 h-36 flex flex-col items-center justify-center gap-2 text-slate-700">
                      <RefreshCw className="h-6 w-6 animate-spin text-indigo-600" />
                      <span className="text-[11px] font-medium">กำลังโหลด...</span>
                    </div>
                  ) : qrData?.qrUrl ? (
                    <div className="relative">
                      <img
                        src={qrData.qrUrl}
                        alt="KuaiKan WeChat QR"
                        className="w-36 h-36 object-contain rounded"
                      />
                      {scanState === "scanned" && (
                        <div className="absolute inset-0 bg-emerald-950/85 backdrop-blur-xs flex flex-col items-center justify-center text-white rounded p-1 text-center">
                          <CheckCircle2 className="h-8 w-8 text-emerald-400 mb-1" />
                          <span className="text-[11px] font-bold text-emerald-300">สแกนแล้ว!</span>
                          <span className="text-[9px] text-slate-200">กดยืนยันบนมือถือ</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="w-36 h-36 flex flex-col items-center justify-center gap-1 text-red-500">
                      <AlertCircle className="h-6 w-6" />
                      <span className="text-[11px]">โหลดไม่สำเร็จ</span>
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
                  <span className="text-xs text-slate-300">{qrStatusText}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={loadQrCode}
                    disabled={qrLoading}
                    className="h-6 px-2 text-[10px] text-slate-400 hover:text-white"
                  >
                    <RefreshCw className={`h-2.5 w-2.5 mr-1 ${qrLoading ? "animate-spin" : ""}`} />
                    รีเฟรช
                  </Button>
                </div>
              </div>
            )}

            {/* Sub-tab: Manual Cookie */}
            {syncMethod === "cookie" && (
              <div className="p-3.5 rounded-xl border border-[#1e293b] bg-[#0e1626]/80 space-y-2.5">
                <Textarea
                  rows={2}
                  placeholder="วาง cookie เช่น passToken=... หรือ connect.sid=..."
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  className="font-mono text-xs bg-[#070b14] border-[#1e293b] text-slate-200 resize-none"
                />
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-400">
                    เปิด KuaiKan &gt; F12 &gt; Application &gt; Cookies &gt; ดับเบิ้ลคลิก <code>passToken</code>
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

        {/* VIEW 2: TEST & DOWNLOAD CHAPTER 366 */}
        {mainTab === "test" && (
          <div className="mt-3 space-y-3">
            {/* Target Chapter Info Card */}
            <div className="p-3 rounded-xl border border-indigo-500/20 bg-indigo-950/20 flex items-center justify-between">
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  我！天命大反派 • 第366话 真真假假
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5">
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
              <div className="p-3 rounded-xl border border-[#1e293b] bg-[#0e1626] space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-slate-300">
                    ผลลัพธ์: {testResult.title || "第366话"}
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      testResult.isVipUnlocked && testResult.imagesCount > 1
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                        : "bg-red-500/20 text-red-300 border border-red-500/30"
                    }`}
                  >
                    {testResult.isVipUnlocked && testResult.imagesCount > 1
                      ? `🎉 VIP ปลดล็อคแล้ว (${testResult.imagesCount} ภาพ HD)`
                      : "🔒 ตอนยังถูกล็อค (ต้องใช้ VIP หรือซื้อเหรียญ)"}
                  </span>
                </div>

                {/* Compact Sample Gallery */}
                {testResult.sampleImages && testResult.sampleImages.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {testResult.sampleImages.slice(0, 3).map((img: string, idx: number) => (
                      <div
                        key={idx}
                        className="relative rounded-lg overflow-hidden border border-[#1e293b] bg-black/50 h-20 flex items-center justify-center"
                      >
                        <img
                          src={img}
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

                {/* Actions: Download to Google Drive */}
                {testResult.isVipUnlocked && testResult.imagesCount > 1 && (
                  <div className="pt-2 border-t border-[#1e293b] flex items-center justify-between">
                    <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="h-3 w-3" /> พร้อมดาวน์โหลด
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

                {/* Download Result Message */}
                {downloadResult && downloadResult.success && (
                  <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-[11px] flex items-center justify-between">
                    <span>
                      ✓ บันทึกสำเร็จ {downloadResult.downloadedCount} ภาพ!
                    </span>
                    {downloadResult.folderUrl && (
                      <a
                        href={downloadResult.folderUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <FolderOpen className="h-3 w-3" /> เปิด Google Drive
                      </a>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 rounded-xl border border-dashed border-[#1e293b] bg-[#0e1626]/50 text-center text-xs text-slate-400 flex flex-col items-center gap-2">
                <ImageIcon className="h-6 w-6 text-slate-500" />
                <span>กดปุ่ม <b>"⚡ ทดสอบตอน 366"</b> ด้านบน เพื่อเริ่มตรวจสอบภาพต้นฉบับ HD</span>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { callGasApi } from "@/api/gasClient"
import { toast } from "sonner"
import {
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
} from "lucide-react"

interface KuaiKanLoginModalProps {
  open: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function KuaiKanLoginModal({
  open,
  onClose,
  onSuccess,
}: KuaiKanLoginModalProps) {
  const [activeTab, setActiveTab] = React.useState<"qr" | "cookie">("qr")

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

  // Manual Cookie state
  const [cookieInput, setCookieInput] = React.useState("")
  const [savingCookie, setSavingCookie] = React.useState(false)

  // Test Chapter state
  const [testingChapter, setTestingChapter] = React.useState(false)
  const [testResult, setTestResult] = React.useState<any | null>(null)

  // Download state
  const [downloading, setDownloading] = React.useState(false)
  const [downloadResult, setDownloadResult] = React.useState<any | null>(null)

  // Check saved session on open
  const fetchSessionStatus = React.useCallback(async () => {
    setLoadingSession(true)
    try {
      const res = await callGasApi<any>("GET_KUAIKAN_AUTH")
      setSessionStatus(res)
    } catch (err: any) {
      console.error("fetchSessionStatus error:", err)
    } finally {
      setLoadingSession(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      fetchSessionStatus()
      loadQrCode()
    } else {
      pollingRef.current = false
    }
    return () => {
      pollingRef.current = false
    }
  }, [open, fetchSessionStatus])

  // Generate QR session
  const loadQrCode = async () => {
    pollingRef.current = false
    setQrLoading(true)
    setQrData(null)
    setScanState("waiting")
    setQrStatusText("กำลังขอรหัส QR Code จาก KuaiKan...")

    try {
      const res = await callGasApi<any>("GET_KUAIKAN_QR")
      if (res && res.success && res.uuid) {
        setQrData(res)
        setQrStatusText("กรุณาเปิดแอป WeChat สแกน QR Code ด้านล่าง")
        startPolling(res.uuid, res.state, res.cookies)
      } else {
        setScanState("expired")
        setQrStatusText(res?.error || "ไม่สามารถขอ QR Code ได้")
      }
    } catch (err: any) {
      setScanState("expired")
      setQrStatusText(err.message || "เกิดข้อผิดพลาดในการขอ QR Code")
    } finally {
      setQrLoading(false)
    }
  }

  // Poll WeChat QR Status (using dynamic script JSONP for zero-latency + fallback)
  const startPolling = (uuid: string, state: string, cookies: string[]) => {
    pollingRef.current = true

    const pollNext = async () => {
      if (!pollingRef.current) return

      try {
        // Method 1: Try Browser JSONP
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
            // If browser blocks script or CORS, fallback to backend check
            finish({ errcode: -999 })
          }

          document.body.appendChild(script)

          // Fallback timeout
          setTimeout(() => finish({ errcode: 408 }), 25000)
        })

        if (!pollingRef.current) return

        if (pollResult.errcode === 408) {
          // Waiting for scan
          setScanState("waiting")
          setQrStatusText("รอการสแกน QR Code...")
          setTimeout(pollNext, 1200)
        } else if (pollResult.errcode === 404) {
          // Scanned! Waiting for user to tap confirm on phone
          setScanState("scanned")
          setQrStatusText("📲 สแกนสำเร็จแล้ว! กรุณากดยืนยัน (Log In) บนมือถือของคุณ...")
          toast.info("ตรวจพบการสแกน! กรุณากดยืนยันบน WeChat ในมือถือ")
          setTimeout(pollNext, 800)
        } else if (pollResult.errcode === 405 && pollResult.code) {
          // Confirmed!
          setScanState("success")
          setQrStatusText("🎉 ยืนยันสำเร็จ! กำลังเชื่อมต่อและบันทึก Session...")
          toast.success("ยืนยันผ่าน WeChat สำเร็จ! กำลังบันทึกข้อมูล...")

          const saveRes = await callGasApi<any>("SAVE_KUAIKAN_AUTH", {
            code: pollResult.code,
            state,
            cookies,
          })

          if (saveRes && saveRes.success) {
            toast.success("บันทึก Session KuaiKan VIP เรียบร้อยแล้ว!")
            fetchSessionStatus()
            if (onSuccess) onSuccess()
          } else {
            toast.error(saveRes?.error || "บันทึก Session ไม่สำเร็จ")
          }
        } else if (pollResult.errcode === 402) {
          // Expired
          setScanState("expired")
          setQrStatusText("QR Code หมดอายุแล้ว กรุณากดรีเฟรช")
        } else if (pollResult.errcode === 403) {
          // Cancelled
          setScanState("expired")
          setQrStatusText("คุณยกเลิกการเข้าสู่ระบบบนมือถือ")
        } else {
          // Fallback to GAS Check
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
              setQrStatusText("📲 สแกนสำเร็จแล้ว! กรุณากดยืนยันบนมือถือ...")
              setTimeout(pollNext, 1000)
            } else if (checkRes.status === "success") {
              setScanState("success")
              setQrStatusText("🎉 เข้าสู่ระบบสำเร็จแล้ว!")
              toast.success("เข้าสู่ระบบ KuaiKan สำเร็จ!")
              fetchSessionStatus()
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
      toast.error("กรุณาระบุ Cookie เช่น connect.sid=...")
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
      loadQrCode()
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
          toast.success(`🎉 ปลดล็อคสำเร็จ! พบ ${res.imagesCount} ภาพต้นฉบับ HD`)
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
        mangaId: "1", // Target manga ID
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

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl bg-[#0d1322] border-[#26334d] text-slate-100 max-h-[92vh] overflow-y-auto">
        <DialogHeader className="border-b border-[#26334d] pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <Smartphone className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-white flex items-center gap-2">
                  เชื่อมต่อบัญชี KuaiKan VIP (快看漫画)
                  <span className="text-xs px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300">
                    WeChat QR
                  </span>
                </DialogTitle>
                <DialogDescription className="text-xs text-slate-400">
                  สแกน WeChat QR Code เพื่อล็อกอิน VIP และเก็บ Session ลงหลังบ้านอัตโนมัติ
                </DialogDescription>
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* Current Connection Status */}
        <div className="p-4 rounded-xl border border-[#26334d] bg-[#151d2f]/70 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {sessionStatus?.loggedIn ? (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
                <ShieldCheck className="h-5 w-5" />
              </div>
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400">
                <AlertCircle className="h-5 w-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  สถานะ:{" "}
                  {loadingSession ? (
                    <span className="text-slate-400">กำลังตรวจสอบ...</span>
                  ) : sessionStatus?.loggedIn ? (
                    <span className="text-emerald-400 font-bold">
                      เชื่อมต่อแล้ว {sessionStatus.isVip ? "👑 VIP Active" : "พร้อมใช้งาน"}
                    </span>
                  ) : (
                    <span className="text-amber-400">ยังไม่ได้เชื่อมต่อ</span>
                  )}
                </span>
              </div>
              {sessionStatus?.loggedIn && (
                <div className="text-xs text-slate-400">
                  อัปเดตล่าสุด:{" "}
                  {sessionStatus.updatedAt
                    ? new Date(sessionStatus.updatedAt).toLocaleString("th-TH")
                    : "-"}
                </div>
              )}
            </div>
          </div>

          {sessionStatus?.loggedIn && (
            <Button
              variant="outline"
              size="sm"
              className="text-red-400 border-red-500/30 hover:bg-red-500/10 hover:text-red-300 text-xs"
              onClick={handleClearSession}
            >
              <LogOut className="h-3.5 w-3.5 mr-1" /> ยกเลิกการเชื่อมต่อ
            </Button>
          )}
        </div>

        {/* Tabs switcher */}
        <div className="flex rounded-lg bg-[#151d2f] p-1 border border-[#26334d]">
          <button
            type="button"
            onClick={() => setActiveTab("qr")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeTab === "qr"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <QrCode className="h-4 w-4" /> สแกน QR Code ด้วย WeChat (แนะนำ)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("cookie")}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
              activeTab === "cookie"
                ? "bg-indigo-600 text-white shadow-sm"
                : "text-slate-400 hover:text-white"
            }`}
          >
            <KeyRound className="h-4 w-4" /> กรอก Cookie ด้วยตนเอง
          </button>
        </div>

        {/* Tab 1: WeChat QR Code */}
        {activeTab === "qr" && (
          <div className="flex flex-col items-center justify-center p-6 rounded-xl border border-[#26334d] bg-[#151d2f]/50 space-y-4">
            <div className="relative flex flex-col items-center">
              <div className="relative p-3 bg-white rounded-2xl shadow-xl shadow-black/40 border border-slate-200">
                {qrLoading ? (
                  <div className="w-52 h-52 flex flex-col items-center justify-center gap-3 text-slate-700">
                    <RefreshCw className="h-8 w-8 animate-spin text-indigo-600" />
                    <span className="text-xs font-medium">กำลังดึง QR Code...</span>
                  </div>
                ) : qrData?.qrUrl ? (
                  <div className="relative">
                    <img
                      src={qrData.qrUrl}
                      alt="KuaiKan WeChat QR"
                      className="w-52 h-52 object-contain rounded-lg"
                    />
                    {scanState === "scanned" && (
                      <div className="absolute inset-0 bg-emerald-950/80 backdrop-blur-xs flex flex-col items-center justify-center text-white rounded-lg p-2 text-center animate-fade-in">
                        <CheckCircle2 className="h-10 w-10 text-emerald-400 mb-1" />
                        <span className="text-xs font-bold text-emerald-300">
                          สแกนแล้ว!
                        </span>
                        <span className="text-[11px] text-slate-200">
                          กดยืนยันบน WeChat บนมือถือ
                        </span>
                      </div>
                    )}
                    {scanState === "success" && (
                      <div className="absolute inset-0 bg-indigo-950/90 backdrop-blur-xs flex flex-col items-center justify-center text-white rounded-lg p-2 text-center">
                        <Sparkles className="h-10 w-10 text-amber-400 mb-1 animate-bounce" />
                        <span className="text-xs font-bold text-emerald-300">
                          เชื่อมต่อสำเร็จ!
                        </span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-52 h-52 flex flex-col items-center justify-center gap-2 text-red-500">
                    <AlertCircle className="h-8 w-8" />
                    <span className="text-xs text-center">โหลด QR ไม่สำเร็จ</span>
                  </div>
                )}
              </div>

              {/* Status text badge */}
              <div className="mt-4 flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-800/80 border border-slate-700 text-xs">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    scanState === "waiting"
                      ? "bg-amber-400 animate-pulse"
                      : scanState === "scanned"
                      ? "bg-blue-400 animate-ping"
                      : scanState === "success"
                      ? "bg-emerald-400"
                      : "bg-slate-500"
                  }`}
                />
                <span className="text-slate-200 font-medium">{qrStatusText}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={loadQrCode}
                disabled={qrLoading}
                className="text-xs border-[#26334d]"
              >
                <RefreshCw className={`h-3.5 w-3.5 mr-1 ${qrLoading ? "animate-spin" : ""}`} />
                รีเฟรช QR Code
              </Button>
              <a
                href="https://www.kuaikanmanhua.com/webs/loginh"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
              >
                เปิดหน้าเว็บ KuaiKan โดยตรง <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        )}

        {/* Tab 2: Manual Cookie input */}
        {activeTab === "cookie" && (
          <div className="p-4 rounded-xl border border-[#26334d] bg-[#151d2f]/50 space-y-3">
            <div>
              <label className="text-xs font-medium text-slate-300 block mb-1">
                วาง Cookie ของ KuaiKan (เช่น connect.sid=... หรือทั้งก้อน)
              </label>
              <Textarea
                rows={3}
                placeholder="connect.sid=s%3A...; kk_s_t=...; uid=..."
                value={cookieInput}
                onChange={(e) => setCookieInput(e.target.value)}
                className="font-mono text-xs bg-[#0b0f19] border-[#26334d] text-slate-200"
              />
            </div>
            <div className="text-[11px] text-slate-400 leading-relaxed bg-[#0b0f19]/60 p-2.5 rounded-lg border border-[#26334d]">
              💡 <b>วิธีคัดลอก Cookie:</b> เปิดเว็บ{" "}
              <a
                href="https://www.kuaikanmanhua.com"
                target="_blank"
                rel="noreferrer"
                className="text-indigo-400 underline"
              >
                kuaikanmanhua.com
              </a>{" "}
              ที่ล็อกอิน VIP ไว้แล้ว &gt; กด F12 &gt; Application &gt; Cookies &gt; ดับเบิ้ลคลิกค่าที่{" "}
              <code>connect.sid</code> แล้วนำมาวางที่นี่
            </div>
            <Button
              className="w-full bg-indigo-600 hover:bg-indigo-500 text-xs"
              onClick={handleSaveCookie}
              disabled={savingCookie}
            >
              {savingCookie ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> กำลังตรวจสอบและบันทึก...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> บันทึกและทดสอบ Session
                </>
              )}
            </Button>
          </div>
        )}

        {/* Test Chapter Section (Chapter 366) */}
        <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-950/20 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-400" /> ทดสอบดึงตอนล่าสุด (第366话 真真假假)
              </div>
              <div className="text-[11px] text-slate-400">
                เรื่อง: 我！天命大反派 (comicId: 855368) • ตอน VIP/ติดเหรียญ
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleTestChapter}
              disabled={testingChapter}
              className="bg-indigo-600 hover:bg-indigo-500 text-xs shadow-md shadow-indigo-600/20"
            >
              {testingChapter ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> กำลังตรวจสอบ...
                </>
              ) : (
                <>
                  <ImageIcon className="h-3.5 w-3.5 mr-1" /> ⚡ ทดสอบปลดล็อคตอน 366
                </>
              )}
            </Button>
          </div>

          {/* Test Result Display */}
          {testResult && (
            <div className="p-3 rounded-lg border border-[#26334d] bg-[#0d1322] space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-slate-200">
                  ตอน: {testResult.title || "第366话"}
                </span>
                <span
                  className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
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

              {/* Sample images preview */}
              {testResult.sampleImages && testResult.sampleImages.length > 0 && (
                <div>
                  <div className="text-[11px] text-slate-400 mb-1.5">
                    ตัวอย่างภาพที่ดึงได้ ({testResult.sampleImages.length} ภาพแรก):
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {testResult.sampleImages.map((img: string, idx: number) => (
                      <div
                        key={idx}
                        className="relative rounded-lg overflow-hidden border border-[#26334d] bg-black/40 h-28 flex items-center justify-center"
                      >
                        <img
                          src={img}
                          alt={`Sample ${idx + 1}`}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                        <span className="absolute bottom-1 right-1 bg-black/70 text-[9px] px-1 rounded text-white">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Download Action */}
              {testResult.isVipUnlocked && testResult.imagesCount > 1 && (
                <div className="pt-2 border-t border-[#26334d] flex items-center justify-between">
                  <span className="text-[11px] text-emerald-400">
                    ✓ สามารถดาวน์โหลดภาพลง Google Drive และเข้าคิวงานได้ทันที
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleDownloadChapter}
                    disabled={downloading}
                    className="border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10 text-xs"
                  >
                    {downloading ? (
                      <>
                        <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1" /> กำลังดาวน์โหลด...
                      </>
                    ) : (
                      <>
                        <Download className="h-3.5 w-3.5 mr-1" /> โหลดลง Drive & เข้าคิวงาน
                      </>
                    )}
                  </Button>
                </div>
              )}

              {downloadResult && downloadResult.success && (
                <div className="p-2 rounded bg-emerald-950/40 border border-emerald-500/30 text-emerald-200 text-[11px] flex items-center justify-between">
                  <span>
                    ✓ โหลดเสร็จ {downloadResult.downloadedCount} ภาพ!{" "}
                    {downloadResult.queueAdded && "และเพิ่มเข้าคิวงานเรียบร้อยแล้ว"}
                  </span>
                  {downloadResult.folderUrl && (
                    <a
                      href={downloadResult.folderUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-indigo-400 hover:underline flex items-center gap-1 font-semibold"
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> เปิดโฟลเดอร์ Drive
                    </a>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

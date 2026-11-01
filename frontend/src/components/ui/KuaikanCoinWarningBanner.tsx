import * as React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  AlertTriangle,
  Coins,
  ExternalLink,
  RefreshCw,
  X,
  Flame,
  Plug,
  Crown,
} from "lucide-react"
import { useKuaikanCoinAlert, KuaikanCoinAlertInfo } from "@/lib/kuaikanCoinAlert"

interface KuaikanCoinWarningBannerProps {
  onNavigateConnectors?: () => void
  inCard?: boolean
  compact?: boolean
  className?: string
  overrideAlert?: KuaikanCoinAlertInfo | null
}

export function KuaikanCoinWarningBanner({
  onNavigateConnectors,
  inCard = false,
  compact = false,
  className = "",
  overrideAlert,
}: KuaikanCoinWarningBannerProps) {
  const {
    hasAlert,
    alertInfo,
    coinBalance,
    checkingWallet,
    dismissing,
    dismissAlert,
    checkWallet,
  } = useKuaikanCoinAlert()

  const currentAlert = overrideAlert !== undefined ? overrideAlert : alertInfo
  const isVisible = Boolean(
    overrideAlert !== undefined
      ? overrideAlert && overrideAlert.hasAlert && !overrideAlert.dismissed
      : hasAlert
  )

  if (!isVisible || !currentAlert) {
    return null
  }

  const comicTitle = currentAlert.comicTitle || ""
  const chapterTitle = currentAlert.chapterTitle || ""
  const requiredCoins = currentAlert.requiredCoins ?? 58
  const balance =
    currentAlert.currentBalance !== undefined && currentAlert.currentBalance !== null
      ? currentAlert.currentBalance
      : coinBalance !== null
      ? coinBalance
      : 0

  const isVipRequired = Boolean(
    currentAlert.vipRequired ||
    (currentAlert.message && (
      currentAlert.message.includes("VIP Early Access") ||
      currentAlert.message.includes("抢先看") ||
      currentAlert.message.includes("สมาชิก KuaiKan VIP")
    ))
  )

  const handleOpenKuaikanPay = () => {
    // Open KuaiKan Recharge / VIP page
    window.open("https://www.kuaikanmanhua.com/webs/user/pay", "_blank", "noopener,noreferrer")
  }

  // In-Card view (for ConnectorsView card)
  if (inCard) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border p-4 text-white shadow-lg ${
          isVipRequired
            ? "border-purple-500/50 bg-gradient-to-r from-purple-950/70 via-[#1a1226] to-amber-950/70 shadow-purple-950/30"
            : "border-rose-500/50 bg-gradient-to-r from-rose-950/70 via-[#1e131d] to-amber-950/70 shadow-rose-950/30"
        } ${className}`}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                isVipRequired
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                  : "bg-rose-500/20 border-rose-500/40 text-rose-400"
              }`}
            >
              {isVipRequired ? (
                <Crown className="h-5 w-5 animate-pulse text-amber-300" />
              ) : (
                <AlertTriangle className="h-5 w-5 animate-bounce" />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  className={`text-white font-bold text-xs border-0 ${
                    isVipRequired ? "bg-gradient-to-r from-purple-600 to-indigo-600" : "bg-rose-500"
                  }`}
                >
                  {isVipRequired ? "👑 KuaiKan VIP Required" : "⚠️ เหรียญ KuaiKan หมด / ไม่เพียงพอ"}
                </Badge>
                {comicTitle && (
                  <span className="text-xs text-amber-300 font-semibold">
                    สำหรับ: {comicTitle} {chapterTitle ? `(${chapterTitle})` : ""}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-200 mt-1">
                {isVipRequired ? (
                  <>
                    ตอนติดสถานะ <strong>VIP Early Access (抢先看)</strong> ต้องมีสมาชิก KuaiKan VIP เท่านั้น (ในบัญชีมี{" "}
                    <strong className="text-amber-400 font-bold">{balance} KK币</strong> — เหรียญไม่หมด แต่จำเป็นต้องต่ออายุ VIP)
                  </>
                ) : (
                  <>
                    ยอดเหรียญในบัญชีมี{" "}
                    <strong className="text-amber-400 font-bold">{balance} KK币</strong>{" "}
                    (ต้องการอย่างน้อย {requiredCoins} KK币 เพื่อปลดล็อคตอน) กรุณาเติมเหรียญในบัญชี KuaiKan
                  </>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <Button
              size="sm"
              onClick={handleOpenKuaikanPay}
              className={`text-white text-xs font-bold gap-1 shadow-md cursor-pointer border-0 ${
                isVipRequired
                  ? "bg-gradient-to-r from-purple-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 shadow-purple-500/20"
                  : "bg-gradient-to-r from-amber-500 to-rose-500 hover:from-amber-600 hover:to-rose-600 shadow-rose-500/20"
              }`}
              title={isVipRequired ? "เปิดหน้าต่างต่ออายุ VIP (开通VIP)" : "เปิดหน้าต่างเติมเหรียญ KuaiKan (快看充值)"}
            >
              {isVipRequired ? <Crown className="h-3.5 w-3.5" /> : <Coins className="h-3.5 w-3.5" />}
              <span>{isVipRequired ? "ต่ออายุ VIP (开通VIP)" : "เติมเหรียญ (快看充值)"}</span>
              <ExternalLink className="h-3 w-3 ml-0.5" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={checkWallet}
              disabled={checkingWallet}
              className={`text-xs ${
                isVipRequired
                  ? "border-purple-500/40 bg-purple-950/30 text-purple-300 hover:bg-purple-900/40"
                  : "border-rose-500/40 bg-rose-950/30 text-rose-300 hover:bg-rose-900/40"
              }`}
              title="ตรวจสอบยอดเหรียญและสถานะใหม่"
            >
              <RefreshCw className={`h-3.5 w-3.5 mr-1 ${checkingWallet ? "animate-spin" : ""}`} />
              ตรวจยอด
            </Button>
            <Button
              size="icon"
              variant="ghost"
              onClick={dismissAlert}
              disabled={dismissing}
              className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
              title="ปิดการแจ้งเตือนชั่วคราว"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Compact Banner view (for top of Dashboard or smaller sections)
  if (compact) {
    return (
      <div
        className={`relative overflow-hidden rounded-xl border p-3.5 text-white shadow-md animate-in fade-in slide-in-from-top-2 ${
          isVipRequired
            ? "border-purple-500/60 bg-gradient-to-r from-purple-950/80 via-amber-950/60 to-purple-950/80 shadow-purple-950/40"
            : "border-rose-500/60 bg-gradient-to-r from-rose-950/80 via-amber-950/60 to-rose-950/80 shadow-rose-950/40"
        } ${className}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className={`flex h-2.5 w-2.5 rounded-full animate-ping shrink-0 ${
                isVipRequired ? "bg-purple-400" : "bg-rose-500"
              }`}
            />
            {isVipRequired ? (
              <Crown className="h-4 w-4 text-amber-300 shrink-0" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
            )}
            <div className="truncate text-xs">
              <span className={`font-bold mr-1.5 ${isVipRequired ? "text-purple-300" : "text-rose-300"}`}>
                {isVipRequired ? "👑 VIP Required:" : "⚠️ เหรียญ KuaiKan หมด:"}
              </span>
              <span className="text-slate-200">
                {comicTitle ? `ตอน ${chapterTitle || ""} (${comicTitle}) ` : ""}
                {isVipRequired
                  ? `ตอนติด VIP Early Access (บัญชีมี ${balance} KK币 แต่ VIP หมดอายุ)`
                  : `ต้องการ ${requiredCoins} KK币 (มียอดคงเหลือ ${balance} KK币)`}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              size="sm"
              onClick={handleOpenKuaikanPay}
              className={`h-7 px-2.5 text-white text-[11px] font-semibold gap-1 border-0 cursor-pointer ${
                isVipRequired ? "bg-purple-600 hover:bg-purple-700" : "bg-rose-600 hover:bg-rose-700"
              }`}
            >
              {isVipRequired ? <Crown className="h-3 w-3" /> : <Coins className="h-3 w-3" />}
              <span>{isVipRequired ? "ต่ออายุ VIP" : "เติมเหรียญ"}</span>
              <ExternalLink className="h-2.5 w-2.5" />
            </Button>
            {onNavigateConnectors && (
              <Button
                size="sm"
                variant="outline"
                onClick={onNavigateConnectors}
                className="h-7 px-2 border-slate-700 bg-slate-900/60 text-slate-300 text-[11px]"
              >
                ดูตัวเชื่อมต่อ
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={dismissAlert}
              className="h-7 w-7 text-slate-400 hover:text-white"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Full Global Banner (Sticky / Prominent at Top of Screen)
  return (
    <div
      role="alert"
      className={`relative z-20 w-full border-b px-4 sm:px-8 py-3.5 text-white shadow-xl backdrop-blur-md transition-all ${
        isVipRequired
          ? "border-purple-500/50 bg-gradient-to-r from-purple-950/95 via-[#160d24]/95 to-amber-950/95 shadow-purple-950/50"
          : "border-rose-500/50 bg-gradient-to-r from-rose-950/95 via-[#1a0f1b]/95 to-amber-950/95 shadow-rose-950/50"
      } ${className}`}
    >
      <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Left: Icon & Alert Copy */}
        <div className="flex items-start gap-3 min-w-0">
          <div
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-xs mt-0.5 ${
              isVipRequired
                ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                : "bg-rose-500/20 border-rose-500/40 text-rose-400"
            }`}
          >
            {isVipRequired ? (
              <Crown className="h-5 w-5 animate-pulse text-amber-300" />
            ) : (
              <AlertTriangle className="h-5 w-5 animate-pulse text-amber-300" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-0.5 text-xs font-extrabold text-white tracking-wide shadow-sm ${
                  isVipRequired ? "bg-gradient-to-r from-purple-600 to-indigo-600" : "bg-rose-600"
                }`}
              >
                {isVipRequired ? <Crown className="h-3.5 w-3.5 fill-amber-300 text-amber-300" /> : <Flame className="h-3.5 w-3.5 fill-white" />}
                {isVipRequired ? "👑 แจ้งเตือน: ตอนติด KuaiKan VIP Early Access" : "⚠️ แจ้งเตือนฉุกเฉิน: เหรียญ KuaiKan หมด"}
              </span>
              {comicTitle && (
                <Badge
                  variant="outline"
                  className="border-amber-400/50 bg-amber-950/40 text-amber-300 text-[11px] font-semibold"
                >
                  {comicTitle} {chapterTitle ? `• ${chapterTitle}` : ""}
                </Badge>
              )}
            </div>

            <p className="text-xs sm:text-sm text-slate-200 mt-1 font-medium">
              {isVipRequired ? (
                <>
                  ตอนติดสถานะ{" "}
                  <strong className="text-amber-300 font-bold">
                    VIP Early Access (抢先看)
                  </strong>{" "}
                  ต้องมีสถานะสมาชิก KuaiKan VIP จึงจะสามารถอ่านได้ (ในบัญชีมี{" "}
                  <span className="text-amber-400 font-bold">{balance} KK币</span> — เหรียญไม่หมด แต่จำเป็นต้องต่ออายุ VIP)
                </>
              ) : (
                <>
                  ระบบตรวจพบว่า{" "}
                  <strong className="text-amber-300 font-bold">
                    ยอดเงินในบัญชี KuaiKan ไม่เพียงพอสำหรับการปลดล็อคตอน
                  </strong>
                  {requiredCoins > 0 && (
                    <span>
                      {" "}
                      (ต้องการ <span className="text-amber-400 font-bold">{requiredCoins} KK币</span>, ยอดปัจจุบัน:{" "}
                      <span className="text-rose-300 font-bold">{balance} KK币</span>)
                    </span>
                  )}
                  {" "}กรุณาเติมเหรียญเพื่อดาวน์โหลดและดำเนินการตอนถัดไป
                </>
              )}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0 self-end md:self-center pt-1 md:pt-0">
          <Button
            size="sm"
            onClick={handleOpenKuaikanPay}
            className={`text-white text-xs font-bold gap-1.5 shadow-md cursor-pointer border-0 ${
              isVipRequired
                ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-700 hover:to-amber-600 shadow-purple-600/30"
                : "bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-600 hover:to-rose-700 shadow-rose-600/30"
            }`}
            title={isVipRequired ? "เปิดหน้าต่างต่ออายุ VIP (快看会员)" : "เปิดหน้าต่างเติมเหรียญ KuaiKan"}
          >
            {isVipRequired ? <Crown className="h-4 w-4" /> : <Coins className="h-4 w-4" />}
            <span>{isVipRequired ? "ต่ออายุ KuaiKan VIP" : "เติมเหรียญ KuaiKan (快看充值)"}</span>
            <ExternalLink className="h-3 w-3 ml-0.5" />
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={checkWallet}
            disabled={checkingWallet}
            className={`text-xs font-semibold ${
              isVipRequired
                ? "border-purple-500/40 bg-purple-950/40 text-purple-200 hover:bg-purple-900/50"
                : "border-rose-500/40 bg-rose-950/40 text-rose-200 hover:bg-rose-900/50"
            }`}
            title="รีเฟรชตรวจสอบยอดและสถานะใหม่"
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checkingWallet ? "animate-spin" : ""}`} />
            ตรวจยอดใหม่
          </Button>

          {onNavigateConnectors && (
            <Button
              size="sm"
              variant="outline"
              onClick={onNavigateConnectors}
              className="border-[#26334d] bg-[#151d2f] text-slate-300 hover:text-white text-xs"
              title="ไปที่หน้าจัดการตัวเชื่อมต่อ KuaiKan"
            >
              <Plug className="h-3.5 w-3.5 mr-1.5 text-amber-400" />
              ตัวเชื่อมต่อ
            </Button>
          )}

          <Button
            size="icon"
            variant="ghost"
            onClick={dismissAlert}
            disabled={dismissing}
            className="h-8 w-8 text-slate-400 hover:text-white hover:bg-white/10"
            title="ปิดการแจ้งเตือนชั่วคราว"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

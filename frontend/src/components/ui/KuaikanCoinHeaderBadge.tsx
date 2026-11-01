import * as React from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Crown } from "lucide-react"
import { useKuaikanCoinAlert } from "@/lib/kuaikanCoinAlert"

interface KuaikanCoinHeaderBadgeProps {
  onClick: () => void
}

export function KuaikanCoinHeaderBadge({ onClick }: KuaikanCoinHeaderBadgeProps) {
  const { hasAlert, alertInfo, coinBalance } = useKuaikanCoinAlert()

  if (!hasAlert) return null

  const isVipAlert = Boolean(
    alertInfo?.vipRequired ||
    (alertInfo?.message && (alertInfo.message.includes("VIP Early Access") || alertInfo.message.includes("抢先看") || alertInfo.message.includes("สมาชิก KuaiKan VIP")))
  )

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={onClick}
      className={
        isVipAlert
          ? "bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-600 hover:from-purple-700 hover:to-amber-700 text-white font-extrabold text-xs gap-1.5 shadow-lg shadow-purple-600/30 animate-pulse cursor-pointer border border-purple-400/40"
          : "bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold text-xs gap-1.5 shadow-lg shadow-rose-600/30 animate-pulse cursor-pointer border border-rose-400/40"
      }
      title={
        isVipAlert
          ? "คำเตือน: ตรวจพบตอนติด VIP Early Access ต้องใช้สมาชิก VIP! คลิกเพื่อดูรายละเอียด"
          : "คำเตือนฉุกเฉิน: ตรวจพบเหรียญ KuaiKan หมด! คลิกเพื่อดูรายละเอียด"
      }
    >
      {isVipAlert ? (
        <Crown className="h-3.5 w-3.5 text-amber-200 fill-amber-300/40" />
      ) : (
        <AlertTriangle className="h-3.5 w-3.5 text-amber-200 fill-amber-300/40" />
      )}
      <span className="font-bold">{isVipAlert ? "👑 KuaiKan VIP Required" : "⚠️ เหรียญ KuaiKan หมด"}</span>
      {coinBalance !== null && (
        <span className="hidden md:inline text-[11px] font-normal opacity-90">
          ({coinBalance} KK币)
        </span>
      )}
    </Button>
  )
}

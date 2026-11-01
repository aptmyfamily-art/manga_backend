import * as React from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle, Coins } from "lucide-react"
import { useKuaikanCoinAlert } from "@/lib/kuaikanCoinAlert"

interface KuaikanCoinHeaderBadgeProps {
  onClick: () => void
}

export function KuaikanCoinHeaderBadge({ onClick }: KuaikanCoinHeaderBadgeProps) {
  const { hasAlert, coinBalance } = useKuaikanCoinAlert()

  if (!hasAlert) return null

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={onClick}
      className="bg-gradient-to-r from-rose-600 via-rose-500 to-amber-600 hover:from-rose-700 hover:to-amber-700 text-white font-extrabold text-xs gap-1.5 shadow-lg shadow-rose-600/30 animate-pulse cursor-pointer border border-rose-400/40"
      title="คำเตือนฉุกเฉิน: ตรวจพบเหรียญ KuaiKan หมด / ไม่พอสำหรับตอน VIP! คลิกเพื่อดูรายละเอียด"
    >
      <AlertTriangle className="h-3.5 w-3.5 text-amber-200 fill-amber-300/40" />
      <span className="font-bold">⚠️ เหรียญ KuaiKan หมด</span>
      {coinBalance !== null && (
        <span className="hidden md:inline text-[11px] font-normal opacity-90">
          ({coinBalance} KK币)
        </span>
      )}
    </Button>
  )
}

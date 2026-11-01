import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { callGasApi, getSavedPasscode } from "@/api/gasClient"
import { toast } from "sonner"

export interface KuaikanCoinAlertInfo {
  hasAlert: boolean
  message?: string
  comicTitle?: string
  chapterTitle?: string
  comicId?: string
  requiredCoins?: number | null
  currentBalance?: number | null
  timestamp?: string
  dismissed?: boolean
  vipRequired?: boolean
}

export interface KuaikanVipInfo {
  isVip: boolean
  vipType?: number
  remainedDays?: number
  expireDate?: string
  raw?: any
}

export interface KuaikanSessionAuthResponse {
  loggedIn: boolean
  isVip?: boolean
  vipInfo?: KuaikanVipInfo | null
  updatedAt?: string
  cookiePreview?: string
  coinBalance?: number | null
  insufficientCoins?: boolean
  vipRequired?: boolean
  coinAlert?: KuaikanCoinAlertInfo | null
  message?: string
  user?: any
  walletDetails?: any
}

const STORAGE_COIN_ALERT_KEY = "mangahub_kuaikan_coin_alert"
const COIN_ALERT_EVENT = "kuaikan-coin-alert-change"

export function getCachedCoinAlert(): KuaikanCoinAlertInfo | null {
  try {
    const raw = localStorage.getItem(STORAGE_COIN_ALERT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    return parsed
  } catch {
    return null
  }
}

export function setCachedCoinAlert(alert: KuaikanCoinAlertInfo | null) {
  try {
    if (alert) {
      localStorage.setItem(STORAGE_COIN_ALERT_KEY, JSON.stringify(alert))
    } else {
      localStorage.removeItem(STORAGE_COIN_ALERT_KEY)
    }
  } catch {}
}

export function notifyCoinAlertChange(alert: KuaikanCoinAlertInfo | null) {
  setCachedCoinAlert(alert)
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(COIN_ALERT_EVENT, { detail: alert })
    )
  }
}

/**
 * Hook สำหรับจัดการและติดตามสถานะแจ้งเตือนเหรียญ KuaiKan หมด
 */
export function useKuaikanCoinAlert() {
  const queryClient = useQueryClient()
  const passcode = getSavedPasscode()
  const [localAlert, setLocalAlert] = React.useState<KuaikanCoinAlertInfo | null>(getCachedCoinAlert)
  const [checkingWallet, setCheckingWallet] = React.useState(false)
  const [dismissing, setDismissing] = React.useState(false)

  // Listen to custom cross-component events
  React.useEffect(() => {
    const handleAlertEvent = (e: any) => {
      setLocalAlert(e.detail || null)
    }
    window.addEventListener(COIN_ALERT_EVENT, handleAlertEvent)
    return () => window.removeEventListener(COIN_ALERT_EVENT, handleAlertEvent)
  }, [])

  // Query KuaiKan Session & Wallet from GAS backend
  const {
    data: sessionData,
    isLoading: loadingSession,
    isFetching: fetchingSession,
    refetch: refetchSession,
  } = useQuery<KuaikanSessionAuthResponse>({
    queryKey: ["kuaikanSessionAuth", passcode],
    queryFn: async () => {
      try {
        const res = await callGasApi<KuaikanSessionAuthResponse>("GET_KUAIKAN_SESSION")
        if (res) {
          // If backend has active coin alert
          if (res.coinAlert && res.coinAlert.hasAlert && !res.coinAlert.dismissed) {
            notifyCoinAlertChange(res.coinAlert)
          } else if (res.insufficientCoins) {
            const fallbackAlert: KuaikanCoinAlertInfo = {
              hasAlert: true,
              message: "เหรียญ KuaiKan หมด หรือไม่เพียงพอสำหรับการปลดล็อคตอน VIP กรุณาเติมเหรียญ",
              currentBalance: res.coinBalance !== undefined ? res.coinBalance : 0,
              timestamp: res.updatedAt || new Date().toISOString(),
              dismissed: false,
            }
            notifyCoinAlertChange(fallbackAlert)
          } else if (res.coinAlert && res.coinAlert.dismissed) {
            // Respect dismissed status
            setCachedCoinAlert(res.coinAlert)
          }
        }
        return res
      } catch (err) {
        console.warn("fetch kuaikan session error:", err)
        return { loggedIn: false, message: "เชื่อมต่อไม่สำเร็จ" }
      }
    },
    enabled: Boolean(passcode),
    staleTime: 60 * 1000, // 1 minute
    refetchInterval: 90 * 1000, // Check every 90 seconds
  })

  // Computed alert state
  const effectiveAlert: KuaikanCoinAlertInfo | null = React.useMemo(() => {
    if (localAlert && localAlert.hasAlert && !localAlert.dismissed) {
      return localAlert
    }
    if (sessionData?.coinAlert && sessionData.coinAlert.hasAlert && !sessionData.coinAlert.dismissed) {
      return sessionData.coinAlert
    }
    if (sessionData?.insufficientCoins) {
      return {
        hasAlert: true,
        message: "เหรียญ KuaiKan หมด หรือไม่เพียงพอสำหรับการปลดล็อคตอน VIP กรุณาเติมเหรียญ",
        currentBalance: sessionData.coinBalance !== undefined ? sessionData.coinBalance : 0,
        timestamp: sessionData.updatedAt || new Date().toISOString(),
      }
    }
    return null
  }, [localAlert, sessionData])

  const hasAlert = Boolean(effectiveAlert && effectiveAlert.hasAlert && !effectiveAlert.dismissed)

  // Dismiss notification
  const dismissAlert = React.useCallback(async () => {
    setDismissing(true)
    const updated: KuaikanCoinAlertInfo = {
      ...(effectiveAlert || { hasAlert: false }),
      hasAlert: false,
      dismissed: true,
    }
    notifyCoinAlertChange(updated)
    try {
      await callGasApi("DISMISS_KUAIKAN_COIN_ALERT")
      queryClient.setQueryData(["kuaikanSessionAuth", passcode], (old: any) => ({
        ...(old || {}),
        insufficientCoins: false,
        coinAlert: { ...(old?.coinAlert || {}), hasAlert: false, dismissed: true },
      }))
      toast.info("ปิดการแจ้งเตือนเหรียญเรียบร้อยแล้ว")
    } catch (e: any) {
      console.warn("dismiss alert error:", e)
    } finally {
      setDismissing(false)
    }
  }, [effectiveAlert, passcode, queryClient])

  // Refresh wallet and check coins
  const checkWallet = React.useCallback(async () => {
    setCheckingWallet(true)
    try {
      const res = await callGasApi<any>("CHECK_KUAIKAN_WALLET")
      if (res) {
        queryClient.invalidateQueries({ queryKey: ["kuaikanSessionAuth"] })
        if (res.coinBalance !== undefined && res.coinBalance > 0 && !res.insufficientCoins) {
          dismissAlert()
          toast.success(`ตรวจสอบสำเร็จ: ยอดเหรียญ KuaiKan คงเหลือ ${res.coinBalance} KK币`)
        } else if (res.insufficientCoins || (res.coinAlert && res.coinAlert.hasAlert)) {
          toast.warning("ยอดเหรียญ KuaiKan ยังคงไม่เพียงพอ กรุณาเติมเหรียญ")
        } else {
          toast.info("อัปเดตสถานะบัญชี KuaiKan เรียบร้อยแล้ว")
        }
      }
    } catch (err: any) {
      toast.error("ตรวจสอบยอดเหรียญไม่สำเร็จ: " + (err.message || ""))
    } finally {
      setCheckingWallet(false)
    }
  }, [queryClient, dismissAlert])

  // Trigger alert programmatically (e.g. from chapter fetch failure)
  const triggerAlert = React.useCallback(
    async (info: Partial<KuaikanCoinAlertInfo>) => {
      const newAlert: KuaikanCoinAlertInfo = {
        hasAlert: true,
        message: info.message || "เหรียญ KuaiKan ไม่เพียงพอสำหรับการปลดล็อคตอน VIP กรุณาเติมเหรียญ",
        comicTitle: info.comicTitle || "",
        chapterTitle: info.chapterTitle || "",
        comicId: info.comicId || "",
        requiredCoins: info.requiredCoins !== undefined ? info.requiredCoins : 58,
        currentBalance: info.currentBalance !== undefined ? info.currentBalance : (sessionData?.coinBalance ?? 0),
        timestamp: new Date().toISOString(),
        dismissed: false,
      }
      notifyCoinAlertChange(newAlert)
      try {
        await callGasApi("SET_KUAIKAN_COIN_ALERT", newAlert)
        queryClient.invalidateQueries({ queryKey: ["kuaikanSessionAuth"] })
      } catch (e) {
        console.warn("triggerAlert error:", e)
      }
    },
    [queryClient, sessionData?.coinBalance]
  )

  return {
    hasAlert,
    alertInfo: effectiveAlert,
    sessionData,
    vipInfo: sessionData?.vipInfo || null,
    isVip: Boolean(sessionData?.isVip || sessionData?.vipInfo?.isVip),
    coinBalance: sessionData?.coinBalance ?? effectiveAlert?.currentBalance ?? null,
    isLoading: loadingSession || fetchingSession,
    checkingWallet,
    dismissing,
    dismissAlert,
    checkWallet,
    triggerAlert,
    refetchSession,
  }
}

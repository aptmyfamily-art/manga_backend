import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Toaster, toast } from "sonner"
import {
  callGasApi,
  getSavedPasscode,
  setSavedPasscode,
} from "@/api/gasClient"
import { PasscodeGate } from "@/components/views/PasscodeGate"
import { DashboardView } from "@/components/views/DashboardView"
import { QueueView } from "@/components/views/QueueView"
import { TeamView } from "@/components/views/TeamView"
import { FinancialsView } from "@/components/views/FinancialsView"
import { BudgetView } from "@/components/views/BudgetView"
import { MangaSettingsView } from "@/components/views/MangaSettingsView"
import { MangaModal } from "@/components/modals/MangaModal"
import {
  AddQueueModal,
  UpdateQueueModal,
} from "@/components/modals/QueueModals"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  TrendingUp,
  Wallet,
  Settings,
  Menu,
  X,
  LogOut,
  RefreshCw,
  BookOpen,
  Lock,
} from "lucide-react"

type ViewKey =
  | "dashboard"
  | "queue"
  | "team"
  | "financials"
  | "budget"
  | "settings"

const REFRESH_INTERVAL_SEC = 600 // 10 minutes

export default function App() {
  const queryClient = useQueryClient()
  const [passcode, setPasscode] = React.useState<string>(getSavedPasscode())
  const [activeView, setActiveView] = React.useState<ViewKey>("dashboard")
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [queueSearchTerm, setQueueSearchTerm] = React.useState("")

  // Sensitive view passcode modal (Financials / Budget)
  const [sensitiveGateOpen, setSensitiveGateOpen] = React.useState(false)
  const [pendingSensitiveView, setPendingSensitiveView] =
    React.useState<ViewKey | null>(null)
  const [sensitivePassInput, setSensitivePassInput] = React.useState("")
  const [verifyingSensitive, setVerifyingSensitive] = React.useState(false)

  // Global Modals
  const [mangaModalOpen, setMangaModalOpen] = React.useState(false)
  const [editingManga, setEditingManga] = React.useState<any | null>(null)
  const [returnToAddQueue, setReturnToAddQueue] = React.useState(false)
  const [preselectedQueueMangaId, setPreselectedQueueMangaId] =
    React.useState<string>("")

  const [addQueueOpen, setAddQueueOpen] = React.useState(false)
  const [updateQueueOpen, setUpdateQueueOpen] = React.useState(false)
  const [editingQueueItem, setEditingQueueItem] = React.useState<any | null>(
    null
  )

  // Queue period filter (controls which month/year is fetched from GAS)
  const nowInit = React.useMemo(() => new Date(), [])
  const [queueMonth, setQueueMonth] = React.useState<string>(
    String(nowInit.getMonth() + 1)
  )
  const [queueYear, setQueueYear] = React.useState<string>(
    String(nowInit.getFullYear())
  )
  const [fetchingPeriod, setFetchingPeriod] = React.useState(false)

  // Countdown timer state
  const [lastFetchDate, setLastFetchDate] = React.useState<Date>(new Date())
  const [countdown, setCountdown] = React.useState(REFRESH_INTERVAL_SEC)

  const {
    data: dashboardData,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: ["dashboardData", passcode],
    queryFn: async () => {
      const res = await callGasApi("GET_DASHBOARD_DATA", {
        forceRefresh: false,
        month: queueMonth,
        year: queueYear,
      })
      setLastFetchDate(new Date())
      setCountdown(REFRESH_INTERVAL_SEC)
      return res
    },
    enabled: Boolean(passcode),
    refetchInterval: REFRESH_INTERVAL_SEC * 1000,
    retry: 1,
  })

  const handleQueuePeriodChange = async (newMonth: string, newYear: string) => {
    setQueueMonth(newMonth)
    setQueueYear(newYear)
    setFetchingPeriod(true)
    const toastId = "fetch-queue-period"
    const label =
      newMonth === "all" && newYear === "all"
        ? "ทั้งหมดทุกปี"
        : newMonth === "all"
        ? `ทั้งปี ${Number(newYear) + 543}`
        : `เดือน ${newMonth}/${Number(newYear) + 543}`
    toast.loading(`กำลังดึงข้อมูลคิวงาน (${label})...`, { id: toastId })
    try {
      const newQueue = await callGasApi("GET_WORK_QUEUE", {
        forceRefresh: false,
        month: newMonth,
        year: newYear,
        includeIncomplete: false,
      })
      updateCachedField("queue", newQueue)
      toast.success(`ดึงคิวงาน (${label}) สำเร็จ (${newQueue.length} รายการ)`, {
        id: toastId,
      })
    } catch (err: any) {
      toast.error(err.message || "ดึงข้อมูลคิวงานไม่สำเร็จ", { id: toastId })
    } finally {
      setFetchingPeriod(false)
    }
  }

  React.useEffect(() => {
    if (!passcode) return
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : REFRESH_INTERVAL_SEC))
    }, 1000)
    return () => clearInterval(timer)
  }, [passcode])

  const handleManualRefresh = async () => {
    toast.loading("กำลังซิงค์ข้อมูลล่าสุดจาก Google Sheets...", {
      id: "manual-refresh",
    })
    try {
      const fresh = await callGasApi("GET_DASHBOARD_DATA", {
        forceRefresh: true,
        month: queueMonth,
        year: queueYear,
      })
      queryClient.setQueryData(["dashboardData", passcode], fresh)
      setLastFetchDate(new Date())
      setCountdown(REFRESH_INTERVAL_SEC)
      toast.success("อัปเดตข้อมูลล่าสุดเรียบร้อยแล้ว", { id: "manual-refresh" })
    } catch (err: any) {
      if (err.code === "UNAUTHORIZED") {
        setSavedPasscode("")
        setPasscode("")
      }
      toast.error(err.message || "ซิงค์ข้อมูลไม่สำเร็จ", {
        id: "manual-refresh",
      })
    }
  }

  const updateCachedField = (field: string, value: any) => {
    queryClient.setQueryData(["dashboardData", passcode], (old: any) => ({
      ...(old || {}),
      [field]: value,
    }))
  }

  const handleNavClick = (view: ViewKey) => {
    setSidebarOpen(false)
    if (view === "financials" || view === "budget") {
      setPendingSensitiveView(view)
      setSensitivePassInput("")
      setSensitiveGateOpen(true)
      return
    }
    setActiveView(view)
  }

  const handleVerifySensitivePass = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!sensitivePassInput.trim()) return
    setVerifyingSensitive(true)
    try {
      const res = await callGasApi<{ valid: boolean }>("VERIFY_PASSCODE", {
        passcode: sensitivePassInput.trim(),
      })
      if (res && res.valid) {
        setSensitiveGateOpen(false)
        if (pendingSensitiveView) {
          setActiveView(pendingSensitiveView)
          setPendingSensitiveView(null)
        }
      } else {
        toast.error("รหัสผ่านไม่ถูกต้อง")
      }
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการตรวจสอบรหัสผ่าน")
    } finally {
      setVerifyingSensitive(false)
    }
  }

  if (!passcode) {
    return (
      <>
        <Toaster richColors position="top-right" />
        <PasscodeGate
          onAuthenticated={(code) => {
            setSavedPasscode(code)
            setPasscode(code)
          }}
        />
      </>
    )
  }

  const mangaList = Array.isArray(dashboardData?.manga)
    ? dashboardData.manga
    : []
  const queueList = Array.isArray(dashboardData?.queue)
    ? dashboardData.queue
    : []
  const teamList = Array.isArray(dashboardData?.team) ? dashboardData.team : []
  const salesList = Array.isArray(dashboardData?.sales)
    ? dashboardData.sales
    : []
  const payeeList = Array.isArray(dashboardData?.payees)
    ? dashboardData.payees
    : []
  const transactionList = Array.isArray(dashboardData?.transactions)
    ? dashboardData.transactions
    : []
  const websiteList = Array.isArray(dashboardData?.websites)
    ? dashboardData.websites
    : []

  const nextFetchDate = new Date(
    lastFetchDate.getTime() + REFRESH_INTERVAL_SEC * 1000
  )

  const navItems: Array<{ id: ViewKey; label: string; icon: any }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "queue", label: "จัดการคิวงาน", icon: ClipboardList },
    { id: "team", label: "จัดการทีมงาน", icon: Users },
    { id: "financials", label: "รายงานกำไร-ขาดทุน", icon: TrendingUp },
    { id: "budget", label: "งบประมาณ & บัญชี", icon: Wallet },
    { id: "settings", label: "ตั้งค่ามังงะ", icon: Settings },
  ]

  return (
    <div className="min-h-screen flex bg-[#0b0f19] text-slate-100">
      <Toaster richColors position="top-right" />

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-68 border-r border-[#26334d] bg-[#0d1322] flex flex-col transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-[#26334d]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-600/30">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight text-white">
                MangaHub
              </span>
              <span className="block text-[10px] text-indigo-400 font-medium">
                Cloud Management v2.0
              </span>
            </div>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden text-slate-400 hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeView === item.id
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-all cursor-pointer ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/30"
                    : "text-slate-400 hover:bg-slate-800/60 hover:text-white"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-[#26334d]">
          <Button
            variant="ghost"
            className="w-full justify-start text-slate-400 hover:text-red-400"
            onClick={() => {
              setSavedPasscode("")
              setPasscode("")
              toast.info("ออกจากระบบเรียบร้อยแล้ว")
            }}
          >
            <LogOut className="h-4 w-4" /> ออกจากระบบ
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 lg:pl-68 flex flex-col min-w-0">
        {/* Top Bar with Cloud Refresh Status */}
        <header className="sticky top-0 z-30 flex items-center justify-between gap-4 border-b border-[#26334d] bg-[#0b0f19]/90 backdrop-blur-md px-4 sm:px-8 py-3">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden rounded-lg border border-[#26334d] bg-[#151d2f] p-2 text-slate-200"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="rounded-xl border border-[#26334d] bg-[#151d2f] px-3.5 py-1.5 text-right text-xs text-slate-400 shadow-xs">
              <div className="flex items-center justify-end gap-1.5 font-semibold text-slate-200">
                <span
                  className={`h-2 w-2 rounded-full ${
                    isFetching
                      ? "bg-amber-400 animate-ping"
                      : "bg-emerald-400"
                  }`}
                />
                {isFetching
                  ? "กำลังดึงข้อมูล..."
                  : "สถานะคลาวด์: เชื่อมต่อปกติ"}
              </div>
              <div className="hidden sm:block text-[11px]">
                ดึงล่าสุด: {lastFetchDate.toLocaleTimeString("th-TH")} |{" "}
                <span className="text-indigo-400 font-medium">
                  รอบถัดไป: {nextFetchDate.toLocaleTimeString("th-TH")} (
                  {countdown}s)
                </span>
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isFetching}
              title="ซิงค์ข้อมูลทันที (Bypass Cache)"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
            </Button>
          </div>
        </header>

        {/* View Container */}
        <main className="flex-1 p-4 sm:p-8 max-w-[1600px] w-full mx-auto">
          {activeView === "dashboard" && (
            <DashboardView
              mangaList={mangaList}
              queueList={queueList}
              isLoading={isLoading}
              onSwitchToQueue={(term) => {
                if (term) setQueueSearchTerm(term)
                setActiveView("queue")
              }}
              onOpenUpdateQueue={(q) => {
                setEditingQueueItem(q)
                setUpdateQueueOpen(true)
              }}
              onManualRefresh={handleManualRefresh}
            />
          )}

          {activeView === "queue" && (
            <QueueView
              mangaList={mangaList}
              queueList={queueList}
              teamList={teamList}
              isLoading={isLoading || fetchingPeriod}
              monthFilter={queueMonth}
              yearFilter={queueYear}
              onPeriodChange={handleQueuePeriodChange}
              initialSearch={queueSearchTerm}
              onClearInitialSearch={() => setQueueSearchTerm("")}
              onOpenAddQueue={() => {
                setPreselectedQueueMangaId("")
                setAddQueueOpen(true)
              }}
              onOpenUpdateQueue={(q) => {
                setEditingQueueItem(q)
                setUpdateQueueOpen(true)
              }}
              onQueueChange={(newQueue) => updateCachedField("queue", newQueue)}
            />
          )}

          {activeView === "team" && (
            <TeamView
              teamList={teamList}
              onTeamChange={(newTeam) => updateCachedField("team", newTeam)}
            />
          )}

          {activeView === "financials" && (
            <FinancialsView
              mangaList={mangaList}
              salesList={salesList}
              websiteList={websiteList}
              onSalesChange={(newSales, newWebsites) => {
                updateCachedField("sales", newSales)
                if (newWebsites) updateCachedField("websites", newWebsites)
              }}
            />
          )}

          {activeView === "budget" && (
            <BudgetView
              payeeList={payeeList}
              transactionList={transactionList}
              websiteList={websiteList}
              onPayeesChange={(newPayees) =>
                updateCachedField("payees", newPayees)
              }
              onTransactionsChange={(newTrans) =>
                updateCachedField("transactions", newTrans)
              }
            />
          )}

          {activeView === "settings" && (
            <MangaSettingsView
              mangaList={mangaList}
              onOpenAddManga={() => {
                setEditingManga(null)
                setReturnToAddQueue(false)
                setMangaModalOpen(true)
              }}
              onOpenEditManga={(m) => {
                setEditingManga(m)
                setReturnToAddQueue(false)
                setMangaModalOpen(true)
              }}
              onMangaChange={(newManga) => updateCachedField("manga", newManga)}
              onQueueChange={(newQueue) => updateCachedField("queue", newQueue)}
            />
          )}
        </main>
      </div>

      {/* Global Add Queue Modal */}
      <AddQueueModal
        open={addQueueOpen}
        onClose={() => setAddQueueOpen(false)}
        mangaList={mangaList}
        teamList={teamList}
        preselectedMangaId={preselectedQueueMangaId}
        onOpenAddManga={() => {
          setAddQueueOpen(false)
          setEditingManga(null)
          setReturnToAddQueue(true)
          setMangaModalOpen(true)
        }}
        onSuccess={(newQueue, newManga) => {
          updateCachedField("queue", newQueue)
          if (newManga) updateCachedField("manga", newManga)
        }}
      />

      {/* Global Update Queue Modal */}
      <UpdateQueueModal
        open={updateQueueOpen}
        onClose={() => setUpdateQueueOpen(false)}
        item={editingQueueItem}
        mangaList={mangaList}
        teamList={teamList}
        onSuccess={(newQueue) => updateCachedField("queue", newQueue)}
      />

      {/* Global Add/Edit Manga Modal */}
      <MangaModal
        open={mangaModalOpen}
        onClose={() => {
          setMangaModalOpen(false)
          if (returnToAddQueue) {
            setReturnToAddQueue(false)
            setAddQueueOpen(true)
          }
        }}
        editItem={editingManga}
        teamList={teamList}
        onSuccess={(updatedList, newMangaId) => {
          updateCachedField("manga", updatedList)
          if (returnToAddQueue) {
            setReturnToAddQueue(false)
            if (newMangaId) setPreselectedQueueMangaId(String(newMangaId))
            setAddQueueOpen(true)
          }
        }}
      />

      {/* Passcode Prompt for Financials / Budget */}
      <Dialog
        open={sensitiveGateOpen}
        onOpenChange={(v) => !v && setSensitiveGateOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-amber-400" />
              ยืนยันรหัสผ่านเข้าหน้าการเงิน/บัญชี
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleVerifySensitivePass} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>กรุณากรอกรหัสผ่าน</Label>
              <Input
                type="password"
                placeholder="รหัสผ่าน..."
                value={sensitivePassInput}
                onChange={(e) => setSensitivePassInput(e.target.value)}
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setSensitiveGateOpen(false)}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={verifyingSensitive}>
                {verifyingSensitive ? "กำลังตรวจสอบ..." : "ยืนยัน"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

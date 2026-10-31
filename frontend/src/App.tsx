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
import { ExpensesView } from "@/components/views/ExpensesView"
import { RawTrackerView } from "@/components/views/RawTrackerView"
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
  Receipt,
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
  Radio,
} from "lucide-react"

type ViewKey =
  | "dashboard"
  | "queue"
  | "tracker"
  | "expenses"
  | "team"
  | "financials"
  | "budget"
  | "settings"

function getViewFromLocation(): ViewKey {
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "").toLowerCase()
  const validViews: ViewKey[] = [
    "dashboard",
    "queue",
    "tracker",
    "expenses",
    "team",
    "financials",
    "budget",
    "settings",
  ]
  if (validViews.includes(path as ViewKey)) {
    return path as ViewKey
  }
  return "dashboard"
}

export default function App() {
  const queryClient = useQueryClient()
  const [passcode, setPasscode] = React.useState<string>(getSavedPasscode())
  const [activeView, setActiveView] = React.useState<ViewKey>(getViewFromLocation)
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [queueSearchTerm, setQueueSearchTerm] = React.useState("")

  const changeView = (view: ViewKey) => {
    setActiveView(view)
    const targetPath = `/${view}`
    if (window.location.pathname !== targetPath) {
      window.history.pushState(null, "", targetPath)
    }
  }

  React.useEffect(() => {
    const onPopState = () => {
      setActiveView(getViewFromLocation())
    }
    window.addEventListener("popstate", onPopState)
    return () => window.removeEventListener("popstate", onPopState)
  }, [])

  // Sync initial clean URL on mount if at root
  React.useEffect(() => {
    if (window.location.pathname === "/" || window.location.pathname === "") {
      window.history.replaceState(null, "", `/${activeView}`)
    }
  }, [activeView])

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
  const [preselectedQueueChapter, setPreselectedQueueChapter] =
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

  // In-memory state for fast dynamic reactivity
  const [mangaList, setMangaList] = React.useState<any[]>([])
  const [teamList, setTeamList] = React.useState<any[]>([])
  const [queueList, setQueueList] = React.useState<any[]>([])

  // 1. Single Unified Initial Boot Query (1 single GAS call = 1 V8 container, 1 openById, ZERO concurrency lock contention!)
  const {
    data: initialData,
    isLoading: loadingInitial,
    isFetching: fetchingInitial,
    refetch: refetchInitial,
  } = useQuery({
    queryKey: ["initialDashboardData", passcode],
    queryFn: async () => {
      const res = await callGasApi("GET_DASHBOARD_DATA", {
        month: queueMonth,
        year: queueYear,
      })
      if (res) {
        if (Array.isArray(res.manga)) setMangaList(res.manga)
        if (Array.isArray(res.team)) setTeamList(res.team)
        if (Array.isArray(res.queue)) setQueueList(res.queue)
      }
      return res
    },
    enabled: Boolean(passcode),
    staleTime: 5 * 60 * 1000,
  })

  // 2. On-Demand Data: Financials (Only fetched when user unlocks/opens Financials view)
  const {
    data: financialData,
    isLoading: loadingFinancials,
    isFetching: fetchingFinancials,
    refetch: refetchFinancials,
  } = useQuery<{ manga?: any[]; sales?: any[]; websites?: string[] }>({
    queryKey: ["financialData", passcode],
    queryFn: () => callGasApi("GET_FINANCIAL_DATA"),
    enabled: Boolean(passcode) && activeView === "financials",
    staleTime: 3 * 60 * 1000,
  })

  // 3. On-Demand Data: Budget (Only fetched when user unlocks/opens Budget view)
  const {
    data: budgetData,
    isLoading: loadingBudget,
    isFetching: fetchingBudget,
    refetch: refetchBudget,
  } = useQuery<{ payees?: any[]; transactions?: any[]; websites?: string[] }>({
    queryKey: ["budgetData", passcode],
    queryFn: () => callGasApi("GET_BUDGET_DATA"),
    enabled: Boolean(passcode) && activeView === "budget",
    staleTime: 3 * 60 * 1000,
  })

  const salesList = Array.isArray(financialData?.sales)
    ? financialData.sales
    : []
  const payeeList = Array.isArray(budgetData?.payees)
    ? budgetData.payees
    : []
  const transactionList = Array.isArray(budgetData?.transactions)
    ? budgetData.transactions
    : []
  const websiteList = Array.isArray(financialData?.websites)
    ? financialData.websites
    : Array.isArray(budgetData?.websites)
    ? budgetData.websites
    : []

  const isBusyFetching =
    loadingInitial ||
    fetchingInitial ||
    fetchingPeriod ||
    (activeView === "financials" && (loadingFinancials || fetchingFinancials)) ||
    (activeView === "budget" && (loadingBudget || fetchingBudget))

  const handleQueuePeriodChange = async (newMonth: string, newYear: string) => {
    setQueueMonth(newMonth)
    setQueueYear(newYear)
    setFetchingPeriod(true)
    try {
      const res = await callGasApi("GET_WORK_QUEUE", {
        month: newMonth,
        year: newYear,
        includeIncomplete: false,
      })
      if (Array.isArray(res)) {
        setQueueList(res)
      }
    } catch (err: any) {
      toast.error(err.message || "ดึงข้อมูลคิวงานไม่สำเร็จ")
    } finally {
      setFetchingPeriod(false)
    }
  }

  const handleManualRefresh = async () => {
    toast.loading("กำลังดึงข้อมูลล่าสุดจาก Google Sheets...", {
      id: "manual-refresh",
    })
    try {
      if (activeView === "financials") {
        await refetchFinancials()
      } else if (activeView === "budget") {
        await refetchBudget()
      } else {
        const fresh = await callGasApi("GET_DASHBOARD_DATA", {
          month: queueMonth,
          year: queueYear,
        })
        if (fresh) {
          if (Array.isArray(fresh.manga)) setMangaList(fresh.manga)
          if (Array.isArray(fresh.team)) setTeamList(fresh.team)
          if (Array.isArray(fresh.queue)) setQueueList(fresh.queue)
        }
      }
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

  const updateQueueCache = (newQueue: any[]) => {
    setQueueList(newQueue)
  }

  const updateMangaCache = (newManga: any[]) => {
    setMangaList(newManga)
  }

  const updateTeamCache = (newTeam: any[]) => {
    setTeamList(newTeam)
  }

  const handleNavClick = (view: ViewKey) => {
    setSidebarOpen(false)
    if (view === "financials" || view === "budget") {
      setPendingSensitiveView(view)
      setSensitivePassInput("")
      setSensitiveGateOpen(true)
      return
    }
    changeView(view)
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
          changeView(pendingSensitiveView)
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

  const navItems: Array<{ id: ViewKey; label: string; icon: any }> = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "queue", label: "จัดการคิวงาน", icon: ClipboardList },
    { id: "tracker", label: "ติดตามต้นฉบับ", icon: Radio },
    { id: "expenses", label: "สรุปรายจ่ายรายเดือน", icon: Receipt },
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
                    isBusyFetching
                      ? "bg-amber-400 animate-ping"
                      : "bg-emerald-400"
                  }`}
                />
                {isBusyFetching
                  ? "กำลังดึงข้อมูล..."
                  : "สถานะ: เชื่อมต่อตรง (Real-time)"}
              </div>
              <div className="hidden sm:block text-[11px] text-slate-400">
                โหลดแบบ Dynamic แยกตาราง • รวดเร็ว
              </div>
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={handleManualRefresh}
              disabled={isBusyFetching}
              title="รีเฟรชข้อมูลสดทันที"
            >
              <RefreshCw
                className={`h-4 w-4 ${isBusyFetching ? "animate-spin" : ""}`}
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
              isLoading={loadingInitial}
              onSwitchToQueue={(term) => {
                if (term) setQueueSearchTerm(term)
                changeView("queue")
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
              isLoading={loadingInitial || fetchingPeriod}
              monthFilter={queueMonth}
              yearFilter={queueYear}
              onPeriodChange={handleQueuePeriodChange}
              initialSearch={queueSearchTerm}
              onClearInitialSearch={() => setQueueSearchTerm("")}
              onOpenAddQueue={() => {
                setPreselectedQueueMangaId("")
                setPreselectedQueueChapter("")
                setAddQueueOpen(true)
              }}
              onOpenUpdateQueue={(q) => {
                setEditingQueueItem(q)
                setUpdateQueueOpen(true)
              }}
              onQueueChange={updateQueueCache}
            />
          )}

          {activeView === "tracker" && (
            <RawTrackerView
              mangaList={mangaList}
              queueList={queueList}
              onOpenAddQueueWithManga={(mangaId, nextChap) => {
                setPreselectedQueueMangaId(mangaId)
                setPreselectedQueueChapter(nextChap || "")
                setAddQueueOpen(true)
              }}
            />
          )}

          {activeView === "expenses" && (
            <ExpensesView
              mangaList={mangaList}
              teamList={teamList}
              passcode={passcode}
            />
          )}

          {activeView === "team" && (
            <TeamView
              teamList={teamList}
              onTeamChange={updateTeamCache}
            />
          )}

          {activeView === "financials" && (
            <FinancialsView
              mangaList={mangaList}
              salesList={salesList}
              websiteList={websiteList}
              onSalesChange={(newSales, newWebsites) => {
                queryClient.setQueryData(
                  ["financialData", passcode],
                  (old: any) => ({
                    ...(old || {}),
                    sales: newSales,
                    ...(newWebsites ? { websites: newWebsites } : {}),
                  })
                )
              }}
            />
          )}

          {activeView === "budget" && (
            <BudgetView
              payeeList={payeeList}
              transactionList={transactionList}
              websiteList={websiteList}
              onPayeesChange={(newPayees) => {
                queryClient.setQueryData(
                  ["budgetData", passcode],
                  (old: any) => ({
                    ...(old || {}),
                    payees: newPayees,
                  })
                )
              }}
              onTransactionsChange={(newTrans) => {
                queryClient.setQueryData(
                  ["budgetData", passcode],
                  (old: any) => ({
                    ...(old || {}),
                    transactions: newTrans,
                  })
                )
              }}
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
              onMangaChange={updateMangaCache}
              onQueueChange={updateQueueCache}
            />
          )}
        </main>
      </div>

      {/* Global Add Queue Modal */}
      <AddQueueModal
        open={addQueueOpen}
        onClose={() => {
          setAddQueueOpen(false)
          setPreselectedQueueChapter("")
        }}
        mangaList={mangaList}
        teamList={teamList}
        preselectedMangaId={preselectedQueueMangaId}
        preselectedChapter={preselectedQueueChapter}
        onOpenAddManga={() => {
          setAddQueueOpen(false)
          setEditingManga(null)
          setReturnToAddQueue(true)
          setMangaModalOpen(true)
        }}
        onSuccess={(newQueue, newManga) => {
          updateQueueCache(newQueue)
          if (newManga) updateMangaCache(newManga)
        }}
      />

      {/* Global Update Queue Modal */}
      <UpdateQueueModal
        open={updateQueueOpen}
        onClose={() => setUpdateQueueOpen(false)}
        item={editingQueueItem}
        mangaList={mangaList}
        teamList={teamList}
        onSuccess={updateQueueCache}
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
          updateMangaCache(updatedList)
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

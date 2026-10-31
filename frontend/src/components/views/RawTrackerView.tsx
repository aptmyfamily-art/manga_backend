import * as React from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { SearchableSelect } from "@/components/ui/searchable-select"
import { callGasApi } from "@/api/gasClient"
import { toast } from "sonner"
import {
  Radio,
  RefreshCw,
  Plus,
  ExternalLink,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Pencil,
  Trash2,
  Send,
  Zap,
  Check,
  Globe,
  Bell,
  Play,
  ArrowRight,
  Filter,
} from "lucide-react"

export interface RawTrackerItem {
  trackerid: string
  mangaid?: string | number
  manganame?: string
  url: string
  pattern?: string
  lastrawtext?: string
  lastrawcount?: number | string
  status?: string
  lastchecked?: string
  updatedat?: string
  autocheck?: boolean | string
  currentChapter?: string | number
}

interface RawTrackerViewProps {
  mangaList: any[]
  onOpenAddQueueWithManga: (mangaId: string, nextChapter?: string) => void
}

export function RawTrackerView({
  mangaList,
  onOpenAddQueueWithManga,
}: RawTrackerViewProps) {
  const queryClient = useQueryClient()
  const [search, setSearch] = React.useState("")
  const [statusFilter, setStatusFilter] = React.useState<
    "all" | "new" | "current" | "error"
  >("all")
  const [checkingAll, setCheckingAll] = React.useState(false)
  const [singleCheckingId, setSingleCheckingId] = React.useState<string | null>(
    null
  )

  // Add / Edit Modal state
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editingItem, setEditingItem] = React.useState<RawTrackerItem | null>(
    null
  )
  const [formMangaId, setFormMangaId] = React.useState("")
  const [formMangaName, setFormMangaName] = React.useState("")
  const [formUrl, setFormUrl] = React.useState("")
  const [formPattern, setFormPattern] = React.useState("")
  const [formAutoCheck, setFormAutoCheck] = React.useState(true)

  // Test scrape state inside Modal
  const [testingScrape, setTestingScrape] = React.useState(false)
  const [testScrapeResult, setTestScrapeResult] = React.useState<{
    success: boolean
    rawText?: string
    chapterCount?: number
    error?: string
  } | null>(null)

  // Query: Fetch Raw Trackers
  const {
    data: trackers = [],
    isLoading,
    refetch,
  } = useQuery<RawTrackerItem[]>({
    queryKey: ["rawTrackersList"],
    queryFn: async () => {
      const res = await callGasApi<RawTrackerItem[]>("GET_RAW_TRACKER_LIST")
      return Array.isArray(res) ? res : []
    },
    staleTime: 60 * 1000,
  })

  // Open Add Modal
  const handleOpenAddModal = (manga?: any) => {
    setEditingItem(null)
    setTestScrapeResult(null)
    if (manga) {
      setFormMangaId(String(manga.mangaid || ""))
      setFormMangaName(manga.manganame || "")
      setFormUrl(manga.originalurl || "")
    } else {
      setFormMangaId("")
      setFormMangaName("")
      setFormUrl("")
    }
    setFormPattern("")
    setFormAutoCheck(true)
    setModalOpen(true)
  }

  // Open Edit Modal
  const handleOpenEditModal = (item: RawTrackerItem) => {
    setEditingItem(item)
    setTestScrapeResult(null)
    setFormMangaId(String(item.mangaid || ""))
    setFormMangaName(item.manganame || "")
    setFormUrl(item.url || "")
    setFormPattern(item.pattern || "")
    setFormAutoCheck(
      item.autocheck !== undefined && String(item.autocheck).toLowerCase() !== "false"
    )
    setModalOpen(true)
  }

  // Live Test Scrape Button inside modal
  const handleTestScrape = async () => {
    if (!formUrl || !formUrl.trim().startsWith("http")) {
      toast.error("กรุณาระบุ URL ต้นฉบับที่ขึ้นต้นด้วย http:// หรือ https://")
      return
    }
    setTestingScrape(true)
    setTestScrapeResult(null)
    try {
      const res = await callGasApi("SCRAPE_RAW_URL", {
        url: formUrl.trim(),
        pattern: formPattern.trim(),
      })
      if (res && res.success) {
        setTestScrapeResult({
          success: true,
          rawText: res.rawText,
          chapterCount: res.chapterCount,
        })
        toast.success(`ตรวจพบข้อความ: ${res.rawText}`)
      } else {
        setTestScrapeResult({
          success: false,
          error: res?.error || "ไม่พบข้อความจำนวนตอนในหน้านี้",
        })
        toast.error(res?.error || "ไม่พบข้อความจำนวนตอน")
      }
    } catch (err: any) {
      setTestScrapeResult({
        success: false,
        error: err.message || "เกิดข้อผิดพลาดในการเชื่อมต่อ",
      })
      toast.error(err.message || "ดึงข้อมูลไม่สำเร็จ")
    } finally {
      setTestingScrape(false)
    }
  }

  // Save Modal
  const handleSaveModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formUrl.trim()) {
      toast.error("กรุณากรอกลิงก์ต้นฉบับ")
      return
    }

    const payload = {
      mangaid: formMangaId,
      manganame:
        formMangaName ||
        mangaList.find((m) => String(m.mangaid) === formMangaId)?.manganame ||
        "ไม่ระบุชื่อเรื่อง",
      url: formUrl.trim(),
      pattern: formPattern.trim(),
      autocheck: formAutoCheck,
    }

    try {
      if (editingItem) {
        await callGasApi("UPDATE_RAW_TRACKER", {
          id: editingItem.trackerid,
          data: payload,
        })
        toast.success("บันทึกการแก้ไขเรียบร้อยแล้ว")
      } else {
        await callGasApi("ADD_RAW_TRACKER", payload)
        toast.success("เพิ่มเรื่องสำหรับติดตามต้นฉบับเรียบร้อยแล้ว")
      }
      setModalOpen(false)
      refetch()
    } catch (err: any) {
      toast.error(err.message || "บันทึกไม่สำเร็จ")
    }
  }

  // Delete Tracker
  const handleDeleteTracker = async (trackerId: string, name: string) => {
    if (!confirm(`คุณต้องการยกเลิกการติดตามเรื่อง "${name}" ใช่หรือไม่?`)) return
    try {
      await callGasApi("DELETE_RAW_TRACKER", { id: trackerId })
      toast.success("ลบรายการติดตามเรียบร้อยแล้ว")
      refetch()
    } catch (err: any) {
      toast.error(err.message || "ลบไม่สำเร็จ")
    }
  }

  // Single Check
  const handleCheckSingle = async (item: RawTrackerItem) => {
    setSingleCheckingId(item.trackerid)
    try {
      const res = await callGasApi("SCRAPE_RAW_URL", {
        url: item.url,
        pattern: item.pattern,
      })
      if (res && res.success) {
        const currentNum = Number(item.currentChapter || 0)
        const oldScrapedNum = Number(item.lastrawcount || 0)
        const newScrapedNum = Number(res.chapterCount || 0)

        const isChanged =
          (item.lastrawtext && item.lastrawtext !== res.rawText) ||
          (newScrapedNum > 0 && (oldScrapedNum > 0 ? newScrapedNum > oldScrapedNum : (currentNum > 0 && newScrapedNum > currentNum)))

        const diff = Math.max(
          1,
          newScrapedNum - (oldScrapedNum > 0 ? oldScrapedNum : currentNum)
        )
        const newStatus = isChanged
          ? `มีตอนใหม่ (+${diff} ตอน)`
          : "เป็นปัจจุบัน"

        await callGasApi("UPDATE_RAW_TRACKER", {
          id: item.trackerid,
          data: {
            lastrawtext: res.rawText,
            lastrawcount: res.chapterCount,
            status: newStatus,
            lastchecked: new Date().toISOString(),
            ...(isChanged ? { updatedat: new Date().toISOString() } : {}),
          },
        })

        if (isChanged) {
          toast.success(`🎉 ${item.manganame}: ตรวจพบตอนใหม่! (${res.rawText})`)
        } else {
          toast.info(`${item.manganame}: ตอนเป็นปัจจุบันแล้ว (${res.rawText})`)
        }
        refetch()
      } else {
        toast.error(`ตรวจเช็คไม่สำเร็จ: ${res?.error || "ไม่พบข้อความ"}`)
      }
    } catch (err: any) {
      toast.error(err.message || "ตรวจสอบไม่สำเร็จ")
    } finally {
      setSingleCheckingId(null)
    }
  }

  // Check All Now
  const handleCheckAll = async () => {
    setCheckingAll(true)
    toast.loading("กำลังส่งคำสั่งตรวจสอบต้นฉบับทุกเรื่องในคลาวด์...", {
      id: "check-all-trackers",
    })
    try {
      const res = await callGasApi("CHECK_ALL_RAW_TRACKERS", {
        notifyTelegram: true,
      })
      if (res && res.success) {
        if (res.newUpdatesCount > 0) {
          toast.success(
            `🎉 ตรวจเช็คเสร็จสิ้น! พบตอนใหม่ทั้งหมด ${res.newUpdatesCount} เรื่อง`,
            { id: "check-all-trackers", duration: 5000 }
          )
        } else {
          toast.success("ตรวจเช็คเสร็จสิ้น: ทุกเรื่องยังเป็นปัจจุบัน", {
            id: "check-all-trackers",
          })
        }
        refetch()
      } else {
        toast.error("ตรวจสอบไม่สำเร็จ", { id: "check-all-trackers" })
      }
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการตรวจสอบ", {
        id: "check-all-trackers",
      })
    } finally {
      setCheckingAll(false)
    }
  }

  // Setup 1-Hour Trigger
  const handleSetupHourlyTrigger = async () => {
    try {
      const res = await callGasApi("SETUP_HOURLY_TRACKER_TRIGGER")
      toast.success(
        res?.message || "ตั้งระบบตรวจเช็คอัตโนมัติทุกๆ 1 ชั่วโมง เรียบร้อยแล้ว!"
      )
    } catch (err: any) {
      toast.error(err.message || "ตั้งค่าทริกเกอร์ไม่สำเร็จ")
    }
  }

  // Import from Manga List
  const handleImportFromManga = async () => {
    toast.loading("กำลังนำเข้ามังงะที่มี Original URL...", {
      id: "import-trackers",
    })
    try {
      const res = await callGasApi("IMPORT_FROM_MANGA_LIST")
      toast.success("นำเข้ารายชื่อมังงะสำหรับติดตามเรียบร้อยแล้ว", {
        id: "import-trackers",
      })
      refetch()
    } catch (err: any) {
      toast.error(err.message || "นำเข้าไม่สำเร็จ", { id: "import-trackers" })
    }
  }

  // Quick Action: Add to Queue with prefilled next chapter
  const handleCreateQueue = (item: RawTrackerItem) => {
    if (!item.mangaid) {
      toast.error("รายการนี้ไม่ได้เชื่อมโยงกับ MangaID ในระบบ")
      return
    }
    let nextChap = ""
    if (item.currentChapter) {
      const cur = parseFloat(String(item.currentChapter))
      if (!isNaN(cur)) {
        nextChap = String(cur + 1)
      }
    }
    onOpenAddQueueWithManga(String(item.mangaid), nextChap)
  }

  // Statistics
  const newUpdatesItems = trackers.filter((t) =>
    String(t.status || "").includes("มีตอนใหม่")
  )
  const newUpdatesCount = newUpdatesItems.length

  // Filtered trackers
  const filteredTrackers = React.useMemo(() => {
    const q = search.toLowerCase().trim()
    return trackers.filter((t) => {
      // Search
      if (q) {
        const name = String(t.manganame || "").toLowerCase()
        const url = String(t.url || "").toLowerCase()
        const text = String(t.lastrawtext || "").toLowerCase()
        if (!name.includes(q) && !url.includes(q) && !text.includes(q)) {
          return false
        }
      }
      // Status filter
      if (statusFilter === "new") {
        return String(t.status || "").includes("มีตอนใหม่")
      }
      if (statusFilter === "current") {
        return String(t.status || "") === "เป็นปัจจุบัน"
      }
      if (statusFilter === "error") {
        return String(t.status || "").includes("ตรวจสอบไม่ได้")
      }
      return true
    })
  }, [trackers, search, statusFilter])

  const mangaOptions = React.useMemo(
    () =>
      mangaList.map((m) => ({
        value: String(m.mangaid),
        label: `${m.manganame} (${m.status || "Ongoing"})`,
      })),
    [mangaList]
  )

  const formatRelativeTime = (timeStr?: string) => {
    if (!timeStr) return "ยังไม่เคยตรวจ"
    const d = new Date(timeStr)
    if (isNaN(d.getTime())) return timeStr
    const diffSec = Math.floor((Date.now() - d.getTime()) / 1000)
    if (diffSec < 60) return "เมื่อสักครู่"
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)} นาทีที่แล้ว`
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} ชั่วโมงที่แล้ว`
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear() + 543} ${String(
      d.getHours()
    ).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#26334d] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-pink-600/20 text-pink-400 border border-pink-500/30">
              <Radio className="h-5 w-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                ติดตามต้นฉบับอัปเดต (Raw Tracker)
                {newUpdatesCount > 0 && (
                  <Badge className="bg-emerald-500 text-slate-950 font-bold px-2.5 py-0.5 text-xs animate-bounce">
                    มีตอนใหม่ {newUpdatesCount} เรื่อง!
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-slate-400">
                ระบบ Web Scraping ตรวจสอบหน้าเว็บอัตโนมัติทุก 1 ชม. (快看: 共377个内容 / QQ: 最新话 / ThunderScans: New Chapter)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleImportFromManga}
            className="h-9 border-[#26334d] bg-[#111726] hover:bg-slate-800"
            title="นำเข้ามังงะที่มี Original URL ในระบบเข้ามาติดตามอัตโนมัติ"
          >
            <Globe className="h-4 w-4 mr-1.5 text-indigo-400" />
            ซิงค์จากมังงะ
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSetupHourlyTrigger}
            className="h-9 border-[#26334d] bg-[#111726] hover:bg-slate-800 text-amber-300"
            title="ตั้งระบบ Cron Trigger ใน Google Cloud ให้ยิงตรวจเช็คอัตโนมัติทุกๆ 1 ชั่วโมง"
          >
            <Clock className="h-4 w-4 mr-1.5 text-amber-400" />
            ตั้งตรวจทุก 1 ชม.
          </Button>

          <Button
            size="sm"
            onClick={() => handleOpenAddModal()}
            className="h-9 bg-pink-600 hover:bg-pink-700 text-white shadow-md shadow-pink-600/20"
          >
            <Plus className="h-4 w-4 mr-1.5" />
            เพิ่มเรื่องติดตาม
          </Button>

          <Button
            size="sm"
            onClick={handleCheckAll}
            disabled={checkingAll}
            className="h-9 bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-600/20 font-semibold"
          >
            <RefreshCw
              className={`h-4 w-4 mr-1.5 ${checkingAll ? "animate-spin" : ""}`}
            />
            {checkingAll ? "กำลังสแกนทุกเรื่อง..." : "🔍 ตรวจสอบทั้งหมดทันที"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Tracked */}
        <Card className="p-4 bg-[#111726] border-[#26334d]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              📡 กำลังติดตามทั้งหมด
            </span>
            <div className="rounded-lg bg-pink-500/10 p-2 text-pink-400">
              <Radio className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white">
              {trackers.length}
            </span>
            <span className="text-xs text-slate-400">เรื่อง</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            ดึงผ่าน Google Cloud Scraping
          </div>
        </Card>

        {/* New Updates */}
        <Card
          className={`p-4 transition-all ${
            newUpdatesCount > 0
              ? "border-emerald-500/50 bg-gradient-to-br from-[#11241f] to-[#0c1a17] shadow-lg shadow-emerald-950/40"
              : "bg-[#111726] border-[#26334d]"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`text-xs font-semibold uppercase tracking-wider ${
                newUpdatesCount > 0 ? "text-emerald-400 font-bold" : "text-slate-400"
              }`}
            >
              🚨 มีตอนใหม่มาแล้ว!
            </span>
            <div
              className={`rounded-lg p-2 ${
                newUpdatesCount > 0
                  ? "bg-emerald-500/20 text-emerald-300 animate-pulse"
                  : "bg-slate-800 text-slate-400"
              }`}
            >
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                newUpdatesCount > 0 ? "text-emerald-300" : "text-slate-400"
              }`}
            >
              {newUpdatesCount}
            </span>
            <span className="text-xs text-slate-400">เรื่อง</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            {newUpdatesCount > 0
              ? "กดปุ่ม + ด้านล่างเพื่อเพิ่มเข้าคิวงานได้ทันที"
              : "ยังไม่มีตอนใหม่เพิ่มขึ้น"}
          </div>
        </Card>

        {/* Auto Checker Status */}
        <Card className="p-4 bg-[#111726] border-[#26334d]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
              ⏱️ ระบบเช็คอัตโนมัติ
            </span>
            <div className="rounded-lg bg-amber-500/10 p-2 text-amber-400">
              <Clock className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-lg font-bold text-slate-200">
              ทุกๆ 1 ชั่วโมง
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
            <span>GAS Trigger Active + ส่งไลน์/Telegram</span>
          </div>
        </Card>

        {/* Preset Info */}
        <Card className="p-4 bg-[#111726] border-[#26334d]">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-indigo-400">
              ⚡ เว็บไซต์ที่รองรับทันที
            </span>
            <div className="rounded-lg bg-indigo-500/10 p-2 text-indigo-400">
              <Globe className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-300 space-y-0.5">
            <div>• 快看漫画 (Kuaikanmanhua): <code className="text-pink-300 text-[11px]">共(\d+)个内容</code></div>
            <div>• 腾讯动漫 (QQ Comic): <code className="text-indigo-300 text-[11px]">第(\d+)话</code></div>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">
            และรองรับ Custom Regex ทุกเว็บ
          </div>
        </Card>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 bg-[#111726] border-[#26334d]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="ค้นหาชื่อเรื่อง, ลิงก์ต้นฉบับ หรือข้อความ..."
                className="pl-9 bg-[#0b1120] border-[#26334d]"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center rounded-lg border border-[#26334d] bg-[#0b1120] p-0.5 text-xs font-medium">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  statusFilter === "all"
                    ? "bg-indigo-600 text-white font-semibold shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                ทั้งหมด ({trackers.length})
              </button>
              <button
                onClick={() => setStatusFilter("new")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  statusFilter === "new"
                    ? "bg-emerald-600 text-white font-semibold shadow-xs"
                    : "text-emerald-400 hover:text-emerald-300"
                }`}
              >
                <Sparkles className="h-3 w-3" />
                มีตอนใหม่ ({newUpdatesCount})
              </button>
              <button
                onClick={() => setStatusFilter("current")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  statusFilter === "current"
                    ? "bg-slate-700 text-white font-semibold shadow-xs"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                เป็นปัจจุบัน
              </button>
              <button
                onClick={() => setStatusFilter("error")}
                className={`px-3 py-1.5 rounded-md transition-colors cursor-pointer ${
                  statusFilter === "error"
                    ? "bg-rose-600 text-white font-semibold shadow-xs"
                    : "text-rose-400 hover:text-rose-300"
                }`}
              >
                ตรวจสอบไม่ได้
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Trackers Table */}
      <Card className="bg-[#111726] border-[#26334d] overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-[#0e1422] border-b border-[#26334d]">
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-12 text-center text-slate-400 font-semibold">
                  #
                </TableHead>
                <TableHead className="text-slate-300 font-semibold min-w-[200px]">
                  ชื่อเรื่อง / ลิงก์ต้นฉบับ
                </TableHead>
                <TableHead className="text-slate-300 font-semibold text-center min-w-[140px]">
                  ข้อความล่าสุดจากเว็บ
                </TableHead>
                <TableHead className="text-slate-300 font-semibold text-center min-w-[120px]">
                  ตอนล่าสุดในระบบ
                </TableHead>
                <TableHead className="text-slate-300 font-semibold text-center min-w-[160px]">
                  สถานะอัปเดต
                </TableHead>
                <TableHead className="text-slate-300 font-semibold min-w-[130px]">
                  ตรวจเช็คล่าสุด
                </TableHead>
                <TableHead className="text-right text-slate-300 font-semibold min-w-[180px]">
                  การดำเนินการ
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i} className="border-b border-[#26334d]/60">
                    <TableCell colSpan={7} className="py-4">
                      <Skeleton className="h-6 w-full bg-[#18233a]" />
                    </TableCell>
                  </TableRow>
                ))
              ) : filteredTrackers.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="text-center py-12 text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Radio className="h-8 w-8 text-slate-600" />
                      <p>ไม่พบรายการติดตามที่ตรงกับเงื่อนไข</p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleImportFromManga}
                        className="mt-2 text-xs"
                      >
                        กดที่นี่เพื่อซิงค์มังงะทั้งหมดในระบบเข้ามาติดตาม
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredTrackers.map((item, index) => {
                  const hasNew = String(item.status || "").includes("มีตอนใหม่")
                  const isErr = String(item.status || "").includes(
                    "ตรวจสอบไม่ได้"
                  )
                  const isChecking = singleCheckingId === item.trackerid

                  return (
                    <TableRow
                      key={item.trackerid}
                      className={`border-b border-[#26334d]/60 transition-colors ${
                        hasNew
                          ? "bg-emerald-950/20 hover:bg-emerald-950/30"
                          : "hover:bg-[#151d2f]/50"
                      }`}
                    >
                      <TableCell className="text-center text-xs text-slate-500 font-mono">
                        {index + 1}
                      </TableCell>

                      {/* Manga Name & Source URL */}
                      <TableCell>
                        <div className="space-y-1">
                          <div className="font-semibold text-sm text-slate-100 flex items-center gap-2">
                            <span>{item.manganame || "ไม่ระบุชื่อเรื่อง"}</span>
                            {hasNew && (
                              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-ping" />
                            )}
                          </div>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 hover:underline max-w-[320px] truncate"
                          >
                            <ExternalLink className="h-3 w-3 shrink-0" />
                            <span className="truncate">{item.url}</span>
                          </a>
                        </div>
                      </TableCell>

                      {/* Last Raw Scraped Text */}
                      <TableCell className="text-center">
                        {item.lastrawtext ? (
                          <div className="inline-flex flex-col items-center">
                            <span
                              className="font-mono text-xs px-2.5 py-1 rounded-md bg-[#0b1120] text-pink-300 border border-pink-500/30 font-semibold shadow-xs max-w-[280px] truncate"
                              title={item.lastrawtext}
                            >
                              {item.lastrawtext}
                            </span>
                            {item.lastrawcount && (
                              <span className="text-[10px] text-slate-400 mt-0.5">
                                ({item.lastrawcount} ตอน)
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-500 italic">
                            รอตรวจสอบครั้งแรก
                          </span>
                        )}
                      </TableCell>

                      {/* Current Chapter in System */}
                      <TableCell className="text-center">
                        <span className="font-mono text-xs text-slate-300 font-semibold">
                          ตอนที่ {item.currentChapter || "-"}
                        </span>
                      </TableCell>

                      {/* Status */}
                      <TableCell className="text-center">
                        {hasNew ? (
                          <Badge className="bg-emerald-600 text-white font-bold px-3 py-1 shadow-md shadow-emerald-600/30 animate-pulse text-xs">
                            <Sparkles className="h-3 w-3 mr-1" />
                            {item.status}
                          </Badge>
                        ) : isErr ? (
                          <Badge
                            variant="destructive"
                            className="text-[11px] px-2 py-0.5"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {item.status}
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="bg-[#151d2f] text-slate-300 border-[#26334d] text-xs"
                          >
                            <Check className="h-3 w-3 mr-1 text-emerald-400" />
                            {item.status || "เป็นปัจจุบัน"}
                          </Badge>
                        )}
                      </TableCell>

                      {/* Last Checked */}
                      <TableCell className="text-xs text-slate-400">
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-slate-500" />
                          <span>{formatRelativeTime(item.lastchecked)}</span>
                        </div>
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Create Queue Button if new or any */}
                          <Button
                            size="sm"
                            variant="outline"
                            className={`h-8 text-xs font-semibold ${
                              hasNew
                                ? "bg-emerald-600 text-white hover:bg-emerald-700 border-emerald-500 shadow-md shadow-emerald-600/30"
                                : "text-indigo-300 border-indigo-500/30 hover:bg-indigo-600/20"
                            }`}
                            onClick={() => handleCreateQueue(item)}
                            title="เปิดแบบฟอร์มเพิ่มตอนใหม่นี้เข้าสู่คิวงานทันที"
                          >
                            <Plus className="h-3.5 w-3.5 mr-1" />
                            ลงคิว
                          </Button>

                          {/* Check single */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-white"
                            onClick={() => handleCheckSingle(item)}
                            disabled={isChecking}
                            title="สแกนต้นฉบับเรื่องนี้ทันที"
                          >
                            <RefreshCw
                              className={`h-3.5 w-3.5 ${
                                isChecking ? "animate-spin text-amber-400" : ""
                              }`}
                            />
                          </Button>

                          {/* Edit */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-white"
                            onClick={() => handleOpenEditModal(item)}
                            title="แก้ไขลิงก์ / รูปแบบ"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>

                          {/* Delete */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-slate-400 hover:text-rose-400"
                            onClick={() =>
                              handleDeleteTracker(
                                item.trackerid,
                                item.manganame || ""
                              )
                            }
                            title="ยกเลิกการติดตามเรื่องนี้"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Add / Edit Tracker Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-xl bg-[#0f172a] border-[#26334d] text-slate-100">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg text-white font-bold">
              <Radio className="h-5 w-5 text-pink-400" />
              {editingItem ? "แก้ไขรายการติดตามต้นฉบับ" : "เพิ่มเรื่องติดตามต้นฉบับใหม่"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSaveModal} className="space-y-4 mt-2">
            {/* Select Manga from System */}
            <div className="space-y-1.5">
              <Label>เชื่อมโยงกับมังงะในระบบ</Label>
              <SearchableSelect
                options={mangaOptions}
                value={formMangaId}
                onChange={(id) => {
                  setFormMangaId(id)
                  const m = mangaList.find((x) => String(x.mangaid) === id)
                  if (m) {
                    setFormMangaName(m.manganame)
                    if (m.originalurl && !formUrl) {
                      setFormUrl(m.originalurl)
                    }
                  }
                }}
                placeholder="เลือกเรื่องมังงะ..."
              />
            </div>

            {/* Custom Name (if not in manga list) */}
            <div className="space-y-1.5">
              <Label>ชื่อเรื่องที่ต้องการแสดง</Label>
              <Input
                placeholder="เช่น ข้าคือจอมวายร้ายผู้ยิ่งใหญ่"
                value={formMangaName}
                onChange={(e) => setFormMangaName(e.target.value)}
                className="bg-[#0b1120] border-[#26334d]"
              />
            </div>

            {/* Raw URL */}
            <div className="space-y-1.5">
              <Label className="flex items-center justify-between">
                <span>🔗 ลิงก์หน้าเว็บต้นฉบับ (Raw URL) *</span>
                <span className="text-[11px] text-slate-400">
                  เช่น https://www.kuaikanmanhua.com/web/topic/12602/
                </span>
              </Label>
              <Input
                placeholder="https://www.kuaikanmanhua.com/web/topic/..."
                value={formUrl}
                onChange={(e) => setFormUrl(e.target.value)}
                required
                className="bg-[#0b1120] border-[#26334d] font-mono text-xs"
              />
            </div>

            {/* Pattern / Regex */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>รูปแบบการดึงข้อความ (Pattern / Regex)</Label>
                <span className="text-[11px] text-slate-500">
                  เว้นว่างไว้จะใช้ค่าอัตโนมัติ (Kuaikan / QQ)
                </span>
              </div>
              <Input
                placeholder="เว้นว่างไว้เพื่อใช้อัตโนมัติ หรือใส่เช่น 共(\d+)个内容"
                value={formPattern}
                onChange={(e) => setFormPattern(e.target.value)}
                className="bg-[#0b1120] border-[#26334d] font-mono text-xs"
              />
              <div className="flex flex-wrap gap-1 mt-1 text-[11px]">
                <span className="text-slate-500">พรีเซ็ตแนะนำ:</span>
                <button
                  type="button"
                  onClick={() => setFormPattern("共(\\d+)个内容")}
                  className="text-pink-400 hover:underline cursor-pointer"
                >
                  [快看: 共(\d+)个内容]
                </button>
                <button
                  type="button"
                  onClick={() => setFormPattern("")}
                  className="text-indigo-400 hover:underline cursor-pointer"
                >
                  [ac.qq: 最新话 (อัตโนมัติ)]
                </button>
                <button
                  type="button"
                  onClick={() => setFormPattern("")}
                  className="text-emerald-400 hover:underline cursor-pointer"
                >
                  [ThunderScans: New Chapter (อัตโนมัติ)]
                </button>
                <button
                  type="button"
                  onClick={() => setFormPattern("")}
                  className="text-slate-400 hover:underline cursor-pointer"
                >
                  [ล้างเป็นค่าอัตโนมัติ (แนะนำ)]
                </button>
              </div>
            </div>

            {/* Live Test Scrape Button & Result Preview */}
            <div className="rounded-xl border border-[#26334d] bg-[#0b1120] p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" />
                  ทดสอบดึงข้อความเดี๋ยวนี้ (Live Scrape Test)
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleTestScrape}
                  disabled={testingScrape || !formUrl}
                  className="h-7 text-xs bg-indigo-600/20 text-indigo-300 border-indigo-500/40 hover:bg-indigo-600/30"
                >
                  {testingScrape ? (
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  ) : (
                    <Play className="h-3 w-3 mr-1" />
                  )}
                  {testingScrape ? "กำลังยิง Scrape..." : "ทดสอบยิงดึง"}
                </Button>
              </div>

              {testScrapeResult && (
                <div
                  className={`rounded-lg p-2.5 text-xs ${
                    testScrapeResult.success
                      ? "bg-emerald-950/40 border border-emerald-500/40 text-emerald-300"
                      : "bg-rose-950/40 border border-rose-500/40 text-rose-300"
                  }`}
                >
                  {testScrapeResult.success ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      <div>
                        <span>ตรวจพบข้อความ: </span>
                        <code className="font-bold bg-black/40 px-1.5 py-0.5 rounded text-white font-mono">
                          {testScrapeResult.rawText}
                        </code>
                        <span className="ml-1 text-slate-300">
                          (ตีความได้: {testScrapeResult.chapterCount} ตอน)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                      <span>{testScrapeResult.error}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto Check Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="autoCheckCheck"
                checked={formAutoCheck}
                onChange={(e) => setFormAutoCheck(e.target.checked)}
                className="h-4 w-4 rounded border-[#26334d] bg-[#0b1120] text-indigo-600"
              />
              <label
                htmlFor="autoCheckCheck"
                className="text-xs text-slate-300 cursor-pointer"
              >
                เปิดให้ระบบตรวจเช็คอัตโนมัติทุกๆ 1 ชั่วโมง
              </label>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                className="border-[#26334d]"
              >
                ยกเลิก
              </Button>
              <Button
                type="submit"
                className="bg-pink-600 hover:bg-pink-700 text-white"
              >
                {editingItem ? "บันทึกการแก้ไข" : "บันทึกและเริ่มติดตาม"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

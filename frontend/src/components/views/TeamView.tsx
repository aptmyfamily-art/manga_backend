import * as React from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { callGasApi } from "@/api/gasClient"
import { toast } from "sonner"
import { Plus, Pencil, Trash2 } from "lucide-react"

interface TeamViewProps {
  teamList: any[]
  onTeamChange: (newTeam: any[]) => void
}

export function TeamView({ teamList, onTeamChange }: TeamViewProps) {
  const [modalOpen, setModalOpen] = React.useState(false)
  const [editId, setEditId] = React.useState("")
  const [name, setName] = React.useState("")
  const [role, setRole] = React.useState("Translator")
  const [status, setStatus] = React.useState("Active")
  const [submitting, setSubmitting] = React.useState(false)

  const openAdd = () => {
    setEditId("")
    setName("")
    setRole("Translator")
    setStatus("Active")
    setModalOpen(true)
  }

  const openEdit = (m: any) => {
    setEditId(String(m.memberid))
    setName(m.name || "")
    setRole(m.role || "Translator")
    setStatus(m.status || "Active")
    setModalOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    setSubmitting(true)
    try {
      const payload = { name: name.trim(), role, status }
      if (editId) {
        const res = await callGasApi("UPDATE_TEAM_MEMBER", {
          id: editId,
          data: payload,
        })
        toast.success("อัปเดตข้อมูลสมาชิกเรียบร้อย")
        onTeamChange(Array.isArray(res) ? res : [])
      } else {
        const res = await callGasApi("ADD_TEAM_MEMBER", payload)
        toast.success("เพิ่มสมาชิกใหม่เรียบร้อย")
        onTeamChange(Array.isArray(res) ? res : [])
      }
      setModalOpen(false)
    } catch (err: any) {
      toast.error(err.message || "เกิดข้อผิดพลาดในการบันทึกสมาชิก")
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!window.confirm("ยืนยันการลบสมาชิกนี้? รายชื่อจะไม่ปรากฏใน Dropdown อีก"))
      return
    try {
      const res = await callGasApi("DELETE_TEAM_MEMBER", { id })
      toast.success("ลบสมาชิกเรียบร้อย")
      onTeamChange(Array.isArray(res) ? res : [])
    } catch (err: any) {
      toast.error(err.message || "ลบสมาชิกไม่สำเร็จ")
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">จัดการทีมงาน</h2>
          <p className="text-sm text-slate-400">
            เพิ่ม/แก้ไข รายชื่อสมาชิกในทีมสำหรับระบุตัวผู้ทำในคิวงาน
          </p>
        </div>
        <Button onClick={openAdd}>
          <Plus className="h-4 w-4" /> เพิ่มสมาชิกใหม่
        </Button>
      </div>

      <Card className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ชื่อสมาชิก</TableHead>
              <TableHead>ตำแหน่งหลัก</TableHead>
              <TableHead>สถานะ</TableHead>
              <TableHead className="text-center w-32">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamList.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4}
                  className="text-center py-12 text-slate-400"
                >
                  ยังไม่มีสมาชิกในทีม
                </TableCell>
              </TableRow>
            ) : (
              teamList.map((m) => (
                <TableRow key={m.memberid}>
                  <TableCell>
                    <div className="font-semibold text-slate-100">{m.name}</div>
                    <div className="text-xs text-slate-500">
                      ID: {m.memberid}
                    </div>
                  </TableCell>
                  <TableCell>{m.role || "-"}</TableCell>
                  <TableCell>
                    <Badge
                      variant={m.status === "Active" ? "success" : "secondary"}
                    >
                      {m.status || "Active"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEdit(m)}
                      >
                        <Pencil className="h-3.5 w-3.5 text-indigo-400" />
                      </Button>
                      <Button
                        variant="destructive"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleDelete(String(m.memberid))}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={modalOpen} onOpenChange={(v) => !v && setModalOpen(false)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editId ? "แก้ไขข้อมูลสมาชิก" : "เพิ่มสมาชิกทีม"}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <Label>ชื่อที่ใช้ในระบบ *</Label>
              <Input
                placeholder="เช่น กขค"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label>ตำแหน่งหลัก</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-[#26334d] bg-[#0b1120] px-3 py-2 text-sm text-slate-100"
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="Translator">Translator (คนแปล)</option>
                <option value="Editor/Typesetter">
                  Editor/Typesetter (คนลงคำ)
                </option>
                <option value="Raw Provider/Uploader">
                  Raw Provider/Uploader (คนหาภาพ/อัปโหลด)
                </option>
                <option value="Cleaner/Draft">Extractor/Draft (คนดึงคำ)</option>
                <option value="Poster">Poster (คนโพสต์)</option>
                <option value="Multi-role">ทำได้ทุกอย่าง (Multi-role)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>สถานะ</Label>
              <select
                className="flex h-10 w-full rounded-lg border border-[#26334d] bg-[#0b1120] px-3 py-2 text-sm text-slate-100"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="Active">กำลังทำงาน (Active)</option>
                <option value="Inactive">พักงาน (Inactive)</option>
              </select>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalOpen(false)}
                disabled={submitting}
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting ? "กำลังบันทึก..." : "บันทึกสมาชิก"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}

import * as React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { callGasApi, getGasUrl, setGasUrl } from "@/api/gasClient"
import { toast } from "sonner"
import { Lock, BookOpen, Settings2 } from "lucide-react"

interface PasscodeGateProps {
  onAuthenticated: (passcode: string) => void
}

export function PasscodeGate({ onAuthenticated }: PasscodeGateProps) {
  const [passcode, setPasscode] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [showApiConfig, setShowApiConfig] = React.useState(false)
  const [apiUrl, setApiUrl] = React.useState(getGasUrl())

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passcode.trim()) {
      toast.warning("กรุณากรอกรหัสผ่าน")
      return
    }

    setLoading(true)
    try {
      if (apiUrl.trim()) {
        setGasUrl(apiUrl.trim())
      }
      const res = await callGasApi<{ valid: boolean }>(
        "VERIFY_PASSCODE",
        { passcode: passcode.trim() },
        passcode.trim()
      )
      if (res && res.valid) {
        toast.success("เข้าสู่ระบบสำเร็จ!")
        onAuthenticated(passcode.trim())
      } else {
        toast.error("รหัสผ่านไม่ถูกต้อง")
      }
    } catch (err: any) {
      toast.error(err.message || "ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ GAS ได้")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0b0f19] p-4">
      <Card className="w-full max-w-md border-[#26334d] bg-[#151d2f] shadow-2xl">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <BookOpen className="h-7 w-7" />
          </div>
          <CardTitle className="text-2xl font-bold text-white">
            MangaHub Management
          </CardTitle>
          <CardDescription>
            กรุณากรอกรหัสผ่านเพื่อเข้าใช้งานระบบจัดการคิวงานและบัญชี
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Lock className="h-4 w-4 text-indigo-400" />
                รหัสผ่านเข้าสู่ระบบ (Passcode)
              </Label>
              <Input
                type="password"
                placeholder="กรอกรหัสผ่าน..."
                value={passcode}
                onChange={(e) => setPasscode(e.target.value)}
                autoFocus
                disabled={loading}
              />
            </div>

            {showApiConfig && (
              <div className="space-y-1.5 pt-2 border-t border-[#26334d]">
                <Label className="text-xs text-slate-400">
                  GAS Web App URL (Exec Endpoint)
                </Label>
                <Input
                  type="url"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  className="text-xs h-9"
                />
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "กำลังตรวจสอบ..." : "เข้าสู่ระบบ"}
            </Button>

            <div className="text-center pt-1">
              <button
                type="button"
                onClick={() => setShowApiConfig((s) => !s)}
                className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                <Settings2 className="h-3.5 w-3.5" />
                {showApiConfig ? "ซ่อนตั้งค่า API URL" : "ตั้งค่า GAS API URL"}
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}

import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        secondary:
          "border-transparent bg-slate-800 text-slate-300",
        destructive:
          "border-red-500/30 bg-red-500/20 text-red-400",
        success:
          "border-emerald-500/30 bg-emerald-500/20 text-emerald-400",
        warning:
          "border-amber-500/30 bg-amber-500/20 text-amber-300",
        outline: "text-slate-300 border-[#26334d]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }

import * as React from "react"

import { cn } from "@/lib/utils"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 focus-visible:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-300/70 aria-invalid:border-red-500 aria-invalid:ring-2 aria-invalid:ring-red-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }

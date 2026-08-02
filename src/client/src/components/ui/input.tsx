import * as React from "react"

import { cn } from "@/lib/utils"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "h-9 w-full min-w-0 rounded-lg border border-slate-300 bg-white px-3 py-1 text-base text-slate-900 shadow-sm outline-none transition-[border-color,box-shadow] placeholder:text-slate-400 selection:bg-amber-200 selection:text-slate-950 file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-slate-700 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-slate-50 disabled:opacity-60 md:text-sm",
        "focus-visible:border-slate-500 focus-visible:ring-2 focus-visible:ring-slate-300/70",
        "aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
        className
      )}
      {...props}
    />
  )
}

export { Input }

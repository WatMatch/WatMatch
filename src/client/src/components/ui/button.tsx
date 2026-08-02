import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-45 active:translate-y-px focus-visible:ring-2 focus-visible:ring-slate-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-white aria-invalid:border-destructive aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "bg-slate-900 text-white shadow-sm hover:bg-slate-800",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-700 focus-visible:ring-red-400/50",
        outline:
          "border border-slate-300 bg-white text-slate-700 shadow-sm hover:border-slate-400 hover:bg-slate-50 hover:text-slate-950",
        secondary:
          "bg-slate-100 text-slate-800 hover:bg-slate-200",
        ghost:
          "text-slate-600 hover:bg-slate-100 hover:text-slate-950",
        link: "h-auto rounded-sm p-0 text-slate-800 underline-offset-4 hover:text-slate-950 hover:underline active:translate-y-0",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3.5",
        sm: "h-8 gap-1.5 rounded-md px-3 text-xs has-[>svg]:px-2.5",
        lg: "h-10 px-5 has-[>svg]:px-4",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  loadingLabel,
  children,
  disabled,
  "aria-label": ariaLabel,
  onClick,
  tabIndex,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    loading?: boolean
    loadingLabel?: string
  }) {
  const classes = cn(
    buttonVariants({ variant, size, className }),
    asChild && (disabled || loading) && "pointer-events-none opacity-45"
  )

  if (asChild) {
    return (
      <Slot
        data-slot="button"
        data-loading={loading || undefined}
        className={classes}
        aria-busy={loading || undefined}
        aria-label={loading && loadingLabel ? loadingLabel : ariaLabel}
        aria-disabled={disabled || loading ? true : undefined}
        tabIndex={disabled || loading ? -1 : tabIndex}
        onClick={onClick}
        {...props}
      >
        {children}
      </Slot>
    )
  }

  return (
    <button
      data-slot="button"
      data-loading={loading || undefined}
      className={classes}
      aria-busy={loading || undefined}
      aria-label={loading && loadingLabel ? loadingLabel : ariaLabel}
      disabled={disabled || loading}
      tabIndex={tabIndex}
      onClick={onClick}
      {...props}
    >
      {loading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  )
}

export { Button, buttonVariants }

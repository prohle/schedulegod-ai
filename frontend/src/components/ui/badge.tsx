"use client";

import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "info";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-secondary text-secondary-foreground border-border",
    success: "bg-green-100 text-green-900 border-green-200",
    warning: "bg-amber-100 text-amber-900 border-amber-200",
    destructive: "bg-red-100 text-red-900 border-red-200",
    info: "bg-sky-100 text-sky-900 border-sky-200",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold border",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}
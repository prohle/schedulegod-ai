"use client";

import { cn } from "@/lib/utils";

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "info";
}

export function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  const variants = {
    default: "bg-secondary text-secondary-foreground border-border",
    success: "bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-100 border-green-200 dark:border-green-800",
    warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-900 dark:text-amber-100 border-amber-200 dark:border-amber-800",
    destructive: "bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-100 border-red-200 dark:border-red-800",
    info: "bg-sky-100 dark:bg-sky-900/30 text-sky-900 dark:text-sky-100 border-sky-200 dark:border-sky-800",
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
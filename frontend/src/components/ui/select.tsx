"use client";

import { cn } from "@/lib/utils";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  disabled?: boolean;
}

export function Select({
  className,
  disabled,
  children,
  ...props
}: SelectProps) {
  return (
    <select
      className={cn(
        "bg-background border border-input text-foreground rounded px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </select>
  );
}